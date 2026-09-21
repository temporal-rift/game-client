/**
 * Builds the entitled-knowledge display view from authoritative game state.
 * `raw` carries `publicBands`/`myRevealedIntel`/`declarations`/`exposeFacts`
 * unparsed (the shared game-state client only validates the reconciliation
 * envelope), so this module parses its own slice — mirroring how
 * `actionView.ts` and `resultsView.ts` read their own `raw` fields.
 *
 * Public bands never carry or synthesize an exact weight — only a
 * Low/Medium/High/Unknown band and the round it was observed in. Exact
 * weights appear only inside `myRevealedIntel`, which the server already
 * scopes to the caller's own entitled reveals (Scan/Trace/Intercept), and
 * which is cleared at era end — every entry's `expiresAtEraEnd` names the
 * current era so the display can show that expiry alongside its age.
 */

import { CARD_GRADES, CARD_TYPES } from '../api/actionClient'
import type { CardGrade, CardType } from '../api/actionClient'
import type { GameStateView } from '../api/gameStateClient'
import { stringField } from '../api/httpJson'
import { cardDisplayName, specialDisplayName } from '../action/actionRules'
import type { ProbabilityBand } from '../types/playerView'

export type { ProbabilityBand }

export interface BandOutcomeEntry {
  readonly outcomeId: string
  readonly outcomeDescription: string
  readonly band: ProbabilityBand
}

export interface EventBandEntry {
  readonly eventId: string
  readonly eventTitle: string
  readonly observedInRound: number
  readonly outcomes: readonly BandOutcomeEntry[]
}

export interface RevealedProbabilityOutcome {
  readonly outcomeId: string
  readonly outcomeDescription: string
  readonly probability: number
  readonly isAnnihilated: boolean
  readonly isSealed: boolean
}

export interface RevealedCard {
  readonly cardInstanceId: string
  readonly cardType: CardType
  readonly cardName: string
  readonly grade: CardGrade
}

export type RevealedKnowledgeEntry =
  | {
      readonly kind: 'PROBABILITY'
      readonly eventId: string
      readonly eventTitle: string
      readonly observedInRound: number
      readonly expiresAtEraEnd: number
      readonly outcomes: readonly RevealedProbabilityOutcome[]
    }
  | {
      readonly kind: 'INFLUENCE'
      readonly eventId: string
      readonly eventTitle: string
      readonly observedInRound: number
      readonly expiresAtEraEnd: number
      readonly influencerNames: readonly string[]
    }
  | {
      readonly kind: 'HAND_CARD'
      readonly targetPlayerId: string
      readonly targetPlayerName: string
      readonly observedInRound: number
      readonly expiresAtEraEnd: number
      readonly revealedCards: readonly RevealedCard[]
    }

export interface DeclarationEntry {
  readonly playerId: string
  readonly playerName: string
  readonly mode: 'RALLY' | 'MOMENTUM'
  readonly modeName: string
  readonly eventId: string
  readonly eventTitle: string
  readonly outcomeId: string
  readonly outcomeDescription: string
  readonly eraNumber: number
}

export interface ExposeFactEntry {
  readonly activistPlayerId: string
  readonly activistPlayerName: string
  readonly targetPlayerId: string
  readonly targetPlayerName: string
  readonly roundNumber: number
  readonly signatureCardName: string | null
  readonly signatureEventTitle: string | null
  readonly behaviorChanged: boolean
}

export type KnowledgeView =
  | { readonly kind: 'unavailable'; readonly reason: string }
  | {
      readonly kind: 'ready'
      readonly gameId: string
      readonly eraNumber: number
      readonly bands: readonly EventBandEntry[]
      readonly revealedKnowledge: readonly RevealedKnowledgeEntry[]
      readonly declarations: readonly DeclarationEntry[]
      readonly exposeFacts: readonly ExposeFactEntry[]
    }

const KNOWN_CARD_TYPES: ReadonlySet<string> = new Set(CARD_TYPES)
const KNOWN_GRADES: ReadonlySet<string> = new Set(CARD_GRADES)
const KNOWN_BANDS: ReadonlySet<string> = new Set(['LOW', 'MEDIUM', 'HIGH'])
const KNOWN_MODES: ReadonlySet<string> = new Set(['RALLY', 'MOMENTUM'])

function parseCardType(value: unknown): CardType | null {
  return typeof value === 'string' && KNOWN_CARD_TYPES.has(value) ? (value as CardType) : null
}

