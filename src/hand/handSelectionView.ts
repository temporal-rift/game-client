import { CARD_GRADES, CARD_TYPES } from '../api/actionClient'
import type { CardGrade, CardType } from '../api/actionClient'
import type { GameStateView } from '../api/gameStateClient'
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

const KNOWN_CARD_TYPES: ReadonlySet<string> = new Set(CARD_TYPES)
const KNOWN_GRADES: ReadonlySet<string> = new Set(CARD_GRADES)

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function parseCards(value: unknown, requiresDealSlot: boolean): readonly OfferedHandCard[] | null {
  if (!Array.isArray(value)) return null
  const cards: OfferedHandCard[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) return null
    const source = entry as Record<string, unknown>
    const cardInstanceId = stringField(source['cardInstanceId'])
    const cardType = stringField(source['cardType'])
    const grade = stringField(source['grade'])
    const suppliedDealSlot = source['dealSlot']
    const dealSlot = typeof suppliedDealSlot === 'number' ? suppliedDealSlot : cards.length + 1
    if (
      !cardInstanceId ||
      !cardType ||
      !KNOWN_CARD_TYPES.has(cardType) ||
      !grade ||
      !KNOWN_GRADES.has(grade) ||
      (requiresDealSlot && typeof suppliedDealSlot !== 'number') ||
      !Number.isInteger(dealSlot) ||
      dealSlot < 1 ||
      dealSlot > 7
    ) {
      return null
    }
    cards.push({
      cardInstanceId,
      cardType: cardType as CardType,
      grade: grade as CardGrade,
      dealSlot,
      name: cardDisplayName(cardType as CardType),
      effectSummary: cardEffectSummary(cardType as CardType),
    })
  }
  const distinctIds = new Set(cards.map((card) => card.cardInstanceId))
  const distinctSlots = new Set(cards.map((card) => card.dealSlot))
  return distinctIds.size === cards.length && distinctSlots.size === cards.length ? cards.sort((left, right) => left.dealSlot - right.dealSlot) : null
}

/** Builds the owner-private hand-selection view without deriving an offer locally. */
export function selectHandSelectionView(state: GameStateView | null): HandSelectionView {
  if (!state) return { kind: 'unavailable', reason: 'Game state is not loaded yet.' }

  const accepted = hasAcceptedSubmission(state, { eraNumber: state.eraNumber, kind: 'HAND_SELECTION' })
  const acceptedCards = parseCards(state.raw['myHand'], false)
  if (accepted && acceptedCards && acceptedCards.length === 5) {
    return { kind: 'accepted', eraNumber: state.eraNumber, cards: acceptedCards }
  }

  if (state.phase !== 'HAND_SELECTION') {
    return { kind: 'unavailable', reason: 'No hand-selection window is currently open.' }
  }
  const pending = state.raw['pendingHandSelection']
  if (typeof pending !== 'object' || pending === null) {
    return { kind: 'unavailable', reason: 'Your private card offer is being refreshed.' }
  }
  const source = pending as Record<string, unknown>
  const cards = parseCards(source['cards'], true)
  if (!cards || cards.length !== 7 || source['requiredSelectionCount'] !== 5) {
    return { kind: 'unavailable', reason: 'Your private card offer is incomplete. Refreshing authoritative state.' }
  }
  const expiresAt = stringField(source['expiresAt'])
  if (!expiresAt) {
    return { kind: 'unavailable', reason: 'The hand-selection deadline is being refreshed.' }
  }
  return { kind: 'open', gameId: state.gameId, eraNumber: state.eraNumber, cards, requiredSelectionCount: 5, expiresAt }
}
