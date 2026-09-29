import { isCardType, type CardGrade, type CardType } from '../api/action'
import type { GameStateView } from '../api/projection'
import { hasAcceptedSubmission } from '../game/reconciliation'
import { cardDisplayName, cardEffectSummary } from '../action/actionRules'

export interface OfferedHandCard {
  readonly cardInstanceId: string
  readonly cardType: CardType
  readonly grade: CardGrade
  readonly dealSlot: number
  readonly name: string
  readonly effectSummary: string
}

export type HandSelectionView =
  | { readonly kind: 'unavailable'; readonly reason: string }
  | {
      readonly kind: 'open'
      readonly gameId: string
      readonly eraNumber: number
      readonly cards: readonly OfferedHandCard[]
      readonly requiredSelectionCount: 5
      readonly expiresAt: string
    }
  | {
      readonly kind: 'accepted'
      readonly eraNumber: number
      readonly cards: readonly OfferedHandCard[]
    }

interface DealtCard {
  readonly cardInstanceId: string
  readonly cardType: string
  readonly grade: CardGrade
  readonly dealSlot: number
}

/** Null unless every card is a known type and ids and deal slots are distinct. */
function offeredCards(cards: readonly DealtCard[]): readonly OfferedHandCard[] | null {
  const offered = cards.flatMap(({ cardInstanceId, cardType, grade, dealSlot }) =>
    isCardType(cardType)
      ? [{ cardInstanceId, cardType, grade, dealSlot, name: cardDisplayName(cardType), effectSummary: cardEffectSummary(cardType) }]
      : [],
  )
  const distinctIds = new Set(offered.map((card) => card.cardInstanceId))
  const distinctSlots = new Set(offered.map((card) => card.dealSlot))
  return offered.length === cards.length && distinctIds.size === cards.length && distinctSlots.size === cards.length
    ? [...offered].sort((left, right) => left.dealSlot - right.dealSlot)
    : null
}

/** Builds the owner-private hand-selection view without deriving an offer locally. */
export function selectHandSelectionView(state: GameStateView | null): HandSelectionView {
  if (!state) return { kind: 'unavailable', reason: 'Game state is not loaded yet.' }

  const accepted = hasAcceptedSubmission(state, { eraNumber: state.eraNumber, kind: 'HAND_SELECTION' })
  // The accepted hand carries no deal slots: it keeps the order the server lists it in.
  const acceptedCards = offeredCards(state.myHand.map((card, index) => ({ ...card, dealSlot: index + 1 })))
  if (accepted) {
    if (acceptedCards?.length === 5) {
      return { kind: 'accepted', eraNumber: state.eraNumber, cards: acceptedCards }
    }
    return { kind: 'unavailable', reason: 'Your accepted hand is being refreshed.' }
  }

  if (state.phase !== 'HAND_SELECTION') {
    return { kind: 'unavailable', reason: 'No hand-selection window is currently open.' }
  }
  const pending = state.pendingHandSelection
  if (!pending) {
    return { kind: 'unavailable', reason: 'Your private card offer is being refreshed.' }
  }
  const cards = offeredCards(pending.cards)
  if (cards?.length !== 7) {
    return { kind: 'unavailable', reason: 'Your private card offer is incomplete. Refreshing authoritative state.' }
  }
  return {
    kind: 'open',
    gameId: state.gameId,
    eraNumber: state.eraNumber,
    cards,
    requiredSelectionCount: pending.requiredSelectionCount,
    expiresAt: pending.expiresAt,
  }
}
