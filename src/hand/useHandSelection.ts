import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ApiProblemError } from '../api/client'
import type { AuthenticatedFetchFn } from '../api/projection'
import { actionErrorMessage, submitHandSelection } from '../api/action'
import { hasAcceptedSubmission } from '../game/reconciliation'
import type { GameStateSession } from '../game/useGameState'
import { selectHandSelectionView, type HandSelectionView } from './handSelectionView'

export type HandSelectionSubmitPhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'submitting' }
  | { readonly kind: 'submitted' }
  | { readonly kind: 'rejected'; readonly message: string; readonly code: string | null }

export interface HandSelectionSession {
  readonly view: HandSelectionView
  readonly selectedCardInstanceIds: readonly string[]
  readonly submitPhase: HandSelectionSubmitPhase
  readonly toggleCard: (cardInstanceId: string) => void
  readonly confirm: () => Promise<void>
  readonly dismissRejection: () => void
}

interface HandSelectionSubmission {
  readonly gameId: string
  readonly eraNumber: number
  readonly cardInstanceIds: readonly string[]
  /** The offer this selection was made from. */
  readonly selectionKey: string | null
}

export function useHandSelection({
  apiBaseUrl,
  fetchFn,
  gameState,
}: {
  readonly apiBaseUrl: string
  readonly fetchFn: AuthenticatedFetchFn
  readonly gameState: GameStateSession
}): HandSelectionSession {
  const [selectedCardInstanceIds, setSelectedCardInstanceIds] = useState<readonly string[]>([])
  const [submitPhase, setSubmitPhase] = useState<HandSelectionSubmitPhase>({ kind: 'idle' })
  const view = useMemo(() => selectHandSelectionView(gameState.state), [gameState.state])
  const selectionKey = view.kind === 'open' ? `${view.gameId}:${view.eraNumber}:${view.cards.map((card) => card.cardInstanceId).join(':')}` : null
  const selectionKeyRef = useRef(selectionKey)
  useLayoutEffect(() => {
    selectionKeyRef.current = selectionKey
  }, [selectionKey])
  const [seenSelectionKey, setSeenSelectionKey] = useState<string | null>(null)
  if (seenSelectionKey !== selectionKey) {
    setSeenSelectionKey(selectionKey)
    if (selectedCardInstanceIds.length > 0) setSelectedCardInstanceIds([])
    if (submitPhase.kind !== 'idle') setSubmitPhase({ kind: 'idle' })
  }

  const toggleCard = useCallback(
    (cardInstanceId: string) => {
      if (view.kind !== 'open' || !view.cards.some((card) => card.cardInstanceId === cardInstanceId)) return
      setSelectedCardInstanceIds((current) => {
        if (current.includes(cardInstanceId)) return current.filter((id) => id !== cardInstanceId)
        return current.length < view.requiredSelectionCount ? [...current, cardInstanceId] : current
      })
      setSubmitPhase({ kind: 'idle' })
    },
    [view],
  )

  const { mutateAsync: submit } = useMutation({
    mutationFn: ({ gameId, eraNumber, cardInstanceIds }: HandSelectionSubmission) =>
      submitHandSelection(fetchFn, apiBaseUrl, gameId, eraNumber, cardInstanceIds),
    onSuccess: async (_result, { selectionKey: submittedSelectionKey }) => {
      // A newer authoritative offer replaced the one this completion was for.
      if (selectionKeyRef.current !== submittedSelectionKey) return
      setSubmitPhase({ kind: 'submitted' })
      setSelectedCardInstanceIds([])
      await gameState.refresh()
    },
    // A lost response may still have landed: reconcile the accepted hand before reporting a rejection.
    onError: async (error, { eraNumber, selectionKey: submittedSelectionKey }) => {
      if (selectionKeyRef.current !== submittedSelectionKey) return
      const reconciled = await gameState.refresh()
      if (selectionKeyRef.current !== submittedSelectionKey) return
      if (reconciled && hasAcceptedSubmission(reconciled, { eraNumber, window: 'HAND_SELECTION' })) {
        setSubmitPhase({ kind: 'submitted' })
        setSelectedCardInstanceIds([])
        return
      }
      setSubmitPhase({
        kind: 'rejected',
        message: actionErrorMessage(error),
        code: error instanceof ApiProblemError ? error.code : null,
      })
    },
  })

  const confirm = useCallback(async (): Promise<void> => {
    if (view.kind !== 'open' || selectedCardInstanceIds.length !== view.requiredSelectionCount) return
    setSubmitPhase({ kind: 'submitting' })
    await submit({ gameId: view.gameId, eraNumber: view.eraNumber, cardInstanceIds: selectedCardInstanceIds, selectionKey }).catch(
      () => undefined,
    )
  }, [selectedCardInstanceIds, selectionKey, submit, view])

  const dismissRejection = useCallback(() => {
    setSubmitPhase((previous) => (previous.kind === 'rejected' ? { kind: 'idle' } : previous))
  }, [])

  return useMemo(
    () => ({ view, selectedCardInstanceIds, submitPhase, toggleCard, confirm, dismissRejection }),
    [view, selectedCardInstanceIds, submitPhase, toggleCard, confirm, dismissRejection],
  )
}
