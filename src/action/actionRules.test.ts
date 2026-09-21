import { describe, expect, it } from 'vitest'
import { CARD_TYPES, FACTIONS, SPECIAL_ACTIONS } from '../api/actionClient'
import {
  cardTargetMode,
  FACTION_SPECIALS,
  isDeclarationOnlySpecial,
  scanEventCountForGrade,
  specialActionAvailability,
  specialTargetMode,
} from './actionRules'

describe('cardTargetMode', () => {
  it('targets a single player for the five player-targeting card types', () => {
    for (const cardType of ['NULLIFY', 'REDIRECT', 'AMPLIFY', 'JAM', 'INTERCEPT'] as const) {
      expect(cardTargetMode(cardType)).toBe('PLAYER')
    }
  })

  it('targets a source/target outcome pair for Swing and Collide', () => {
    expect(cardTargetMode('SWING')).toBe('EVENT_OUTCOME_PAIR')
    expect(cardTargetMode('COLLIDE')).toBe('EVENT_OUTCOME_PAIR')
  })

  it('targets a list of events for Scan', () => {
    expect(cardTargetMode('SCAN')).toBe('EVENT_LIST')
  })

  it('targets a scalar event/outcome for every other card type', () => {
    for (const cardType of ['PUSH', 'SUPPRESS', 'TRACE', 'DECOY', 'STALL', 'STABILIZE', 'DETONATE'] as const) {
      expect(cardTargetMode(cardType)).toBe('EVENT_OUTCOME')
    }
  })

  it('covers every known card type with exactly one target mode', () => {
    for (const cardType of CARD_TYPES) {
      expect(['PLAYER', 'EVENT_OUTCOME_PAIR', 'EVENT_LIST', 'EVENT_OUTCOME']).toContain(cardTargetMode(cardType))
    }
  })
})

describe('specialTargetMode', () => {
  it('targets a single player for Corrupt and Expose', () => {
    expect(specialTargetMode('CORRUPT')).toBe('PLAYER')
    expect(specialTargetMode('EXPOSE')).toBe('PLAYER')
  })

  it('targets an event only for Fulfillment', () => {
    expect(specialTargetMode('FULFILLMENT')).toBe('EVENT_ONLY')
  })

  it('requires no target for Obscure, Tapestry and Reweave', () => {
    for (const specialAction of ['OBSCURE', 'TAPESTRY', 'REWEAVE'] as const) {
      expect(specialTargetMode(specialAction)).toBe('NONE')
    }
  })

  it('targets an event/outcome pair for Thread, matching the other event-targeting specials', () => {
    for (const specialAction of ['FORESIGHT', 'ANNIHILATE', 'SEAL', 'REWRITE', 'MIMIC', 'CASCADE', 'THREAD'] as const) {
      expect(specialTargetMode(specialAction)).toBe('EVENT_OUTCOME')
    }
  })

  it('covers every known special action with exactly one target mode', () => {
    for (const specialAction of SPECIAL_ACTIONS) {
      expect(['PLAYER', 'EVENT_ONLY', 'NONE', 'EVENT_OUTCOME']).toContain(specialTargetMode(specialAction))
    }
  })
})

describe('isDeclarationOnlySpecial', () => {
  it('flags Rally and Momentum as declaration-only', () => {
    expect(isDeclarationOnlySpecial('RALLY')).toBe(true)
    expect(isDeclarationOnlySpecial('MOMENTUM')).toBe(true)
  })

  it('does not flag any round-action special', () => {
    for (const specialAction of SPECIAL_ACTIONS.filter((action) => action !== 'RALLY' && action !== 'MOMENTUM')) {
      expect(isDeclarationOnlySpecial(specialAction)).toBe(false)
    }
  })
})

describe('FACTION_SPECIALS', () => {
  it('assigns every faction exactly three specials, covering all fifteen with no overlap', () => {
    const seen = new Set<string>()
    for (const faction of FACTIONS) {
      const specials = FACTION_SPECIALS[faction]
      expect(specials).toHaveLength(3)
      for (const special of specials) {
        expect(seen.has(special)).toBe(false)
        seen.add(special)
      }
    }
    expect(seen.size).toBe(SPECIAL_ACTIONS.length)
  })
})

describe('scanEventCountForGrade', () => {
  it('scales one/two/three events by grade', () => {
    expect(scanEventCountForGrade('I')).toBe(1)
    expect(scanEventCountForGrade('II')).toBe(2)
    expect(scanEventCountForGrade('III')).toBe(3)
  })
})

describe('specialActionAvailability', () => {
  it('is unavailable for Rally/Momentum regardless of context', () => {
    const result = specialActionAvailability('RALLY', { roundNumber: 1, myJammedUntilRound: null, budgets: [] })
    expect(result.available).toBe(false)
  })

  it('is unavailable while jammed through the current round', () => {
    const result = specialActionAvailability('ANNIHILATE', { roundNumber: 2, myJammedUntilRound: 2, budgets: [] })
    expect(result.available).toBe(false)
    expect(result.reason).toMatch(/jammed/i)
  })

  it('is available once the jammed round has passed', () => {
    const result = specialActionAvailability('ANNIHILATE', { roundNumber: 3, myJammedUntilRound: 2, budgets: [] })
    expect(result.available).toBe(true)
  })

  it('restricts Expose to Action Round 2', () => {
    expect(specialActionAvailability('EXPOSE', { roundNumber: 1, myJammedUntilRound: null, budgets: [] }).available).toBe(false)
    expect(specialActionAvailability('EXPOSE', { roundNumber: 3, myJammedUntilRound: null, budgets: [] }).available).toBe(false)
    expect(specialActionAvailability('EXPOSE', { roundNumber: 2, myJammedUntilRound: null, budgets: [] }).available).toBe(true)
  })

  it('is unavailable once a budgeted special is exhausted for the era', () => {
    const budgets = [{ specialAction: 'SEAL', remainingUsesThisEra: 0, remainingUsesThisGame: 1 }]
    const result = specialActionAvailability('SEAL', { roundNumber: 1, myJammedUntilRound: null, budgets })
    expect(result.available).toBe(false)
    expect(result.reason).toMatch(/no remaining uses/i)
  })

  it('is available while a budgeted special still has remaining uses this era', () => {
    const budgets = [{ specialAction: 'SEAL', remainingUsesThisEra: 1, remainingUsesThisGame: 1 }]
    expect(specialActionAvailability('SEAL', { roundNumber: 1, myJammedUntilRound: null, budgets }).available).toBe(true)
  })

  it('is available for an unbudgeted special with no matching entry', () => {
    expect(specialActionAvailability('CASCADE', { roundNumber: 1, myJammedUntilRound: null, budgets: [] }).available).toBe(true)
  })
})
