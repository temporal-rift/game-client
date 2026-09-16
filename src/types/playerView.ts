export type ProbabilityBand = 'low' | 'medium' | 'high' | 'unknown'

export type EventArtwork = 'delegate' | 'reactor' | 'pact'

export type CardKind = 'push' | 'suppress' | 'scan' | 'nullify' | 'collide'

export interface EventOutcome {
  readonly id: string
  readonly label: string
  readonly publicBand: ProbabilityBand
  readonly isValidTarget: boolean
}

export interface EventBoardEntry {
  readonly id: string
  readonly era: number
  readonly title: string
  readonly artwork: EventArtwork
  readonly status: 'resolved' | 'in-progress' | 'upcoming'
  readonly outcomes: readonly EventOutcome[]
}

export interface HandCard {
  readonly id: string
  readonly name: string
  readonly grade: number
  readonly description: string
  readonly kind: CardKind
  readonly isAvailable: boolean
  readonly unavailableReason?: string
}

export interface KnowledgeItem {
  readonly id: string
  readonly label: string
  readonly detail: string
  readonly scope: 'public' | 'private'
  readonly ageLabel: string
}

export interface FactionIntel {
  readonly factionName: string
  readonly description: string
  readonly score: number
  readonly scoreThreshold: number
  readonly specialName: string
  readonly specialRemainingUses: number
  readonly factionsInGame: readonly string[]
  readonly knowledge: readonly KnowledgeItem[]
}

export interface PlayerSummary {
  readonly id: string
  readonly displayName: string
  readonly score: number
  readonly isCurrentPlayer: boolean
}

export interface RoundStatus {
  readonly submittedPlayers: number
  readonly totalPlayers: number
  readonly hasSubmitted: boolean
}

export interface PendingActionSelection {
  readonly cardId: string
  readonly targetId: string
  readonly confirmLabel: string
}

export interface PlayerView {
  readonly gameId: string
  readonly gameLabel: string
  readonly currentEra: number
  readonly currentRound: number
  readonly roundsPerEra: number
  readonly phaseLabel: string
  readonly phaseDeadlineLabel: string | null
  readonly publicBandAgeLabel: string
  readonly players: readonly PlayerSummary[]
  readonly events: readonly EventBoardEntry[]
  readonly hand: readonly HandCard[]
  readonly faction: FactionIntel
  readonly roundStatus: RoundStatus
  readonly pendingAction: PendingActionSelection | null
}
