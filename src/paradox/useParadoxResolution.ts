import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiProblemError } from '../api/client'
import { actionErrorMessage, submitParadoxResolutionCard, type AuthenticatedFetchFn } from '../api/action'
import { paradoxStatusQuery } from '../api/queries'
import { hasAcceptedSubmission } from '../game/reconciliation'
import type { GameStateSession } from '../game/useGameState'
import { selectParadoxResolutionView, type ParadoxResolutionView } from './paradoxView'

export type ParadoxDraft =
  | { readonly kind: 'none' }
  | { readonly kind: 'card'; readonly cardInstanceId: string; readonly targetEventId: string; readonly targetOutcomeId: string }

export type ParadoxSubmitPhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'submitting' }
  | { readonly kind: 'submitted' }
  | { readonly kind: 'rejected'; readonly message: string; readonly code: string | null }

export interface UseParadoxResolutionOptions {
  readonly apiBaseUrl: string
  readonly fetchFn: AuthenticatedFetchFn
  readonly gameState: GameStateSession
  /** The viewer's identity subject: the cached phase status is scoped to it. */
  readonly perspectiveKey: string | null
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

export function useParadoxResolution(options: UseParadoxResolutionOptions): ParadoxResolutionSession {
  const { apiBaseUrl, fetchFn, gameState, perspectiveKey } = options
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<ParadoxDraft>({ kind: 'none' })
  const [submitPhase, setSubmitPhase] = useState<ParadoxSubmitPhase>({ kind: 'idle' })

  const state = gameState.state
  const phase = state?.phase === 'PARADOX_RESOLUTION' && state.phaseContext?.paradoxOpen ? { gameId: state.gameId, eraNumber: state.eraNumber } : null
  const phaseScope = phase ? `${phase.gameId}:${phase.eraNumber}` : null
  const scope = useMemo(() => ({ perspective: perspectiveKey ?? '', apiBaseUrl, fetchFn }), [perspectiveKey, apiBaseUrl, fetchFn])
  const revision = state?.revision ?? null

  // Re-read with every newer game state while the phase is open; a failed read shows nothing.
  const status = useQuery({
    ...paradoxStatusQuery(scope, phase?.gameId ?? '', phase?.eraNumber ?? 0, revision),
    enabled: phase !== null && perspectiveKey !== null,
  })

  // A new phase (or none) drops the previous phase's draft and outcome.
  const [seenPhaseKey, setSeenPhaseKey] = useState<string | null>(null)
  if (seenPhaseKey !== phaseScope) {
    setSeenPhaseKey(phaseScope)
    if (draft.kind !== 'none') setDraft({ kind: 'none' })
    if (submitPhase.kind !== 'idle') setSubmitPhase({ kind: 'idle' })
  }

  const statusForCurrentPhase = phase && !status.isError ? (status.data ?? null) : null
  const view = useMemo(() => selectParadoxResolutionView(state, statusForCurrentPhase), [state, statusForCurrentPhase])
  if (view.kind === 'submitted' && draft.kind !== 'none') {
    setDraft({ kind: 'none' })
  }

  /** The phase status as it is now, read past any cached answer. */
  const readStatus = useCallback(
    async ({ gameId, eraNumber }: PhaseCoordinates, atRevision: number | null) =>
      queryClient.query(paradoxStatusQuery(scope, gameId, eraNumber, atRevision)).catch(() => null),
    [queryClient, scope],
  )

  const accepted = useCallback(() => {
    setSubmitPhase({ kind: 'submitted' })
    setDraft({ kind: 'none' })
  }, [])

  const { mutateAsync: submit } = useMutation({
    mutationFn: ({ coordinates, card }: { readonly coordinates: PhaseCoordinates; readonly card: Extract<ParadoxDraft, { kind: 'card' }> }) =>
      submitParadoxResolutionCard(fetchFn, apiBaseUrl, coordinates.gameId, coordinates.eraNumber, card),
    onSuccess: async (_result, { coordinates }) => {
      accepted()
      const refreshed = await gameState.refresh()
      await readStatus(coordinates, refreshed?.revision ?? null)
    },
    // A lost response or a rejection may still hide an accepted choice: reconcile against the
    // phase status and game state before reporting a rejection.
    onError: async (error, { coordinates }) => {
      const refreshed = await gameState.refresh()
      const recovered = await readStatus(coordinates, refreshed?.revision ?? null)
      if (recovered?.mySubmitted || hasAcceptedSubmission(refreshed, { eraNumber: coordinates.eraNumber, kind: 'PARADOX_CARD' })) {
        accepted()
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