function parseGrade(value: unknown): CardGrade | null {
  return typeof value === 'string' && KNOWN_GRADES.has(value) ? (value as CardGrade) : null
}

/** Never invents a band: any value outside the recognized published set reads as unknown. */
function parseBand(value: unknown): ProbabilityBand {
  if (typeof value === 'string' && KNOWN_BANDS.has(value)) {
    return value.toLowerCase() as ProbabilityBand
  }
  return 'unknown'
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null
}

interface EventLookupEntry {
  readonly title: string
  readonly outcomes: ReadonlyMap<string, string>
}

function outcomeDescriptionsFrom(value: unknown): ReadonlyMap<string, string> {
  const outcomes = new Map<string, string>()
  if (!Array.isArray(value)) {
    return outcomes
  }
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }
    const source = entry as Record<string, unknown>
    const outcomeId = stringField(source['outcomeId'])
    const description = stringField(source['description'])
    if (outcomeId && description) {
      outcomes.set(outcomeId, description)
    }
  }
  return outcomes
}

function activeEventLookup(raw: Record<string, unknown>): ReadonlyMap<string, EventLookupEntry> {
  const lookup = new Map<string, EventLookupEntry>()
  const value = raw['activeEvents']
  if (!Array.isArray(value)) {
    return lookup
  }
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }
    const source = entry as Record<string, unknown>
    const eventId = stringField(source['eventId'])
    const title = stringField(source['title'])
    if (!eventId || !title) {
      continue
    }
    lookup.set(eventId, { title, outcomes: outcomeDescriptionsFrom(source['outcomes']) })
  }
  return lookup
}

function playerNameLookup(raw: Record<string, unknown>): ReadonlyMap<string, string> {
  const lookup = new Map<string, string>()
  const value = raw['players']
  if (!Array.isArray(value)) {
    return lookup
  }
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }
    const source = entry as Record<string, unknown>
    const playerId = stringField(source['playerId'])
    const playerName = stringField(source['playerName'])
    if (playerId && playerName) {
      lookup.set(playerId, playerName)
    }
  }
  return lookup
}

function nameFor(playerId: string, lookup: ReadonlyMap<string, string>): string {
  return lookup.get(playerId) ?? `Player ${playerId.slice(0, 8)}`
}

function titleFor(eventId: string, lookup: ReadonlyMap<string, EventLookupEntry>): string {
  return lookup.get(eventId)?.title ?? `Event ${eventId.slice(0, 8)}`
}

function outcomeDescriptionFor(eventId: string, outcomeId: string, lookup: ReadonlyMap<string, EventLookupEntry>): string {
  return lookup.get(eventId)?.outcomes.get(outcomeId) ?? `Outcome ${outcomeId.slice(0, 8)}`
}

function parseBandOutcomes(value: unknown, eventId: string, eventLookup: ReadonlyMap<string, EventLookupEntry>): readonly BandOutcomeEntry[] {
  if (!Array.isArray(value)) {
    return []
  }
  const outcomes: BandOutcomeEntry[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }
    const source = entry as Record<string, unknown>
    const outcomeId = stringField(source['outcomeId'])
    if (!outcomeId) {
      continue
    }
    outcomes.push({
      outcomeId,
      outcomeDescription: outcomeDescriptionFor(eventId, outcomeId, eventLookup),
      band: parseBand(source['band']),
    })
  }
  return outcomes
}

function parseBands(value: unknown, eventLookup: ReadonlyMap<string, EventLookupEntry>): readonly EventBandEntry[] {
  if (!Array.isArray(value)) {
    return []
  }
  const entries: EventBandEntry[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }
    const source = entry as Record<string, unknown>
    const eventId = stringField(source['eventId'])
    const observedInRound = nullableNumber(source['observedInRound'])
    if (!eventId || observedInRound === null) {
      continue
    }
    entries.push({
      eventId,
      eventTitle: titleFor(eventId, eventLookup),
      observedInRound,
      outcomes: parseBandOutcomes(source['outcomes'], eventId, eventLookup),
    })
  }
  return entries
}

