import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ApiProblemError } from '../api/client'
import {
  actionErrorMessage,
  submitAction,
  type ActionCoordinates,
  type AuthenticatedFetchFn,
  type SpecialAction,
  type SubmitActionRequest,
} from '../api/action'
import { hasAcceptedSubmission } from '../game/reconciliation'
import type { GameStateSession } from '../game/useGameState'
import { selectActionRoundView, type ActionRoundView } from './actionView'

export type ActionDraft =
  | { readonly kind: 'none' }
  | { readonly kind: 'card'; readonly cardInstanceId: string; readonly coordinates: ActionCoordinates }
  | { readonly kind: 'special'; readonly specialAction: SpecialAction; readonly coordinates: ActionCoordinates }
  | { readonly kind: 'pass' }

export type SubmitPhase = { readonly kind: 'idle' } | { readonly kind: 'submitting' } | { readonly kind: 'awaiting-projection' }

/** A rejected or failed submission, kept until dismissed or the player makes a new choice. */
export interface SubmissionRejection {
  readonly message: string
  readonly code: string | null
}

interface RoundSubmission {
  readonly gameId: string
  readonly eraNumber: number
  readonly roundNumber: number
  readonly request: SubmitActionRequest
}

function roundKeyFor({ gameId, eraNumber, roundNumber }: Pick<RoundSubmission, 'gameId' | 'eraNumber' | 'roundNumber'>): string {
  return `${gameId}:${eraNumber}:${roundNumber}`
}

function requestFor(draft: Exclude<ActionDraft, { kind: 'none' }>): SubmitActionRequest {
  switch (draft.kind) {
    case 'card':
      return { ...draft.coordinates, actionType: 'CARD', cardInstanceId: draft.cardInstanceId }
    case 'special':
      return { ...draft.coordinates, actionType: 'SPECIAL', specialAction: draft.specialAction }
    case 'pass':
      return { actionType: 'PASS' }
  }
}

export interface UseActionSubmissionOptions {
  readonly apiBaseUrl: string
  readonly fetchFn: AuthenticatedFetchFn
  readonly gameState: GameStateSession
  readonly ownPlayerId: string | null
}

export interface ActionSubmissionSession {
  readonly view: ActionRoundView
  readonly draft: ActionDraft
  readonly submitPhase: SubmitPhase
  readonly rejection: SubmissionRejection | null
  readonly selectCard: (cardInstanceId: string, coordinates?: ActionCoordinates) => void
  readonly selectSpecial: (specialAction: SpecialAction, coordinates?: ActionCoordinates) => void
  readonly choosePass: () => void
  /** Replaces the selected card's or special's targets; ignored without one. */
  readonly retarget: (coordinates: ActionCoordinates) => void
  readonly clearDraft: () => void
  readonly confirm: () => Promise<void>
  readonly dismissRejection: () => void
}

/**
 * Owns one participant's action-round draft against the authoritative
 * contract: builds the precise card, special or pass request, submits it,
 * and, on any failure including a lost response, refreshes game state and
 * checks `hasAcceptedSubmission` before reporting. A server rejection is
 * always reported, even once the round has moved on; a failure without a
 * server answer is reported only when the refreshed state does not record the
 * decision. The draft is preserved on rejection and cleared only once
 * acceptance is confirmed or the round changes.
 */
