import type { CardType, Faction, SpecialAction } from '../api/action'
import { CardGlyph, EventSceneArt, FactionEmblem } from '../components/icons'
import type { CardKind, EventArtwork } from '../types/playerView'
import { CatalogEventScene, type CatalogEventSceneKey } from './eventSceneArt'
import { BOARD, CARD_ART_KEYS, CARD_FORM_INDEX, CARD_FORMS, ENGRAVING, EVENT_CATALOG, EVENT_FORM_INDEX, EVENT_FORMS, FACTION_ART_KEYS, FACTION_FORM_INDEX, SPECIAL_ART_KEYS, SPECIAL_FORM_INDEX, type IllustrationSkin } from './catalogData'

const BOARD_EVENT_ARTWORK: Partial<Record<string, EventArtwork>> = {
  delegate: 'delegate',
  reactor: 'reactor',
  pact: 'pact',
}

const BOARD_CARD_GLYPHS: Partial<Record<CardType, CardKind>> = {
  PUSH: 'push',
  SUPPRESS: 'suppress',
  SCAN: 'scan',
  NULLIFY: 'nullify',
  COLLIDE: 'collide',
}

const CATALOG_EVENT_SCENES = new Set<CatalogEventSceneKey>([
  'archive', 'general', 'plague-ship', 'radio', 'chancellor', 'ruins', 'ceasefire', 'volcano', 'heir',
  'blueprints', 'parliament', 'bridge', 'oracle', 'soldier', 'frontier', 'trial', 'gate', 'fleet',
  'burning-archive', 'resistance', 'null-bomb', 'coronation', 'quarantine', 'timeline', 'double-agent',
  'probe', 'convergence',
])

function Shape({ index, skin, wide = false, family }: { readonly index: number; readonly skin: IllustrationSkin; readonly wide?: boolean; readonly family: 'event' | 'card' | 'special' | 'faction' }) {
  const colors = skin === 'board' ? BOARD : ENGRAVING
  const forms = wide ? EVENT_FORMS : CARD_FORMS
  const path = index < 0 ? (wide ? 'M125 85h90m-45-35v70m-25-53 50 36m0-36-50 36' : 'M50 18v64m-32-32h64m-23-23 46 46m0-46L27 73') : forms[index % forms.length]
  const cx = wide ? 170 : 50
  const cy = wide ? 85 : 50
  const r = wide ? 61 : 38
  return (
    <g fill="none" stroke={colors.ink} strokeWidth={wide ? 1.5 : 2} strokeLinecap="round" strokeLinejoin="round">
      {family === 'faction' ? <path d="M50 7 87 28v44L50 93 13 72V28z" stroke={colors.faint} strokeWidth="1.2" /> :
        family === 'special' ? <path d="m50 5 45 45-45 45L5 50z" stroke={colors.faint} strokeWidth="1.2" /> :
          <circle cx={cx} cy={cy} r={r} stroke={colors.faint} strokeWidth="1" />}
      <path d={path} />
      {index >= 0 && index % 3 === 0 && <circle cx={cx + (wide ? 48 : 24)} cy={cy - (wide ? 42 : 24)} r={wide ? 3 : 2.2} fill={colors.detail} stroke="none" />}
      <path d={wide ? `M${cx - 105} 139h210` : `M15 50h70M50 15v70`} stroke={colors.faint} strokeWidth="1" />
      {skin === 'engraving' && <path d={wide ? `M${cx - 48} ${cy + 47}h96M${cx - 42} ${cy + 52}h84` : 'M28 72h44M32 77h36'} stroke={colors.accent} strokeWidth="1" />}
    </g>
  )
}