function parseRevealedProbabilityOutcomes(
  value: unknown,
  eventId: string,
  eventLookup: ReadonlyMap<string, EventLookupEntry>,
): readonly RevealedProbabilityOutcome[] {
  if (!Array.isArray(value)) {
    return []
  }
  const outcomes: RevealedProbabilityOutcome[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }
    const source = entry as Record<string, unknown>
    const outcomeId = stringField(source['outcomeId'])
    const probability = nullableNumber(source['probability'])
    if (!outcomeId || probability === null) {
      continue
    }
    outcomes.push({
      outcomeId,
      outcomeDescription: outcomeDescriptionFor(eventId, outcomeId, eventLookup),
      probability,
      isAnnihilated: source['isAnnihilated'] === true,
      isSealed: source['isSealed'] === true,
    })
  }
  return outcomes
}

function parseRevealedCards(value: unknown): readonly RevealedCard[] {
  if (!Array.isArray(value)) {
    return []
  }
  const cards: RevealedCard[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }
    const source = entry as Record<string, unknown>
    const cardInstanceId = stringField(source['cardInstanceId'])
    const cardType = parseCardType(source['cardType'])
    const grade = parseGrade(source['grade'])
    if (!cardInstanceId || !cardType || !grade) {
      continue
    }
    cards.push({ cardInstanceId, cardType, cardName: cardDisplayName(cardType), grade })
  }
  return cards
}

function parseRevealedKnowledge(
  value: unknown,
  eventLookup: ReadonlyMap<string, EventLookupEntry>,
  playerLookup: ReadonlyMap<string, string>,
  eraNumber: number,
): readonly RevealedKnowledgeEntry[] {
  if (!Array.isArray(value)) {
    return []
  }
  const entries: RevealedKnowledgeEntry[] = []
  for (const entry of value) {
    const parsed = parseRevealedKnowledgeEntry(entry, eventLookup, playerLookup, eraNumber)
    if (parsed) {
      entries.push(parsed)
    }
  }
  return entries
}

function parseProbabilityEntry(
  source: Record<string, unknown>,
  observedInRound: number,
  eraNumber: number,
  eventLookup: ReadonlyMap<string, EventLookupEntry>,
): RevealedKnowledgeEntry | null {
  const eventId = stringField(source['eventId'])
  if (!eventId) {
    return null
  }
  return {
    kind: 'PROBABILITY',
    eventId,
    eventTitle: titleFor(eventId, eventLookup),
    observedInRound,
    expiresAtEraEnd: eraNumber,
    outcomes: parseRevealedProbabilityOutcomes(source['outcomes'], eventId, eventLookup),
  }
}

function parseInfluenceEntry(
  source: Record<string, unknown>,
  observedInRound: number,
  eraNumber: number,
  eventLookup: ReadonlyMap<string, EventLookupEntry>,
  playerLookup: ReadonlyMap<string, string>,
): RevealedKnowledgeEntry | null {
  const eventId = stringField(source['eventId'])
  if (!eventId) {
    return null
  }
  const influencerIds = Array.isArray(source['influencerPlayerIds'])
    ? source['influencerPlayerIds'].filter((id): id is string => typeof id === 'string')
    : []
  return {
    kind: 'INFLUENCE',
    eventId,
    eventTitle: titleFor(eventId, eventLookup),
    observedInRound,
    expiresAtEraEnd: eraNumber,
    influencerNames: influencerIds.map((id) => nameFor(id, playerLookup)),
  }
}

function parseHandCardEntry(
  source: Record<string, unknown>,
  observedInRound: number,
  eraNumber: number,
  playerLookup: ReadonlyMap<string, string>,
): RevealedKnowledgeEntry | null {
  const targetPlayerId = stringField(source['targetPlayerId'])
  if (!targetPlayerId) {
    return null
  }
  return {
    kind: 'HAND_CARD',
    targetPlayerId,
    targetPlayerName: nameFor(targetPlayerId, playerLookup),
    observedInRound,
    expiresAtEraEnd: eraNumber,
    revealedCards: parseRevealedCards(source['revealedCards']),
  }
}

function parseRevealedKnowledgeEntry(
  entry: unknown,
  eventLookup: ReadonlyMap<string, EventLookupEntry>,
  playerLookup: ReadonlyMap<string, string>,
  eraNumber: number,
): RevealedKnowledgeEntry | null {
  if (typeof entry !== 'object' || entry === null) {
    return null
  }
  const source = entry as Record<string, unknown>
  const observedInRound = nullableNumber(source['observedInRound'])
  if (observedInRound === null) {
    return null
  }
  const kind = source['kind']
  if (kind === 'PROBABILITY') {
    return parseProbabilityEntry(source, observedInRound, eraNumber, eventLookup)
  }
  if (kind === 'INFLUENCE') {
    return parseInfluenceEntry(source, observedInRound, eraNumber, eventLookup, playerLookup)
  }
  if (kind === 'HAND_CARD') {
    return parseHandCardEntry(source, observedInRound, eraNumber, playerLookup)
  }
  return null
}