export function useActionSubmission(options: UseActionSubmissionOptions): ActionSubmissionSession {
  const { apiBaseUrl, fetchFn, gameState, ownPlayerId } = options
  const [draft, setDraft] = useState<ActionDraft>({ kind: 'none' })
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>({ kind: 'idle' })
  const [rejection, setRejection] = useState<SubmissionRejection | null>(null)

  const view = useMemo(() => selectActionRoundView(gameState.state, ownPlayerId), [gameState.state, ownPlayerId])

  // A new round/era (or a round already accepted, e.g. from another tab or a
  // reload) invalidates any in-progress draft for a round that no longer
  // applies. Adjusting state directly during render (rather than an effect)
  // keeps the reconciled value available on this same render, matching the
  // pattern already used for reconciling selection in AppShell.
  const roundKey = view.kind === 'open' ? `${view.gameId}:${view.eraNumber}:${view.roundNumber}` : null
  const activeRoundKeyRef = useRef(roundKey)
  useLayoutEffect(() => {
    activeRoundKeyRef.current = roundKey
  }, [roundKey])
  const [seenRoundKey, setSeenRoundKey] = useState<string | null>(null)
  const shouldResetForNewRound = seenRoundKey !== roundKey
  const shouldResetForAcceptedRound = view.kind === 'open' && view.hasSubmitted && draft.kind !== 'none'
  if (shouldResetForNewRound || shouldResetForAcceptedRound) {
    if (shouldResetForNewRound) {
      setSeenRoundKey(roundKey)
    }
    if (draft.kind !== 'none') {
      setDraft({ kind: 'none' })
    }
    if (submitPhase.kind !== 'idle') {
      setSubmitPhase({ kind: 'idle' })
    }
  }

  const choose = useCallback((next: ActionDraft) => {
    setDraft(next)
    setSubmitPhase({ kind: 'idle' })
    setRejection(null)
  }, [])

  const selectCard = useCallback(
    (cardInstanceId: string, coordinates: ActionCoordinates = {}) => choose({ kind: 'card', cardInstanceId, coordinates }),
    [choose],
  )

  const selectSpecial = useCallback(
    (specialAction: SpecialAction, coordinates: ActionCoordinates = {}) => choose({ kind: 'special', specialAction, coordinates }),
    [choose],
  )

  const choosePass = useCallback(() => choose({ kind: 'pass' }), [choose])

  const clearDraft = useCallback(() => choose({ kind: 'none' }), [choose])

  const retarget = useCallback((coordinates: ActionCoordinates) => {
    setDraft((previous) => (previous.kind === 'card' || previous.kind === 'special' ? { ...previous, coordinates } : previous))
    setRejection(null)
  }, [])

  const dismissRejection = useCallback(() => setRejection(null), [])

  const awaitingProjection = useCallback(() => {
    setSubmitPhase({ kind: 'awaiting-projection' })
    setDraft({ kind: 'none' })
  }, [])

  const { mutateAsync: submit } = useMutation({
    mutationFn: ({ gameId, eraNumber, roundNumber, request }: RoundSubmission) =>
      submitAction(fetchFn, apiBaseUrl, gameId, eraNumber, roundNumber, request),
    onSuccess: async (_result, submission) => {
      const submittedRoundKey = roundKeyFor(submission)
      if (activeRoundKeyRef.current !== submittedRoundKey) return
      const refreshed = await gameState.refresh()
      if (activeRoundKeyRef.current !== submittedRoundKey) return
      if (refreshed && hasAcceptedSubmission(refreshed, { eraNumber: submission.eraNumber, window: 'ACTION', roundNumber: submission.roundNumber })) {
        setDraft({ kind: 'none' })
        setSubmitPhase({ kind: 'idle' })
      } else {
        awaitingProjection()
      }
    },
    onError: async (error, submission) => {
      const reconciled = await gameState.refresh()
      const accepted =
        reconciled !== null &&
        hasAcceptedSubmission(reconciled, { eraNumber: submission.eraNumber, window: 'ACTION', roundNumber: submission.roundNumber })
      const isServerAnswer = error instanceof ApiProblemError
      if (isServerAnswer || !accepted) {
        setRejection({ message: actionErrorMessage(error), code: isServerAnswer ? error.code : null })
      }
      if (activeRoundKeyRef.current !== roundKeyFor(submission)) return
      if (accepted) {
        awaitingProjection()
      } else {
        setSubmitPhase({ kind: 'idle' })
      }
    },
  })

  const confirm = useCallback(async (): Promise<void> => {
    if (view.kind !== 'open' || view.hasSubmitted || draft.kind === 'none' || submitPhase.kind !== 'idle') {
      return
    }
    const { gameId, eraNumber, roundNumber } = view
    setSubmitPhase({ kind: 'submitting' })
    setRejection(null)
    await submit({ gameId, eraNumber, roundNumber, request: requestFor(draft) }).catch(() => undefined)
  }, [view, draft, submitPhase.kind, submit])

  return useMemo(
    () => ({ view, draft, submitPhase, rejection, selectCard, selectSpecial, choosePass, retarget, clearDraft, confirm, dismissRejection }),
    [view, draft, submitPhase, rejection, selectCard, selectSpecial, choosePass, retarget, clearDraft, confirm, dismissRejection],
  )
}
