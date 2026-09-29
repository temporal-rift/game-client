/**
 * Builds the entitled-knowledge display view from authoritative,
 * contract-validated game state.
 *
 * Public bands never carry or synthesize an exact weight — only a
 * Low/Medium/High band and the round it was observed in. Exact
 * weights appear only inside `myRevealedIntel`, which the server already
 * scopes to the caller's own entitled reveals (Scan/Trace/Intercept), and
 * which is cleared at era end — every entry's `expiresAtEraEnd` names the
 * current era so the display can show that expiry alongside its age.
 */

import { isCardType, type CardGrade, type CardType } from '../api/action'
import type { ActiveEvent, ExposeFact, GameStateView, PublicBandEvent, PublicDeclaration, RevealedIntel } from '../api/projection'
import { nameFor, playerNameLookup } from '../game/playerNames'
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

interface EventLookupEntry {
  readonly title: string
  readonly outcomes: ReadonlyMap<string, string>
}

function activeEventLookup(events: readonly ActiveEvent[]): ReadonlyMap<string, EventLookupEntry> {
  return new Map(
    events.map((event) => [
      event.eventId,
      { title: event.title, outcomes: new Map(event.outcomes.map((outcome) => [outcome.outcomeId, outcome.description])) },
    ]),
  )
}

function titleFor(eventId: string, lookup: ReadonlyMap<string, EventLookupEntry>): string {
  return lookup.get(eventId)?.title || `Event ${eventId.slice(0, 8)}`
}

function outcomeDescriptionFor(eventId: string, outcomeId: string, lookup: ReadonlyMap<string, EventLookupEntry>): string {
  return lookup.get(eventId)?.outcomes.get(outcomeId) || `Outcome ${outcomeId.slice(0, 8)}`
}

function bandEntries(bands: readonly PublicBandEvent[], eventLookup: ReadonlyMap<string, EventLookupEntry>): readonly EventBandEntry[] {
  return bands.map(({ eventId, observedInRound, outcomes }) => ({
    eventId,
    eventTitle: titleFor(eventId, eventLookup),
    observedInRound,
    outcomes: outcomes.map(({ outcomeId, band }) => ({
      outcomeId,
      outcomeDescription: outcomeDescriptionFor(eventId, outcomeId, eventLookup),
      band: band.toLowerCase() as Lowercase<typeof band>,
    })),
  }))
}

function revealedCards(cards: NonNullable<RevealedIntel['revealedCards']>): readonly RevealedCard[] {
  return cards.flatMap(({ cardInstanceId, cardType, grade }) =>
    isCardType(cardType) ? [{ cardInstanceId, cardType, cardName: cardDisplayName(cardType), grade }] : [],
  )
}

/** Earned knowledge expires at the end of the era it was observed in. */
function revealedKnowledgeEntry(
  intel: RevealedIntel,
  eventLookup: ReadonlyMap<string, EventLookupEntry>,
  playerLookup: ReadonlyMap<string, string>,
  eraNumber: number,
): RevealedKnowledgeEntry | null {
  const { kind, eventId, observedInRound } = intel
  switch (kind) {
    case 'PROBABILITY':
      return {
        kind,
        eventId,
        eventTitle: titleFor(eventId, eventLookup),
        observedInRound,
        expiresAtEraEnd: eraNumber,
        outcomes: (intel.outcomes ?? []).map(({ outcomeId, probability, isAnnihilated, isSealed }) => ({
          outcomeId,
          outcomeDescription: outcomeDescriptionFor(eventId, outcomeId, eventLookup),
          probability,
          isAnnihilated,
          isSealed,
        })),
      }
    case 'INFLUENCE':
      return {
        kind,
        eventId,
        eventTitle: titleFor(eventId, eventLookup),
        observedInRound,
        expiresAtEraEnd: eraNumber,
        influencerNames: (intel.influencerPlayerIds ?? []).map((id) => nameFor(id, playerLookup)),
      }
    case 'HAND_CARD':
      // A hand reveal names whose hand it is; without that there is nothing to attribute.
      return intel.targetPlayerId
        ? {
            kind,
            targetPlayerId: intel.targetPlayerId,
            targetPlayerName: nameFor(intel.targetPlayerId, playerLookup),
            observedInRound,
            expiresAtEraEnd: eraNumber,
            revealedCards: revealedCards(intel.revealedCards ?? []),
          }
        : null
  }
}

function declarationEntries(
  declarations: readonly PublicDeclaration[],
  eventLookup: ReadonlyMap<string, EventLookupEntry>,
  playerLookup: ReadonlyMap<string, string>,
): readonly DeclarationEntry[] {
  return declarations.map(({ playerId, mode, targetEventId, targetOutcomeId, eraNumber }) => ({
    playerId,
    playerName: nameFor(playerId, playerLookup),
    mode,
    modeName: specialDisplayName(mode),
    eventId: targetEventId,
    eventTitle: titleFor(targetEventId, eventLookup),
    outcomeId: targetOutcomeId,
    outcomeDescription: outcomeDescriptionFor(targetEventId, targetOutcomeId, eventLookup),
    eraNumber,
  }))
}

function exposeFactEntries(
  facts: readonly ExposeFact[],
  eventLookup: ReadonlyMap<string, EventLookupEntry>,
  playerLookup: ReadonlyMap<string, string>,
): readonly ExposeFactEntry[] {
  return facts.map(({ activistPlayerId, targetPlayerId, roundNumber, signature, behaviorChanged }) => ({
    activistPlayerId,
    activistPlayerName: nameFor(activistPlayerId, playerLookup),
    targetPlayerId,
    targetPlayerName: nameFor(targetPlayerId, playerLookup),
    roundNumber,
    signatureCardName: signature ? cardDisplayName(signature.type) : null,
    signatureEventTitle: signature ? titleFor(signature.targetEventId, eventLookup) : null,
    behaviorChanged,
  }))
}

/**
 * Selects the entitled-knowledge view for the current participant. Public
 * bands and already-broadcast declaration/Expose facts are rendered exactly
 * as published — never with a synthesized weight. Earned knowledge comes
 * only from the caller's own server-scoped `myRevealedIntel`, labeled with
 * the round it was observed in and the era it expires at end of.
 */
export function selectKnowledgeView(state: GameStateView | null): KnowledgeView {
  if (!state) {
    return { kind: 'unavailable', reason: 'Game state is not loaded yet.' }
  }
  const eventLookup = activeEventLookup(state.activeEvents)
  const playerLookup = playerNameLookup(state)
  return {
    kind: 'ready',
    gameId: state.gameId,
    eraNumber: state.eraNumber,
    bands: bandEntries(state.publicBands ?? [], eventLookup),
    revealedKnowledge: state.myRevealedIntel.flatMap((intel) => {
      const entry = revealedKnowledgeEntry(intel, eventLookup, playerLookup, state.eraNumber)
      return entry ? [entry] : []
    }),
    declarations: declarationEntries(state.declarations ?? [], eventLookup, playerLookup),
    exposeFacts: exposeFactEntries(state.exposeFacts ?? [], eventLookup, playerLookup),
  }
}
