/**
 * Structural targeting rules shared by every card/special: which coordinate
 * shape a card type or faction special requires, which faction owns which
 * specials, and player-safe effect/name labels. These are fixed contract
 * facts (verified against game-service's submission validation), never
 * game-balance magnitudes — those stay server-configured and are never
 * asserted here. Availability comes from the server's per-round report in
 * `actionView.ts`; this module only maps the reported reason to player-safe text.
 */

import type { CardCategory, CardGrade, CardType, Faction, SpecialAction } from '../api/action'
import type { SpecialActionUnavailableReason } from '../api/projection'

export type { CardCategory } from '../api/action'
export { CARD_CATEGORIES } from '../api/action'

export type TargetMode =
  | 'EVENT_OUTCOME'
  | 'EVENT_OUTCOME_PAIR'
  | 'EVENT_LIST'
  | 'PLAYER'
  | 'PLAYER_LIST'
  | 'EVENT_ONLY'
  | 'DISGUISE'
  | 'NONE'

const PLAYER_TARGETING_CARD_TYPES: ReadonlySet<CardType> = new Set(['REDIRECT', 'AMPLIFY', 'JAM', 'INTERCEPT'])
const PLAYER_LIST_TARGET_CARD_TYPES: ReadonlySet<CardType> = new Set(['NULLIFY'])
const TWO_OUTCOME_CARD_TYPES: ReadonlySet<CardType> = new Set(['SWING', 'COLLIDE'])
const LIST_TARGET_CARD_TYPES: ReadonlySet<CardType> = new Set(['SCAN'])
const DISGUISE_ONLY_CARD_TYPES: ReadonlySet<CardType> = new Set(['DECOY'])

/** The coordinate shape a card type requires: player, player list, event list, two-outcome, disguise-only, or scalar event+outcome. */
export function cardTargetMode(cardType: CardType): TargetMode {
  if (DISGUISE_ONLY_CARD_TYPES.has(cardType)) {
    return 'DISGUISE'
  }
  if (PLAYER_TARGETING_CARD_TYPES.has(cardType)) {
    return 'PLAYER'
  }
  if (PLAYER_LIST_TARGET_CARD_TYPES.has(cardType)) {
    return 'PLAYER_LIST'
  }
  if (TWO_OUTCOME_CARD_TYPES.has(cardType)) {
    return 'EVENT_OUTCOME_PAIR'
  }
  if (LIST_TARGET_CARD_TYPES.has(cardType)) {
    return 'EVENT_LIST'
  }
  return 'EVENT_OUTCOME'
}

const PLAYER_TARGETING_SPECIALS: ReadonlySet<SpecialAction> = new Set(['CORRUPT', 'EXPOSE'])
const EVENT_ONLY_SPECIALS: ReadonlySet<SpecialAction> = new Set(['FULFILLMENT'])
const NO_TARGET_SPECIALS: ReadonlySet<SpecialAction> = new Set(['OBSCURE', 'TAPESTRY'])
const DECLARATION_ONLY_SPECIALS: ReadonlySet<SpecialAction> = new Set(['RALLY', 'MOMENTUM'])

/**
 * The coordinate shape a special action requires. Thread anchors a
 * not-yet-resolved current-era outcome as its chain's next link, and Reweave
 * moves that pending link to another one — each an ordinary
 * `targetEventId`/`targetOutcomeId` pair, exactly like Foresight,
 * Annihilate, Seal, Rewrite, Mimic and Cascade (verified against
 * game-service's `SpecialActionSubmission.validate()`, which unconditionally
 * rejects `sourceEventId`/`sourceOutcomeId` for every special action).
 */
export function specialTargetMode(specialAction: SpecialAction): TargetMode {
  if (PLAYER_TARGETING_SPECIALS.has(specialAction)) {
    return 'PLAYER'
  }
  if (EVENT_ONLY_SPECIALS.has(specialAction)) {
    return 'EVENT_ONLY'
  }
  if (NO_TARGET_SPECIALS.has(specialAction)) {
    return 'NONE'
  }
  return 'EVENT_OUTCOME'
}

