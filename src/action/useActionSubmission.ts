import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ActionCoordinates, AuthenticatedFetchFn, SpecialAction, SubmitActionRequest } from '../api/actionClient'
import { ActionApiError, actionErrorMessage, submitAction } from '../api/actionClient'
import { hasAcceptedSubmission } from '../game/reconciliation'
import type { GameStateSession } from '../game/useGameState'
import { selectActionRoundView, type ActionRoundView } from './actionView'

export type ActionDraft =
  | { readonly kind: 'none' }
  | { readonly kind: 'card'; readonly cardInstanceId: string; readonly coordinates: ActionCoordinates }
  | { readonly kind: 'special'; readonly specialAction: SpecialAction; readonly coordinates: ActionCoordinates }

export type SubmitPhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'submitting' }
  | { readonly kind: 'submitted' }
  | { readonly kind: 'rejected'; readonly message: string; readonly code: string | null }

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
  readonly selectCard: (cardInstanceId: string, coordinates: ActionCoordinates) => void
  readonly selectSpecial: (specialAction: SpecialAction, coordinates: ActionCoordinates) => void
  readonly clearDraft: () => void
  readonly confirm: () => Promise<void>
  readonly dismissRejection: () => void
}

/**
 * Owns one participant's action-round draft against the authoritative
 * contract: builds the precise request from the chosen card/special's
 * target coordinates, submits it, and — on any failure, including a lost
 * response — refreshes game state and checks `hasAcceptedSubmission` before
 * reporting a rejection. The draft is preserved on rejection (it may still
 * be resubmittable after a stale-phase or transient failure) and cleared
 * only once acceptance is confirmed.
 */
export function useActionSubmission(options: UseActionSubmissionOptions): ActionSubmissionSession {
  const { apiBaseUrl, fetchFn, gameState, ownPlayerId } = options
  const [draft, setDraft] = useState<ActionDraft>({ kind: 'none' })
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>({ kind: 'idle' })

  const fetchRef = useRef(fetchFn)
  useEffect(() => {
    fetchRef.current = fetchFn
  }, [fetchFn])

  const view = useMemo(() => selectActionRoundView(gameState.state, ownPlayerId), [gameState.state, ownPlayerId])

  // A new round/era (or a round already accepted, e.g. from another tab or a
  // reload) invalidates any in-progress draft for a round that no longer
  // applies. Adjusting state directly during render (rather than an effect)
  // keeps the reconciled value available on this same render, matching the
  // pattern already used for reconciling selection in AppShell.
  const roundKey = view.kind === 'open' ? `${view.gameId}:${view.eraNumber}:${view.roundNumber}` : null
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

  const selectCard = useCallback((cardInstanceId: string, coordinates: ActionCoordinates) => {
    setDraft({ kind: 'card', cardInstanceId, coordinates })
    setSubmitPhase({ kind: 'idle' })
  }, [])

  const selectSpecial = useCallback((specialAction: SpecialAction, coordinates: ActionCoordinates) => {
    setDraft({ kind: 'special', specialAction, coordinates })
    setSubmitPhase({ kind: 'idle' })
  }, [])

  const clearDraft = useCallback(() => {
    setDraft({ kind: 'none' })
    setSubmitPhase({ kind: 'idle' })
  }, [])

  const dismissRejection = useCallback(() => {
    setSubmitPhase((previous) => (previous.kind === 'rejected' ? { kind: 'idle' } : previous))
  }, [])

  const confirm = useCallback(async (): Promise<void> => {
    if (view.kind !== 'open' || draft.kind === 'none') {
      return
    }
    const { gameId: activeGameId, eraNumber, roundNumber } = view
    const request: SubmitActionRequest =
      draft.kind === 'card'
        ? { actionType: 'CARD', cardInstanceId: draft.cardInstanceId, coordinates: draft.coordinates }
        : { actionType: 'SPECIAL', specialAction: draft.specialAction, coordinates: draft.coordinates }

    setSubmitPhase({ kind: 'submitting' })
    try {
      await submitAction(fetchRef.current, apiBaseUrl, activeGameId, eraNumber, roundNumber, request)
      setSubmitPhase({ kind: 'submitted' })
      setDraft({ kind: 'none' })
      await gameState.refresh()
    } catch (error) {
      // Every failure — including an authoritative rejection, a stale
      // phase, or an ambiguous (network-level) response — reconciles
      // acceptance before being reported: a lost response may still have
      // landed, and a stale-phase rejection means the round moved on.
      const reconciled = await gameState.refresh()
      if (reconciled && hasAcceptedSubmission(reconciled, { eraNumber, kind: 'ACTION', roundNumber })) {
        setSubmitPhase({ kind: 'submitted' })
        setDraft({ kind: 'none' })
        return
      }
      setSubmitPhase({
        kind: 'rejected',
        message: actionErrorMessage(error),
        code: error instanceof ActionApiError ? error.code : null,
      })
    }
  }, [view, draft, apiBaseUrl, gameState])

  return useMemo(
    () => ({ view, draft, submitPhase, selectCard, selectSpecial, clearDraft, confirm, dismissRejection }),
    [view, draft, submitPhase, selectCard, selectSpecial, clearDraft, confirm, dismissRejection],
  )
}
