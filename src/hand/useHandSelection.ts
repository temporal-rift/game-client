import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { AuthenticatedFetchFn } from '../api/gameStateClient'
import { ActionApiError, actionErrorMessage, submitHandSelection } from '../api/actionClient'
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
  const fetchRef = useRef(fetchFn)
  useEffect(() => {
    fetchRef.current = fetchFn
  }, [fetchFn])

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

  const confirm = useCallback(async (): Promise<void> => {
    if (view.kind !== 'open' || selectedCardInstanceIds.length !== view.requiredSelectionCount) return
    const submittedSelectionKey = selectionKey
    const { gameId, eraNumber } = view
    setSubmitPhase({ kind: 'submitting' })
    try {
      await submitHandSelection(fetchRef.current, apiBaseUrl, gameId, eraNumber, selectedCardInstanceIds)
      if (selectionKeyRef.current !== submittedSelectionKey) return
      setSubmitPhase({ kind: 'submitted' })
      setSelectedCardInstanceIds([])
      await gameState.refresh()
    } catch (error) {
      if (selectionKeyRef.current !== submittedSelectionKey) return
      const reconciled = await gameState.refresh()
      if (selectionKeyRef.current !== submittedSelectionKey) return
      if (reconciled && hasAcceptedSubmission(reconciled, { eraNumber, kind: 'HAND_SELECTION' })) {
        setSubmitPhase({ kind: 'submitted' })
        setSelectedCardInstanceIds([])
        return
      }
      setSubmitPhase({
        kind: 'rejected',
        message: actionErrorMessage(error),
        code: error instanceof ActionApiError ? error.code : null,
      })
    }
  }, [apiBaseUrl, gameState, selectedCardInstanceIds, selectionKey, view])

  const dismissRejection = useCallback(() => {
    setSubmitPhase((previous) => (previous.kind === 'rejected' ? { kind: 'idle' } : previous))
  }, [])

  return useMemo(
    () => ({ view, selectedCardInstanceIds, submitPhase, toggleCard, confirm, dismissRejection }),
    [view, selectedCardInstanceIds, submitPhase, toggleCard, confirm, dismissRejection],
  )
}