function IllustrationSvg({ id, index, skin, wide, family, className }: { readonly id: string; readonly index: number; readonly skin: IllustrationSkin; readonly wide: boolean; readonly family: 'event' | 'card' | 'special' | 'faction'; readonly className: string }) {
  const colors = skin === 'board' ? BOARD : ENGRAVING
  const viewBox = wide ? '0 0 340 191' : '0 0 100 100'
  return (
    <svg viewBox={viewBox} className={`${className} skin-${skin}`} data-catalog-id={id} aria-hidden="true" focusable="false">
      <rect width={wide ? 340 : 100} height={wide ? 191 : 100} rx={wide ? 0 : 50} fill={colors.paper} />
      {wide && <path d="M0 131 39 113l35 11 44-27 42 25 43-36 51 30 46-21v75H0z" fill={colors.faint} opacity=".46" />}
      <Shape index={index} skin={skin} wide={wide} family={family} />
      {skin === 'engraving' && (
        <g fill="none" stroke={colors.ink} strokeWidth=".8" opacity=".72">
          {Array.from({ length: 7 }, (_, line) => (
            <path key={`hatch-a-${line}`} d={wide ? `M${8 + line * 5} 143l18 22` : `M${20 + line * 3} 65l16 18`} />
          ))}
          {Array.from({ length: 7 }, (_, line) => (
            <path key={`hatch-b-${line}`} d={wide ? `M${10 + line * 5} 165l18-22` : `M${20 + line * 3} 83l16-18`} />
          ))}
        </g>
      )}
      {wide && <path d="M0 148h340M17 155h306" stroke={colors.accent} strokeWidth="1" opacity=".7" />}
      {skin === 'engraving' && <path d={wide ? 'M8 10h324M8 16h324M8 22h324' : 'M22 22h56M22 27h56'} stroke={colors.accent} strokeWidth=".7" opacity=".35" />}
    </svg>
  )
}

export function EventIllustration({ eventId, skin = 'board' }: { readonly eventId: string; readonly skin?: IllustrationSkin }) {
  const event = EVENT_CATALOG.find(([id]) => id === eventId)
  const boardArtwork = event && BOARD_EVENT_ARTWORK[event[1]]
  if (skin === 'board' && boardArtwork) {
    return <EventSceneArt artwork={boardArtwork} className="catalog-event-art catalog-event-scene-art" catalogId={eventId} />
  }
  if (skin === 'board' && event && CATALOG_EVENT_SCENES.has(event[1] as CatalogEventSceneKey)) {
    return <CatalogEventScene scene={event[1] as CatalogEventSceneKey} className="catalog-event-art catalog-event-scene-art" catalogId={eventId} />
  }
  const index = event ? EVENT_FORM_INDEX[event[1]] : -1
  return <IllustrationSvg id={eventId} index={index} skin={skin} wide family="event" className="catalog-event-art" />
}

export function CardIllustration({ cardType, skin = 'board' }: { readonly cardType: string; readonly skin?: IllustrationSkin }) {
  const key = CARD_ART_KEYS[cardType as CardType]
  const boardGlyph = BOARD_CARD_GLYPHS[cardType as CardType]
  if (skin === 'board' && boardGlyph) {
    return <CardGlyph kind={boardGlyph} className="catalog-icon-art" catalogId={key} />
  }
  const index = key ? CARD_FORM_INDEX[key] : -1
  return <IllustrationSvg id={key ?? 'unknown-card'} index={index} skin={skin} wide={false} family="card" className="catalog-icon-art" />
}

export function SpecialIllustration({ specialAction, skin = 'board' }: { readonly specialAction: string; readonly skin?: IllustrationSkin }) {
  const key = SPECIAL_ART_KEYS[specialAction as SpecialAction]
  const index = key ? SPECIAL_FORM_INDEX[key] : -1
  return <IllustrationSvg id={key ?? 'unknown-special'} index={index} skin={skin} wide={false} family="special" className="catalog-icon-art" />
}

export function FactionIllustration({ faction, skin = 'board' }: { readonly faction: string; readonly skin?: IllustrationSkin }) {
  const normalizedFaction = faction.trim().toUpperCase().replace(/^THE\s+/, '') as Faction
  const key = FACTION_ART_KEYS[normalizedFaction]
  if (skin === 'board' && key) {
    return <FactionEmblem className="catalog-icon-art" catalogId={key} />
  }
  const index = key ? FACTION_FORM_INDEX[key] : -1
  return <IllustrationSvg id={key ?? 'unknown-faction'} index={index} skin={skin} wide={false} family="faction" className="catalog-icon-art" />
}