/** Rally and Momentum are accepted only by the pre-Round-1 declaration endpoint, never here. */
export function isDeclarationOnlySpecial(specialAction: SpecialAction): boolean {
  return DECLARATION_ONLY_SPECIALS.has(specialAction)
}

export const FACTION_SPECIALS: Readonly<Record<Faction, readonly SpecialAction[]>> = {
  ERASERS: ['ANNIHILATE', 'CORRUPT', 'CASCADE'],
  PROPHETS: ['FORESIGHT', 'SEAL', 'FULFILLMENT'],
  REVISIONISTS: ['REWRITE', 'MIMIC', 'OBSCURE'],
  WEAVERS: ['THREAD', 'TAPESTRY', 'REWEAVE'],
  ACTIVISTS: ['RALLY', 'EXPOSE', 'MOMENTUM'],
}

/** Scan names one event per grade step: I one, II two, III all three active events. */
const SCAN_EVENT_COUNT: Readonly<Record<CardGrade, number>> = { I: 1, II: 2, III: 3 }

/** Nullify names one opponent at grade I and two distinct opponents at grade II; it has no grade III. */
const NULLIFY_PLAYER_COUNT: Readonly<Partial<Record<CardGrade, number>>> = { I: 1, II: 2 }

/**
 * How many entries a list-targeting card names at its grade, or null when the
 * card does not target a list or does not exist at that grade.
 */
export function cardTargetListSize(cardType: CardType, grade: CardGrade): number | null {
  if (LIST_TARGET_CARD_TYPES.has(cardType)) {
    return SCAN_EVENT_COUNT[grade]
  }
  if (PLAYER_LIST_TARGET_CARD_TYPES.has(cardType)) {
    return NULLIFY_PLAYER_COUNT[grade] ?? null
  }
  return null
}

const CARD_NAMES: Readonly<Record<CardType, string>> = {
  PUSH: 'Push',
  SUPPRESS: 'Suppress',
  SWING: 'Swing',
  AMPLIFY: 'Amplify',
  INTERCEPT: 'Intercept',
  SCAN: 'Scan',
  TRACE: 'Trace',
  DECOY: 'Decoy',
  JAM: 'Jam',
  STALL: 'Stall',
  REDIRECT: 'Redirect',
  NULLIFY: 'Nullify',
  COLLIDE: 'Collide',
  STABILIZE: 'Stabilize',
  DETONATE: 'Detonate',
}

/** Player-safe, grade-relative effect summaries. Exact magnitudes are server-configured, never asserted here. */
const CARD_EFFECTS: Readonly<Record<CardType, string>> = {
  PUSH: "Increases the targeted outcome's probability; higher grades push harder.",
  SUPPRESS: "Decreases the targeted outcome's probability; higher grades suppress harder.",
  SWING: 'Shifts probability from one outcome to another on the same event; higher grades shift more.',
  AMPLIFY: "Multiplies a targeted player's card effect this round; higher grades multiply more.",
  INTERCEPT: "Reveals a targeted player's hand cards; higher grades reveal more.",
  SCAN: 'Reveals exact probabilities for the targeted events; higher grades cover more events.',
  TRACE: "Reveals who influenced an event's probability; higher grades cover more events.",
  DECOY: 'Declares a disguise category with no other effect; the round summary shows the disguise.',
  JAM: "Blocks a targeted player's faction specials next round; they can still play cards.",
  STALL: "Delays an event's resolution.",
  REDIRECT: "Redirects a named player's Push, Suppress or Swing to the next eligible outcome in its event.",
  NULLIFY: "Cancels each named player's eligible action this round; grade II names two players.",
  COLLIDE: 'Equalizes two selected outcome weights on the same event; a surviving leading tie can create a Dead Heat.',
  STABILIZE: 'Clears an event’s paradoxes without changing its weights, allowing the ordinary weighted draw.',
  DETONATE: 'If the targeted event cascades, you take the base penalty while other players take the larger penalty.',
}

