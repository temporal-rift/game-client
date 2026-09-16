export interface EventBoardEntry {
  readonly id: string
  readonly era: number
  readonly title: string
  readonly publicBand: string
  readonly status: 'resolved' | 'in-progress' | 'upcoming'
}

export interface HandCard {
  readonly id: string
  readonly name: string
  readonly grade: number
  readonly description: string
}

export interface KnowledgeItem {
  readonly id: string
  readonly label: string
  readonly detail: string
  readonly scope: 'public' | 'private'
}

export interface FactionIntel {
  readonly factionName: string
  readonly specialName: string
  readonly specialRemainingUses: number
  readonly knowledge: readonly KnowledgeItem[]
}

export interface PendingActionSummary {
  readonly id: string
  readonly summary: string
  readonly targetLabel: string
  readonly confirmLabel: string
}

export interface PlayerView {
  readonly gameId: string
  readonly currentEra: number
  readonly currentRound: number
  readonly events: readonly EventBoardEntry[]
  readonly hand: readonly HandCard[]
  readonly faction: FactionIntel
  readonly pendingAction: PendingActionSummary | null
}
