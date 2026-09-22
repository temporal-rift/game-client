import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActionApiError,
  actionErrorMessage,
  getParadoxResolutionStatus,
  submitParadoxResolutionCard,
  type AuthenticatedFetchFn,
  type ParadoxResolutionStatusView,
} from '../api/actionClient'
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

export function useParadoxResolution(options: UseParadoxResolutionOptions): ParadoxResolutionSession {
  const { apiBaseUrl, fetchFn, gameState } = options
  const [status, setStatus] = useState<ParadoxResolutionStatusView | null>(null)
  const [draft, setDraft] = useState<ParadoxDraft>({ kind: 'none' })
  const [submitPhase, setSubmitPhase] = useState<ParadoxSubmitPhase>({ kind: 'idle' })
  const fetchRef = useRef(fetchFn)

  useEffect(() => {
    fetchRef.current = fetchFn
  }, [fetchFn])

  const phaseScope = useMemo(() => {
    const state = gameState.state
    return state?.phase === 'PARADOX_RESOLUTION' && state.phaseContext.paradoxOpen ? `${state.gameId}:${state.eraNumber}` : null
  }, [gameState.state])
  const statusRefreshKey = phaseScope ? `${phaseScope}:${gameState.state?.revision ?? 'unversioned'}` : null

  const [seenPhaseKey, setSeenPhaseKey] = useState<string | null>(null)
  if (seenPhaseKey !== phaseScope) {
    setSeenPhaseKey(phaseScope)
    if (status !== null) setStatus(null)
    if (draft.kind !== 'none') setDraft({ kind: 'none' })
    if (submitPhase.kind !== 'idle') setSubmitPhase({ kind: 'idle' })
  }

  const readStatus = useCallback(
    async (activeGameId: string, eraNumber: number): Promise<ParadoxResolutionStatusView | null> => {
      try {
        const next = await getParadoxResolutionStatus(fetchRef.current, apiBaseUrl, activeGameId, eraNumber)
        setStatus(next)
        return next
      } catch {
        return null
      }
    },
    [apiBaseUrl],
  )

  useEffect(() => {
    if (!phaseScope) return
    const [activeGameId, era] = phaseScope.split(':')
    let cancelled = false
    void getParadoxResolutionStatus(fetchRef.current, apiBaseUrl, activeGameId, Number(era)).then(
      (next) => {
        if (!cancelled) setStatus(next)
      },
      () => {
        if (!cancelled) setStatus(null)
      },
    )
    return () => {
      cancelled = true
    }
  }, [apiBaseUrl, phaseScope, statusRefreshKey])

  const statusForCurrentPhase = seenPhaseKey === phaseScope ? status : null
  const view = useMemo(() => selectParadoxResolutionView(gameState.state, statusForCurrentPhase), [gameState.state, statusForCurrentPhase])
  const accepted = view.kind === 'submitted'
  if (accepted && draft.kind !== 'none') {
    setDraft({ kind: 'none' })
  }

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
    setDraft((previous) =>
      previous.kind === 'card' ? { ...previous, targetEventId, targetOutcomeId } : previous,
    )
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
    const request = draft
    setSubmitPhase({ kind: 'submitting' })
    try {
      await submitParadoxResolutionCard(fetchRef.current, apiBaseUrl, view.gameId, view.eraNumber, request)
      setSubmitPhase({ kind: 'submitted' })
      setDraft({ kind: 'none' })
      await gameState.refresh()
      await readStatus(view.gameId, view.eraNumber)
    } catch (error) {
      const refreshed = await gameState.refresh()
      const recoveredStatus = await readStatus(view.gameId, view.eraNumber)
      if (
        recoveredStatus?.mySubmitted ||
        hasAcceptedSubmission(refreshed, { eraNumber: view.eraNumber, kind: 'PARADOX_CARD' })
      ) {
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
  }, [apiBaseUrl, draft, gameState, readStatus, view])

  return useMemo(
    () => ({ view, draft, submitPhase, selectCard, selectTarget, clearDraft, confirm, dismissRejection }),
    [view, draft, submitPhase, selectCard, selectTarget, clearDraft, confirm, dismissRejection],
  )
}
