import { describe, expect, it } from 'vitest'
import { CARD_TYPES, FACTIONS, SPECIAL_ACTIONS } from '../api/action'
import {
  CARD_CATEGORIES,
  cardCategoryDisplayName,
  cardTargetListSize,
  cardTargetMode,
  FACTION_SPECIALS,
  isDeclarationOnlySpecial,
  specialEffectSummary,
  specialTargetMode,
  specialUnavailableReasonLabel,
} from './actionRules'

describe('cardTargetMode', () => {
  it('targets a single player for the four scalar player-targeting card types', () => {
    for (const cardType of ['REDIRECT', 'AMPLIFY', 'JAM', 'INTERCEPT'] as const) {
      expect(cardTargetMode(cardType)).toBe('PLAYER')
    }
  })

  it('targets a list of players for Nullify', () => {
    expect(cardTargetMode('NULLIFY')).toBe('PLAYER_LIST')
  })

  it('targets a source/target outcome pair for Swing and Collide', () => {
    expect(cardTargetMode('SWING')).toBe('EVENT_OUTCOME_PAIR')
    expect(cardTargetMode('COLLIDE')).toBe('EVENT_OUTCOME_PAIR')
  })

  it('targets a list of events for Scan', () => {
    expect(cardTargetMode('SCAN')).toBe('EVENT_LIST')
  })

  it('targets a disguise category with no target for Decoy', () => {
    expect(cardTargetMode('DECOY')).toBe('DISGUISE')
  })

  it('targets a scalar event/outcome for every other card type', () => {
    for (const cardType of ['PUSH', 'SUPPRESS', 'TRACE', 'STALL', 'STABILIZE', 'DETONATE'] as const) {
      expect(cardTargetMode(cardType)).toBe('EVENT_OUTCOME')
    }
  })

  it('covers every known card type with exactly one target mode', () => {
    for (const cardType of CARD_TYPES) {
      expect(['PLAYER', 'PLAYER_LIST', 'EVENT_OUTCOME_PAIR', 'EVENT_LIST', 'EVENT_OUTCOME', 'DISGUISE']).toContain(cardTargetMode(cardType))
    }
  })

  it('names every disguise category for the Decoy picker', () => {
    expect(CARD_CATEGORIES).toEqual(['PROBABILITY_SHIFTER', 'INFORMATION', 'DISRUPTION', 'PARADOX'])
    for (const category of CARD_CATEGORIES) {
      expect(cardCategoryDisplayName(category).length).toBeGreaterThan(0)
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

  it('requires no target for Obscure and Tapestry', () => {
    for (const specialAction of ['OBSCURE', 'TAPESTRY'] as const) {
      expect(specialTargetMode(specialAction)).toBe('NONE')
    }
  })

  it('targets an event/outcome pair for Thread and Reweave, matching the other event-targeting specials', () => {
    for (const specialAction of [
      'FORESIGHT',
      'ANNIHILATE',
      'SEAL',
      'REWRITE',
      'MIMIC',
      'CASCADE',
      'THREAD',
      'REWEAVE',
    ] as const) {
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

describe('cardTargetListSize', () => {
  it('scales Scan to one/two/three events by grade', () => {
    expect(cardTargetListSize('SCAN', 'I')).toBe(1)
    expect(cardTargetListSize('SCAN', 'II')).toBe(2)
    expect(cardTargetListSize('SCAN', 'III')).toBe(3)
  })

  it('sizes Nullify to one player at grade I and two at grade II', () => {
    expect(cardTargetListSize('NULLIFY', 'I')).toBe(1)
    expect(cardTargetListSize('NULLIFY', 'II')).toBe(2)
  })

  it('has no Nullify list size at grade III, which does not exist', () => {
    expect(cardTargetListSize('NULLIFY', 'III')).toBeNull()
  })

  it('has no list size for scalar-target cards', () => {
    expect(cardTargetListSize('PUSH', 'II')).toBeNull()
    expect(cardTargetListSize('REDIRECT', 'I')).toBeNull()
  })
})

describe('specialEffectSummary', () => {
  it('describes a Rewrite as a locked commitment with a miss penalty', () => {
    const summary = specialEffectSummary('REWRITE')
    expect(summary).toMatch(/first Rewrite of the era is locked/)
    expect(summary).toMatch(/a miss costs points/)
    expect(summary).not.toMatch(/replac/i)
  })

  it('scores Expose only on the event of the Activist’s own declaration', () => {
    expect(specialEffectSummary('EXPOSE')).toMatch(/only when that signature is on the event of your own declaration that era/)
  })

  it('scores a leading Annihilate only when it changed the winner', () => {
    expect(specialEffectSummary('ANNIHILATE')).toMatch(/only when it changed which outcome won/)
  })
})

describe('specialUnavailableReasonLabel', () => {
  it('explains each server-reported reason in player-safe words', () => {
    expect(specialUnavailableReasonLabel('JAMMED', 1)).toBe('You are jammed this round.')
    expect(specialUnavailableReasonLabel('DECLARATION_WINDOW_ONLY', 1)).toBe('Only usable in the declaration window.')
    expect(specialUnavailableReasonLabel('NOT_ELIGIBLE_THIS_ERA', 3)).toBe('Not usable in the final era.')
    expect(specialUnavailableReasonLabel('GAME_BUDGET_EXHAUSTED', 2)).toBe('No uses left this game.')
    expect(specialUnavailableReasonLabel('ERA_BUDGET_EXHAUSTED', 2)).toBe('Already used this era.')
  })

  it('names the current round for a round-window rejection', () => {
    expect(specialUnavailableReasonLabel('NOT_ELIGIBLE_THIS_ROUND', 1)).toBe('Not usable in Action Round 1.')
    expect(specialUnavailableReasonLabel('NOT_ELIGIBLE_THIS_ROUND', 2)).toBe('Not usable in Action Round 2.')
  })
})
