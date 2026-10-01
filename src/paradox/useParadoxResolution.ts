import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ApiProblemError } from '../api/client'
import { actionErrorMessage, submitParadoxResolutionCard, type AuthenticatedFetchFn } from '../api/action'
import { hasAcceptedSubmission } from '../game/reconciliation'
import type { GameStateSession } from '../game/useGameState'
import { selectParadoxResolutionView, type ParadoxResolutionView } from './paradoxView'

export type ParadoxDraft =
  | { readonly kind: 'none' }
  | { readonly kind: 'card'; readonly cardInstanceId: string; readonly targetEventId: string; readonly targetOutcomeId: string }

export type ParadoxSubmitPhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'submitting' }
  | { readonly kind: 'awaiting-projection' }
  | { readonly kind: 'rejected'; readonly message: string; readonly code: string | null }

export interface UseParadoxResolutionOptions {
  readonly apiBaseUrl: string
  readonly fetchFn: AuthenticatedFetchFn
  readonly gameState: GameStateSession
}

export interface ParadoxResolutionSession {
  readonly view: ParadoxResolutionView
  readonly draft: ParadoxDraft
  readonly submitPhase: ParadoxSubmitPhase
  readonly selectCard: (cardInstanceId: string) => void
  readonly selectTarget: (targetEventId: string, targetOutcomeId: string) => void
  readonly clearDraft: () => void
  readonly confirm: () => Promise<void>
  readonly dismissRejection: () => void
}

interface PhaseCoordinates {
  readonly gameId: string
  readonly eraNumber: number
}

function phaseKeyFor({ gameId, eraNumber }: PhaseCoordinates): string {
  return `${gameId}:${eraNumber}`
}

export function useParadoxResolution(options: UseParadoxResolutionOptions): ParadoxResolutionSession {
  const { apiBaseUrl, fetchFn, gameState } = options
  const [draft, setDraft] = useState<ParadoxDraft>({ kind: 'none' })
  const [submitPhase, setSubmitPhase] = useState<ParadoxSubmitPhase>({ kind: 'idle' })

  const state = gameState.state
  const phaseScope = state?.phase === 'PARADOX_RESOLUTION' && state.phaseContext?.paradoxOpen ? `${state.gameId}:${state.eraNumber}` : null
  const activePhaseScopeRef = useRef(phaseScope)
  useLayoutEffect(() => {
    activePhaseScopeRef.current = phaseScope
  }, [phaseScope])

  // A new phase (or none) drops the previous phase's draft and outcome.
  const [seenPhaseKey, setSeenPhaseKey] = useState<string | null>(null)
  if (seenPhaseKey !== phaseScope) {
    setSeenPhaseKey(phaseScope)
    if (draft.kind !== 'none') setDraft({ kind: 'none' })
    if (submitPhase.kind !== 'idle') setSubmitPhase({ kind: 'idle' })
  }

  const view = useMemo(() => selectParadoxResolutionView(state), [state])
  if (view.kind === 'submitted' && draft.kind !== 'none') {
    setDraft({ kind: 'none' })
  }

  const awaitingProjection = useCallback(() => {
    setSubmitPhase({ kind: 'awaiting-projection' })
    setDraft({ kind: 'none' })
  }, [])

  const { mutateAsync: submit } = useMutation({
    mutationFn: ({ coordinates, card }: { readonly coordinates: PhaseCoordinates; readonly card: Extract<ParadoxDraft, { kind: 'card' }> }) =>
      submitParadoxResolutionCard(fetchFn, apiBaseUrl, coordinates.gameId, coordinates.eraNumber, card),
    onSuccess: async (_result, { coordinates }) => {
      const submittedPhaseKey = phaseKeyFor(coordinates)
      if (activePhaseScopeRef.current !== submittedPhaseKey) return
      const refreshed = await gameState.refresh()
      if (activePhaseScopeRef.current !== submittedPhaseKey) return
      if (hasAcceptedSubmission(refreshed, { eraNumber: coordinates.eraNumber, window: 'PARADOX_RESOLUTION' })) {
        setDraft({ kind: 'none' })
        setSubmitPhase({ kind: 'idle' })
      } else {
        awaitingProjection()
      }
    },
    // A lost response or a rejection may still hide an accepted choice; reconcile against game state.
    onError: async (error, { coordinates }) => {
      const submittedPhaseKey = phaseKeyFor(coordinates)
      if (activePhaseScopeRef.current !== submittedPhaseKey) return
      const refreshed = await gameState.refresh()
      if (activePhaseScopeRef.current !== submittedPhaseKey) return
      if (hasAcceptedSubmission(refreshed, { eraNumber: coordinates.eraNumber, window: 'PARADOX_RESOLUTION' })) {
        awaitingProjection()
        return
      }
      setSubmitPhase({
        kind: 'rejected',
        message: actionErrorMessage(error),
        code: error instanceof ApiProblemError ? error.code : null,
      })
    },
  })

  const selectCard = useCallback((cardInstanceId: string) => {
    setDraft((previous) => ({
      kind: 'card',
      cardInstanceId,
      targetEventId: previous.kind === 'card' ? previous.targetEventId : '',
      targetOutcomeId: previous.kind === 'card' ? previous.targetOutcomeId : '',
    }))
    setSubmitPhase({ kind: 'idle' })
  }, [])

  const selectTarget = useCallback((targetEventId: string, targetOutcomeId: string) => {
    setDraft((previous) => (previous.kind === 'card' ? { ...previous, targetEventId, targetOutcomeId } : previous))
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
    if (view.kind !== 'open' || draft.kind !== 'card' || !draft.targetEventId || !draft.targetOutcomeId) return
    setSubmitPhase({ kind: 'submitting' })
    await submit({ coordinates: { gameId: view.gameId, eraNumber: view.eraNumber }, card: draft }).catch(() => undefined)
  }, [draft, submit, view])

  return useMemo(
    () => ({ view, draft, submitPhase, selectCard, selectTarget, clearDraft, confirm, dismissRejection }),
    [view, draft, submitPhase, selectCard, selectTarget, clearDraft, confirm, dismissRejection],
  )
}
