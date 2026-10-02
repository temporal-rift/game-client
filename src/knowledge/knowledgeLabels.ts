import type { RevealedKnowledgeEntry, RevealedProbabilityOutcome } from './knowledgeView'

/** Entries have no server id; subject and observation round identify each reveal. */
export function revealedKnowledgeKey(entry: RevealedKnowledgeEntry): string {
  const subject = entry.kind === 'HAND_CARD' ? entry.targetPlayerId : entry.eventId
  return `${entry.kind}-${subject}-${entry.observedInRound}`
}

export function probabilityLabel(outcome: RevealedProbabilityOutcome): string {
  return `${outcome.probability}%${outcome.isAnnihilated ? ' (annihilated)' : ''}${outcome.isSealed ? ' (sealed)' : ''}`
}

export function revealedKnowledgeLabel(entry: RevealedKnowledgeEntry): { readonly label: string; readonly detail: string } {
  switch (entry.kind) {
    case 'PROBABILITY':
      return {
        label: `Scan · ${entry.eventTitle}`,
        detail: entry.outcomes.map((outcome) => `${outcome.outcomeDescription}: ${probabilityLabel(outcome)}`).join(' · '),
      }
    case 'INFLUENCE':
      return {
        label: `Trace · ${entry.eventTitle}`,
        detail: entry.influencers.length > 0
          ? `Influenced by ${entry.influencers.map((influencer) => influencer.usedMimic ? `${influencer.playerName} (Revisionist via Mimic)` : influencer.playerName).join(', ')}`
          : 'No player influenced this event.',
      }
    case 'HAND_CARD':
      return {
        label: `Intercept · ${entry.targetPlayerName}`,
        detail: entry.revealedCards.length > 0
          ? entry.revealedCards.map((card) => `${card.cardName} · Grade ${card.grade}`).join(' · ')
          : 'No card was revealed.',
      }
  }
}