export function cardDisplayName(cardType: CardType): string {
  return CARD_NAMES[cardType]
}

const CARD_CATEGORY_NAMES: Readonly<Record<CardCategory, string>> = {
  PROBABILITY_SHIFTER: 'Probability shifter',
  INFORMATION: 'Information',
  DISRUPTION: 'Disruption',
  PARADOX: 'Paradox',
}

export function cardCategoryDisplayName(category: CardCategory): string {
  return CARD_CATEGORY_NAMES[category]
}

export function cardEffectSummary(cardType: CardType): string {
  return CARD_EFFECTS[cardType]
}

const SPECIAL_NAMES: Readonly<Record<SpecialAction, string>> = {
  ANNIHILATE: 'Annihilate',
  CORRUPT: 'Corrupt',
  CASCADE: 'Cascade',
  FORESIGHT: 'Foresight',
  SEAL: 'Seal',
  FULFILLMENT: 'Fulfillment',
  REWRITE: 'Rewrite',
  MIMIC: 'Mimic',
  OBSCURE: 'Obscure',
  THREAD: 'Thread',
  TAPESTRY: 'Tapestry',
  REWEAVE: 'Reweave',
  RALLY: 'Rally',
  EXPOSE: 'Expose',
  MOMENTUM: 'Momentum',
}

const SPECIAL_EFFECTS: Readonly<Record<SpecialAction, string>> = {
  ANNIHILATE: 'Removes a targeted outcome from an event entirely.',
  CORRUPT: "Inverts a targeted player's card played this round.",
  CASCADE: 'Automatically carries an erasure forward into next era.',
  FORESIGHT:
    "Views next era's events privately; against a current-era target it also declares that event's written outcome.",
  SEAL: "Locks a targeted outcome's probability through era end.",
  FULFILLMENT: 'Declares a target event before resolution for doubled score if it resolves as written.',
  REWRITE: 'Declares your secret preferred outcome for this era, replacing any earlier preference.',
  MIMIC: 'Copies the strongest same-round Push or inward Swing onto your chosen outcome, if one exists.',
  OBSCURE: 'Disguises you next round: Intercepts on you show decoy cards and Traces of that round leave you out.',
  THREAD: "Anchors a not-yet-resolved current-era outcome as your chain's next link.",
  TAPESTRY: "Arms protection for your chain's newest link.",
  REWEAVE: 'Moves your pending chain link to a different unresolved current-era outcome; it still has to win.',
  RALLY: 'Publicly backs an outcome and boosts inward Round 1 transfers onto it; uses your Round 1 action.',
  MOMENTUM: 'Publicly backs an outcome with a one-time probability boost after a successful prior-era declaration; uses your Round 1 action.',
  EXPOSE: "Reveals a targeted player's Round 1 probability-shifting signature.",
}

export function specialDisplayName(specialAction: SpecialAction): string {
  return SPECIAL_NAMES[specialAction]
}

export function specialEffectSummary(specialAction: SpecialAction): string {
  return SPECIAL_EFFECTS[specialAction]
}

/**
 * Player-safe text for a server-reported unavailability reason. The server
 * owns every availability rule; the client only explains its verdict.
 */
export function specialUnavailableReasonLabel(reason: SpecialActionUnavailableReason, roundNumber: number): string {
  switch (reason) {
    case 'JAMMED':
      return 'You are jammed this round.'
    case 'DECLARATION_WINDOW_ONLY':
      return 'Only usable in the declaration window.'
    case 'NOT_ELIGIBLE_THIS_ERA':
      return 'Not usable in the final era.'
    case 'NOT_ELIGIBLE_THIS_ROUND':
      return `Not usable in Action Round ${roundNumber}.`
    case 'GAME_BUDGET_EXHAUSTED':
      return 'No uses left this game.'
    case 'ERA_BUDGET_EXHAUSTED':
      return 'Already used this era.'
  }
}