function parseDeclarations(
  value: unknown,
  eventLookup: ReadonlyMap<string, EventLookupEntry>,
  playerLookup: ReadonlyMap<string, string>,
): readonly DeclarationEntry[] {
  if (!Array.isArray(value)) {
    return []
  }
  const entries: DeclarationEntry[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }
    const source = entry as Record<string, unknown>
    const playerId = stringField(source['playerId'])
    const mode = source['mode']
    const eventId = stringField(source['targetEventId'])
    const outcomeId = stringField(source['targetOutcomeId'])
    const eraNumber = nullableNumber(source['eraNumber'])
    if (!playerId || typeof mode !== 'string' || !KNOWN_MODES.has(mode) || !eventId || !outcomeId || eraNumber === null) {
      continue
    }
    const knownMode = mode as 'RALLY' | 'MOMENTUM'
    entries.push({
      playerId,
      playerName: nameFor(playerId, playerLookup),
      mode: knownMode,
      modeName: specialDisplayName(knownMode),
      eventId,
      eventTitle: titleFor(eventId, eventLookup),
      outcomeId,
      outcomeDescription: outcomeDescriptionFor(eventId, outcomeId, eventLookup),
      eraNumber,
    })
  }
  return entries
}

function parseSignature(
  value: unknown,
  eventLookup: ReadonlyMap<string, EventLookupEntry>,
): { readonly signatureCardName: string | null; readonly signatureEventTitle: string | null } {
  if (typeof value !== 'object' || value === null) {
    return { signatureCardName: null, signatureEventTitle: null }
  }
  const source = value as Record<string, unknown>
  const cardType = parseCardType(source['type'])
  const eventId = stringField(source['targetEventId'])
  return {
    signatureCardName: cardType ? cardDisplayName(cardType) : null,
    signatureEventTitle: eventId ? titleFor(eventId, eventLookup) : null,
  }
}

function parseExposeFacts(
  value: unknown,
  eventLookup: ReadonlyMap<string, EventLookupEntry>,
  playerLookup: ReadonlyMap<string, string>,
): readonly ExposeFactEntry[] {
  if (!Array.isArray(value)) {
    return []
  }
  const entries: ExposeFactEntry[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }
    const source = entry as Record<string, unknown>
    const activistPlayerId = stringField(source['activistPlayerId'])
    const targetPlayerId = stringField(source['targetPlayerId'])
    const roundNumber = nullableNumber(source['roundNumber'])
    if (!activistPlayerId || !targetPlayerId || roundNumber === null) {
      continue
    }
    const signature = parseSignature(source['signature'], eventLookup)
    entries.push({
      activistPlayerId,
      activistPlayerName: nameFor(activistPlayerId, playerLookup),
      targetPlayerId,
      targetPlayerName: nameFor(targetPlayerId, playerLookup),
      roundNumber,
      ...signature,
      behaviorChanged: source['behaviorChanged'] === true,
    })
  }
  return entries
}

/**
 * Selects the entitled-knowledge view for the current participant. Public
 * bands and already-broadcast declaration/Expose facts are rendered exactly
 * as published — never with a synthesized weight for an unlisted or
 * unrecognized band. Earned knowledge comes only from the caller's own
 * server-scoped `myRevealedIntel`, labeled with the round it was observed in
 * and the era it expires at end of.
 */
export function selectKnowledgeView(state: GameStateView | null): KnowledgeView {
  if (!state) {
    return { kind: 'unavailable', reason: 'Game state is not loaded yet.' }
  }
  const raw = state.raw
  const eventLookup = activeEventLookup(raw)
  const playerLookup = playerNameLookup(raw)
  return {
    kind: 'ready',
    gameId: state.gameId,
    eraNumber: state.eraNumber,
    bands: parseBands(raw['publicBands'], eventLookup),
    revealedKnowledge: parseRevealedKnowledge(raw['myRevealedIntel'], eventLookup, playerLookup, state.eraNumber),
    declarations: parseDeclarations(raw['declarations'], eventLookup, playerLookup),
    exposeFacts: parseExposeFacts(raw['exposeFacts'], eventLookup, playerLookup),
  }
}
