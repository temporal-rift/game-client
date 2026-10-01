import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { CARD_TYPES, FACTIONS, SPECIAL_ACTIONS } from '../api/action'
import { CardIllustration, EventIllustration, FactionIllustration } from './catalog'
import { CARD_ART_KEYS, CARD_FORM_INDEX, EVENT_CATALOG, EVENT_FORM_INDEX, FACTION_ART_KEYS, FACTION_FORM_INDEX, SPECIAL_ART_KEYS, SPECIAL_FORM_INDEX } from './catalogData'

describe('catalog illustrations', () => {
  it('covers every catalog identifier with matched skins', () => {
    expect(EVENT_CATALOG).toHaveLength(30)
    expect(new Set(EVENT_CATALOG.map(([id]) => id)).size).toBe(30)
    expect(new Set(Object.values(EVENT_FORM_INDEX)).size).toBe(30)
    expect(EVENT_CATALOG.every(([, motif]) => motif in EVENT_FORM_INDEX)).toBe(true)
    expect(Object.keys(CARD_ART_KEYS).sort()).toEqual([...CARD_TYPES].sort())
    expect(new Set(Object.values(CARD_FORM_INDEX)).size).toBe(15)
    expect(Object.keys(SPECIAL_ART_KEYS).sort()).toEqual([...SPECIAL_ACTIONS].sort())
    expect(new Set(Object.values(SPECIAL_FORM_INDEX)).size).toBe(15)
    expect(Object.keys(FACTION_ART_KEYS).sort()).toEqual([...FACTIONS].sort())
    expect(new Set(Object.values(FACTION_FORM_INDEX)).size).toBe(5)
  })

  it('renders decorative art in either skin and uses generic art for an unknown event or card', () => {
    const { container, rerender } = render(<EventIllustration eventId={EVENT_CATALOG[0][0]} skin="engraving" />)
    const event = container.querySelector('svg')
    expect(event).toHaveAttribute('aria-hidden', 'true')
    expect(event).toHaveAttribute('focusable', 'false')
    expect(event).toHaveClass('skin-engraving')

    rerender(<EventIllustration eventId="future-event" />)
    expect(container.querySelector('svg')).toHaveAttribute('data-catalog-id', 'future-event')
    rerender(<CardIllustration cardType="FUTURE_CARD" />)
    expect(container.querySelector('svg')).toHaveAttribute('data-catalog-id', 'unknown-card')
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('reuses the board event scenes, card glyphs, and faction emblem where they already exist', () => {
    const { container, rerender } = render(<EventIllustration eventId={EVENT_CATALOG[0][0]} />)
    expect(container.querySelector('svg')).toHaveClass('catalog-event-scene-art')

    rerender(<CardIllustration cardType="PUSH" />)
    expect(container.querySelector('svg')).toHaveClass('card-glyph-push')

    rerender(<CardIllustration cardType="SUPPRESS" />)
    expect(container.querySelector('svg')).toHaveClass('card-glyph-suppress')

    rerender(<FactionIllustration faction="PROPHETS" />)
    expect(container.querySelector('svg')).toHaveClass('faction-emblem')
  })

  it('renders a scene-specific Board illustration for every remaining event', () => {
    const expectedScenes = new Set([
      'archive', 'general', 'plague-ship', 'radio', 'chancellor', 'ruins', 'ceasefire', 'volcano', 'heir',
      'blueprints', 'parliament', 'bridge', 'oracle', 'soldier', 'frontier', 'trial', 'gate', 'fleet',
      'burning-archive', 'resistance', 'null-bomb', 'coronation', 'quarantine', 'timeline', 'double-agent',
      'probe', 'convergence',
    ])

    for (const [eventId, scene] of EVENT_CATALOG.slice(3)) {
      const { container, unmount } = render(<EventIllustration eventId={eventId} />)
      const svg = container.querySelector('svg')
      expect(svg).toHaveClass('catalog-event-scene-art')
      expect(svg).toHaveAttribute('data-scene-key', scene)
      expectedScenes.delete(scene)
      unmount()
    }

    expect(expectedScenes).toEqual(new Set())
  })

  it('keeps all event illustrations decorative and available in both skins', () => {
    for (const [eventId, scene] of EVENT_CATALOG) {
      const { container, unmount } = render(<EventIllustration eventId={eventId} />)
      const boardSvg = container.querySelector('svg')
      expect(boardSvg).toHaveAttribute('data-catalog-id', eventId)
      expect(boardSvg).toHaveAttribute('aria-hidden', 'true')
      expect(boardSvg).toHaveAttribute('focusable', 'false')
      if (scene === 'delegate' || scene === 'reactor' || scene === 'pact') {
        expect(boardSvg).toHaveClass('catalog-event-scene-art')
      } else {
        expect(boardSvg).toHaveAttribute('data-scene-key', scene)
      }
      unmount()

      const engraving = render(<EventIllustration eventId={eventId} skin="engraving" />)
      expect(engraving.container.querySelector('svg')).toHaveClass('skin-engraving')
      expect(engraving.container.querySelector('svg')).toHaveAttribute('data-catalog-id', eventId)
      engraving.unmount()
    }
  })
})
