import type { CardType, Faction } from '../api/action'

interface CardReference {
  readonly timing: string
  readonly grades: string
  readonly example: string
}

export const CARD_REFERENCE: Readonly<Record<CardType, CardReference>> = {
  PUSH: { timing: 'Action rounds, or an eligible paradox offer.', grades: 'Grades I, II and III increase the strength of the shift.', example: 'Choose the outcome you want to make more likely. Its gain is taken from the other eligible outcomes.' },
  SUPPRESS: { timing: 'Action rounds, or an eligible paradox offer.', grades: 'Grades I, II and III increase the strength of the shift.', example: 'Lower an unwanted outcome; its lost weight goes to the other eligible outcomes.' },
  SWING: { timing: 'Action rounds.', grades: 'Grades I, II and III transfer progressively more weight.', example: 'Select a source and a different destination on the same event. Weight moves from the source to the destination.' },
  AMPLIFY: { timing: 'Action rounds; name another player.', grades: 'Grades I, II and III increase the multiplier.', example: 'If your target plays a qualifying probability shift this round, its magnitude is multiplied. If they pass, there is nothing to amplify.' },
  INTERCEPT: { timing: 'Rounds 1 and 2; information arrives when the round closes.', grades: 'Grade I reveals one hand card; grade II reveals two. No grade III.', example: 'Target an opponent to learn cards still in their hand. An obscured opponent can show a decoy hand instead.' },
  SCAN: { timing: 'Rounds 1 and 2; information arrives when the round closes.', grades: 'Grade I names one event, II two distinct events, III all three.', example: 'Choose events whose odds matter to you. Their exact probabilities are private to you and refreshed through the end of the era.' },
  TRACE: { timing: 'Reads the previous round. A newly drawn event has no history in Round 1.', grades: 'Grade I inspects one event; grade II covers all active events. No grade III.', example: 'Learn who influenced the event in the previous round. A traced Mimic identifies a Revisionist; other faction specials do not register.' },
  DECOY: { timing: 'Action rounds; no target.', grades: 'Single-grade card.', example: 'Choose a disguise category. The public round summary shows that category; no probability or information effect occurs.' },
  JAM: { timing: 'Rounds 1 and 2; applies to the following round of this era.', grades: 'Single-grade card.', example: 'Name an opponent to block their faction specials next round. They can still play a card.' },
  STALL: { timing: 'Action rounds before the final era.', grades: 'Single-grade card.', example: 'Delay an event until next era. It has no winner this era, so this era’s declarations and pending chain link cannot score from its later result.' },
  REDIRECT: { timing: 'Action rounds; name another player.', grades: 'Single-grade card.', example: 'Their Push, Suppress or Swing moves to the next eligible outcome in that event’s order. You choose the player, not the new destination.' },
  NULLIFY: { timing: 'Action rounds; names opponents acting in the same round.', grades: 'Grade I names one opponent; grade II names two distinct opponents. No grade III.', example: 'Cancel an eligible opponent action. In Round 1 this can also cancel the Activist’s Rally or Momentum declaration.' },
  COLLIDE: { timing: 'Action rounds; select two outcomes on the same event.', grades: 'Single-grade card.', example: 'Equalize the two selected weights. If they are still tied highest at resolution, they create a Dead Heat. Other shifts can change that tie.' },
  STABILIZE: { timing: 'Paradox resolution only; offered after a paradox is detected.', grades: 'Reactive card; only server-offered instances can be played.', example: 'Clear the event’s paradoxes without changing its weights. It can then resolve by its ordinary weighted draw if an eligible outcome remains.' },
  DETONATE: { timing: 'Paradox resolution only; offered after a paradox is detected.', grades: 'Reactive card; only server-offered instances can be played.', example: 'If this event cascades, you take the base cascade penalty while other players take the larger penalty. It does not guarantee a particular outcome wins.' },
}

export const FACTION_REFERENCE: Readonly<Record<Faction, { readonly goal: string; readonly scoring: string; readonly example: string }>> = {
  ERASERS: { goal: 'Remove leading outcomes and disrupt opponents.', scoring: 'Score by annihilating a leading outcome or successfully corrupting an opponent’s transfer. Leading annihilations also advance your faction objective.', example: 'Annihilate an outcome that is leading, rather than a trailing outcome that would earn no annihilation score.' },
  PROPHETS: { goal: 'Write outcomes and help them come true.', scoring: 'Score when an event resolves as written; a successful Fulfillment improves its upside. A different winner costs points. Written resolutions advance your faction objective.', example: 'Use Foresight to write an outcome, then protect its odds. Fulfillment bets on the event’s written outcome, whoever wrote it.' },
  REVISIONISTS: { goal: 'Make your secret preferred outcome win while concealing your Mimics.', scoring: 'The latest Rewrite is your preference for this era. Its win and successful Mimics earn points; winning eras advance your objective. An untraced Mimic earns a final-era concealment bonus.', example: 'Rewrite names your preferred outcome. A Mimic toward it can help, but a Trace of that round can identify you.' },
  WEAVERS: { goal: 'Build a chain of winning outcomes across successive eras.', scoring: 'A pending link joins your chain only when its exact outcome wins. Confirmed links score; completing the chain is a victory route. An unresolved chain-conflict cascade can break it.', example: 'Thread a live outcome this era. In a later era, add another link; playing Thread repeatedly in one era cannot grow the chain repeatedly.' },
  ACTIVISTS: { goal: 'Publicly back winning outcomes in consecutive eras.', scoring: 'Rally or Momentum scores when your exact declared outcome wins. Consecutive successful declarations advance your objective; Expose can earn additional points.', example: 'Declare Rally before Round 1 to boost inward transfers onto your chosen outcome during that round. The declaration uses your Round 1 action.' },
}

export const SPECIAL_TIMING = {
  ANNIHILATE: 'Once per era; select an eligible outcome. A leading erasure can score.',
  CORRUPT: 'Name an opponent this round; inverts their qualifying probability transfer.',
  CASCADE: 'Requires your prior erasure; unavailable in the final era.',
  FORESIGHT: 'Select a current outcome to write it and privately preview next-era events.',
  SEAL: 'Select an outcome; locks its weight through era end. Remaining uses are shown on your board.',
  FULFILLMENT: 'Select an event before resolution; bets on whichever outcome is written there.',
  REWRITE: 'Select an outcome; replaces your previous preference for this era.',
  MIMIC: 'Select an outcome; copies the strongest same-round Push or inward Swing onto it, if one exists.',
  OBSCURE: 'Rounds 1 and 2; covers the following round of this era. No target.',
  THREAD: 'Select a live current-era outcome; at most one confirmed link per era.',
  TAPESTRY: 'Requires an eligible active chain; protects its pending link for this era. No target.',
  REWEAVE: 'Once per era; move a current-era pending link to a different live outcome.',
  RALLY: 'Declaration window only. Optional and public; consumes your Round 1 action.',
  EXPOSE: 'Round 2 only; name an opponent whose Round 1 summary shows a Probability Shifter card.',
  MOMENTUM: 'Declaration window only, after a successful preceding-era declaration. Consumes your Round 1 action.',
} as const
