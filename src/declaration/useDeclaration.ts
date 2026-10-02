import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ApiProblemError } from '../api/client'
import { actionErrorMessage, submitDeclaration, type ActivistDeclarationMode, type AuthenticatedFetchFn } from '../api/action'
import { hasAcceptedSubmission } from '../game/reconciliation'
import type { GameStateSession } from '../game/useGameState'
import { selectDeclarationView, type DeclarationView } from './declarationView'

export type DeclarationDraft =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'declaration'
      readonly mode: ActivistDeclarationMode
      readonly targetEventId: string
      readonly targetOutcomeId: string
    }

export type DeclarationSubmitPhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'submitting' }
  | { readonly kind: 'awaiting-projection' }
  | { readonly kind: 'skipped' }
  | { readonly kind: 'rejected'; readonly message: string; readonly code: string | null }

export interface UseDeclarationOptions {
  readonly apiBaseUrl: string
  readonly fetchFn: AuthenticatedFetchFn
  readonly gameState: GameStateSession
}

export interface DeclarationSession {
  readonly view: DeclarationView
  readonly draft: DeclarationDraft
  readonly submitPhase: DeclarationSubmitPhase
  readonly selectMode: (mode: ActivistDeclarationMode) => void
  readonly selectTarget: (targetEventId: string, targetOutcomeId: string) => void
  readonly clearDraft: () => void
  readonly skip: () => void
  readonly confirm: () => Promise<void>
  readonly dismissRejection: () => void
}

interface DeclarationCoordinates {
  readonly gameId: string
  readonly eraNumber: number
}

function windowKeyFor({ gameId, eraNumber }: DeclarationCoordinates): string {
  return `${gameId}:${eraNumber}`
}

export function useDeclaration(options: UseDeclarationOptions): DeclarationSession {
  const { apiBaseUrl, fetchFn, gameState } = options
  const [draft, setDraft] = useState<DeclarationDraft>({ kind: 'none' })
  const [submitPhase, setSubmitPhase] = useState<DeclarationSubmitPhase>({ kind: 'idle' })

  const state = gameState.state
  const windowScope =
    state?.phaseContext?.declarationOpen && state ? `${state.gameId}:${state.eraNumber}` : null
  const activeWindowScopeRef = useRef(windowScope)
  useLayoutEffect(() => {
    activeWindowScopeRef.current = windowScope
  }, [windowScope])

  // A new window (or none) drops the previous window's draft and outcome.
  const [seenWindowKey, setSeenWindowKey] = useState<string | null>(null)
  if (seenWindowKey !== windowScope) {
    setSeenWindowKey(windowScope)
    if (draft.kind !== 'none') setDraft({ kind: 'none' })
    if (submitPhase.kind !== 'idle') setSubmitPhase({ kind: 'idle' })
  }

  const view = useMemo(() => selectDeclarationView(state), [state])
  if (view.kind === 'submitted' && draft.kind !== 'none') {
    setDraft({ kind: 'none' })
  }
  if (view.kind === 'submitted' && submitPhase.kind !== 'idle' && submitPhase.kind !== 'awaiting-projection') {
    setSubmitPhase({ kind: 'idle' })
  }

  const awaitingProjection = useCallback(() => {
    setSubmitPhase({ kind: 'awaiting-projection' })
    setDraft({ kind: 'none' })
  }, [])

  const { mutateAsync: submit } = useMutation({
    mutationFn: ({
      coordinates,
      declaration,
    }: {
      readonly coordinates: DeclarationCoordinates
      readonly declaration: Extract<DeclarationDraft, { kind: 'declaration' }>
    }) =>
      submitDeclaration(fetchFn, apiBaseUrl, coordinates.gameId, coordinates.eraNumber, {
        specialAction: declaration.mode,
        targetEventId: declaration.targetEventId,
        targetOutcomeId: declaration.targetOutcomeId,
      }),
    onSuccess: async (_result, { coordinates }) => {
      const submittedWindowKey = windowKeyFor(coordinates)
      if (activeWindowScopeRef.current !== submittedWindowKey) return
      const refreshed = await gameState.refresh()
      if (activeWindowScopeRef.current !== submittedWindowKey) return
      if (hasAcceptedSubmission(refreshed, { eraNumber: coordinates.eraNumber, window: 'DECLARATION' })) {
        setDraft({ kind: 'none' })
        setSubmitPhase({ kind: 'idle' })
      } else {
        awaitingProjection()
      }
    },
    // A lost response may still have landed: reconcile the accepted declaration before reporting a rejection.
    onError: async (error, { coordinates }) => {
      const submittedWindowKey = windowKeyFor(coordinates)
      if (activeWindowScopeRef.current !== submittedWindowKey) return
      const refreshed = await gameState.refresh()
      if (activeWindowScopeRef.current !== submittedWindowKey) return
      if (hasAcceptedSubmission(refreshed, { eraNumber: coordinates.eraNumber, window: 'DECLARATION' })) {
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

  const selectMode = useCallback((mode: ActivistDeclarationMode) => {
    setDraft((previous) => ({
      kind: 'declaration',
      mode,
      targetEventId: previous.kind === 'declaration' ? previous.targetEventId : '',
      targetOutcomeId: previous.kind === 'declaration' ? previous.targetOutcomeId : '',
    }))
    setSubmitPhase({ kind: 'idle' })
  }, [])

  const selectTarget = useCallback((targetEventId: string, targetOutcomeId: string) => {
    setDraft((previous) =>
      previous.kind === 'declaration' ? { ...previous, targetEventId, targetOutcomeId } : previous,
    )
    setSubmitPhase({ kind: 'idle' })
  }, [])

  const clearDraft = useCallback(() => {
    setDraft({ kind: 'none' })
    setSubmitPhase({ kind: 'idle' })
  }, [])

  const skip = useCallback(() => {
    // Skip is a local dismissal only: it performs no submission.
    setDraft({ kind: 'none' })
    setSubmitPhase({ kind: 'skipped' })
  }, [])

  const dismissRejection = useCallback(() => {
    setSubmitPhase((previous) => (previous.kind === 'rejected' ? { kind: 'idle' } : previous))
  }, [])

  const confirm = useCallback(async (): Promise<void> => {
    if (view.kind !== 'open' || draft.kind !== 'declaration' || !draft.targetEventId || !draft.targetOutcomeId) return
    if (!view.eligibleModes.includes(draft.mode)) return
    setSubmitPhase({ kind: 'submitting' })
    await submit({ coordinates: { gameId: view.gameId, eraNumber: view.eraNumber }, declaration: draft }).catch(
      () => undefined,
    )
  }, [draft, submit, view])

  return useMemo(
    () => ({ view, draft, submitPhase, selectMode, selectTarget, clearDraft, skip, confirm, dismissRejection }),
    [view, draft, submitPhase, selectMode, selectTarget, clearDraft, skip, confirm, dismissRejection],
  )
}
