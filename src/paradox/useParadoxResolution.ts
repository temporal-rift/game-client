import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ApiProblemError } from '../api/client'
import { actionErrorMessage, submitParadoxResolution, type AuthenticatedFetchFn, type ParadoxResolutionChoice } from '../api/action'
import { hasAcceptedSubmission } from '../game/reconciliation'
import type { GameStateSession } from '../game/useGameState'
import { selectParadoxResolutionView, type ParadoxResolutionView } from './paradoxView'

export type ParadoxDraft =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'card'
      readonly cardInstanceId: string
      /** Null until an outcome of an affected event is chosen. */
      readonly target: { readonly eventId: string; readonly outcomeId: string } | null
    }
  | { readonly kind: 'pass' }

export type ParadoxSubmitPhase = { readonly kind: 'idle' } | { readonly kind: 'submitting' } | { readonly kind: 'awaiting-projection' }

/** A rejected or failed submission, kept until dismissed or the player makes a new choice. */
export interface ParadoxRejection {
  readonly message: string
  readonly code: string | null
}

export interface UseParadoxResolutionOptions {
  readonly apiBaseUrl: string
  readonly fetchFn: AuthenticatedFetchFn
  readonly gameState: GameStateSession
}

export interface ParadoxResolutionSession {
  readonly view: ParadoxResolutionView
  readonly draft: ParadoxDraft
  readonly submitPhase: ParadoxSubmitPhase
  readonly rejection: ParadoxRejection | null
  readonly selectCard: (cardInstanceId: string) => void
  /** Targets the selected card; ignored without one. */
  readonly selectTarget: (eventId: string, outcomeId: string) => void
  readonly choosePass: () => void
  readonly clearDraft: () => void
  readonly confirm: () => Promise<void>
  readonly dismissRejection: () => void
}

interface PhaseSubmission {
  readonly gameId: string
  readonly eraNumber: number
  readonly choice: ParadoxResolutionChoice
}

function phaseKeyFor({ gameId, eraNumber }: Pick<PhaseSubmission, 'gameId' | 'eraNumber'>): string {
  return `${gameId}:${eraNumber}`
}

function choiceFor(draft: ParadoxDraft): ParadoxResolutionChoice | null {
  if (draft.kind === 'pass') return { kind: 'pass' }
  if (draft.kind === 'card' && draft.target) {
    return { kind: 'card', cardInstanceId: draft.cardInstanceId, targetEventId: draft.target.eventId, targetOutcomeId: draft.target.outcomeId }
  }
  return null
}

/**
 * Owns one participant's paradox-resolution choice: a card with its target on an affected event, or a pass.
 * On any failure, including a lost response, it refreshes game state before reporting. A server rejection is
 * always reported, even once the phase has moved on; a failure without a server answer is reported only when
 * the refreshed state does not record the choice. The draft survives a rejection and clears once acceptance
 * is confirmed or the phase changes.
 */
export function useParadoxResolution(options: UseParadoxResolutionOptions): ParadoxResolutionSession {
  const { apiBaseUrl, fetchFn, gameState } = options
  const [draft, setDraft] = useState<ParadoxDraft>({ kind: 'none' })
  const [submitPhase, setSubmitPhase] = useState<ParadoxSubmitPhase>({ kind: 'idle' })
  const [rejection, setRejection] = useState<ParadoxRejection | null>(null)

  const view = useMemo(() => selectParadoxResolutionView(gameState.state), [gameState.state])
  const phaseKey = view.kind === 'unavailable' ? null : phaseKeyFor(view)
  const activePhaseKeyRef = useRef(phaseKey)
  useLayoutEffect(() => {
    activePhaseKeyRef.current = phaseKey
  }, [phaseKey])

  // A new phase (or none), or a choice already accepted elsewhere, drops the in-progress draft.
  const [seenPhaseKey, setSeenPhaseKey] = useState<string | null>(null)
  const isNewPhase = seenPhaseKey !== phaseKey
  if (isNewPhase || (view.kind === 'submitted' && draft.kind !== 'none')) {
    if (isNewPhase) setSeenPhaseKey(phaseKey)
    if (draft.kind !== 'none') setDraft({ kind: 'none' })
    if (submitPhase.kind !== 'idle') setSubmitPhase({ kind: 'idle' })
  }

  const choose = useCallback((next: ParadoxDraft) => {
    setDraft(next)
    setSubmitPhase({ kind: 'idle' })
    setRejection(null)
  }, [])

  const selectCard = useCallback((cardInstanceId: string) => choose({ kind: 'card', cardInstanceId, target: null }), [choose])

  const selectTarget = useCallback((eventId: string, outcomeId: string) => {
    setDraft((previous) => (previous.kind === 'card' ? { ...previous, target: { eventId, outcomeId } } : previous))
    setRejection(null)
  }, [])

  const choosePass = useCallback(() => choose({ kind: 'pass' }), [choose])

  const clearDraft = useCallback(() => choose({ kind: 'none' }), [choose])

  const dismissRejection = useCallback(() => setRejection(null), [])

  const awaitingProjection = useCallback(() => {
    setSubmitPhase({ kind: 'awaiting-projection' })
    setDraft({ kind: 'none' })
  }, [])

  const { mutateAsync: submit } = useMutation({
    mutationFn: ({ gameId, eraNumber, choice }: PhaseSubmission) => submitParadoxResolution(fetchFn, apiBaseUrl, gameId, eraNumber, choice),
    onSuccess: async (_result, submission) => {
      const submittedPhaseKey = phaseKeyFor(submission)
      if (activePhaseKeyRef.current !== submittedPhaseKey) return
      const refreshed = await gameState.refresh()
      if (activePhaseKeyRef.current !== submittedPhaseKey) return
      if (hasAcceptedSubmission(refreshed, { eraNumber: submission.eraNumber, window: 'PARADOX_RESOLUTION' })) {
        setDraft({ kind: 'none' })
        setSubmitPhase({ kind: 'idle' })
      } else {
        awaitingProjection()
      }
    },
    onError: async (error, submission) => {
      const refreshed = await gameState.refresh()
      const accepted = hasAcceptedSubmission(refreshed, { eraNumber: submission.eraNumber, window: 'PARADOX_RESOLUTION' })
      const isServerAnswer = error instanceof ApiProblemError
      if (isServerAnswer || !accepted) {
        setRejection({ message: actionErrorMessage(error), code: isServerAnswer ? error.code : null })
      }
      if (activePhaseKeyRef.current !== phaseKeyFor(submission)) return
      if (accepted) {
        awaitingProjection()
      } else {
        setSubmitPhase({ kind: 'idle' })
      }
    },
  })

  const confirm = useCallback(async (): Promise<void> => {
    const choice = choiceFor(draft)
    if (view.kind !== 'open' || !choice || submitPhase.kind !== 'idle') return
    setSubmitPhase({ kind: 'submitting' })
    setRejection(null)
    await submit({ gameId: view.gameId, eraNumber: view.eraNumber, choice }).catch(() => undefined)
  }, [draft, submit, submitPhase.kind, view])

  return useMemo(
    () => ({ view, draft, submitPhase, rejection, selectCard, selectTarget, choosePass, clearDraft, confirm, dismissRejection }),
    [view, draft, submitPhase, rejection, selectCard, selectTarget, choosePass, clearDraft, confirm, dismissRejection],
  )
}
