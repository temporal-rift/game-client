import { useId } from 'react'
import type { EventBoardEntry, KnowledgeItem } from '../types/playerView'

function hashSeed(seed: string): number {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }
  return hash
}

function pickVariant<T extends readonly string[]>(seed: string, variants: T): T[number] {
  return variants[hashSeed(seed) % variants.length]
}

const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  'aria-hidden': true,
  focusable: false,
} as const

export function RiftMark() {
  return (
    <svg {...ICON_PROPS} width={22} height={22} className="rift-mark">
      <path d="M12 2 20 6.5v11L12 22 4 17.5v-11Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M12 6 16.5 8.5v7L12 18 7.5 15.5v-7Z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

function ResolvedIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function InProgressIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path
        d="M6 4h12M6 20h12M7 4c0 4 4 6 5 8-1 2-5 4-5 8M17 4c0 4-4 6-5 8 1 2 5 4 5 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function UpcomingIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="15.5" r="1.4" fill="currentColor" />
    </svg>
  )
}

const STATUS_ICONS: Record<EventBoardEntry['status'], () => React.JSX.Element> = {
  resolved: ResolvedIcon,
  'in-progress': InProgressIcon,
  upcoming: UpcomingIcon,
}

export function EventStatusIcon({ status }: { readonly status: EventBoardEntry['status'] }) {
  const Icon = STATUS_ICONS[status]
  return <Icon />
}

function PrivateIcon() {
  return (
    <svg {...ICON_PROPS} width={16} height={16}>
      <rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function PublicIcon() {
  return (
    <svg {...ICON_PROPS} width={16} height={16}>
      <path
        d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

const SCOPE_ICONS: Record<KnowledgeItem['scope'], () => React.JSX.Element> = {
  private: PrivateIcon,
  public: PublicIcon,
}

export function KnowledgeScopeIcon({ scope }: { readonly scope: KnowledgeItem['scope'] }) {
  const Icon = SCOPE_ICONS[scope]
  return <Icon />
}

const SCENE_VARIANTS = ['spire', 'reactor', 'assembly'] as const

function SpireScene({ gradientId }: { readonly gradientId: string }) {
  return (
    <>
      <linearGradient id={gradientId} x1="0" y1="0" x2="0.8" y2="1">
        <stop offset="0" stopColor="var(--scene-spire-from)" />
        <stop offset="1" stopColor="var(--scene-spire-to)" />
      </linearGradient>
      <rect width="200" height="84" fill={`url(#${gradientId})`} />
      <circle cx="166" cy="22" r="12" fill="currentColor" opacity="0.22" />
      <path d="M0 84 22 46 44 84Z" fill="currentColor" opacity="0.28" />
      <path d="M40 84 66 14 92 84Z" fill="currentColor" opacity="0.4" />
      <path d="M86 84 108 40 130 84Z" fill="currentColor" opacity="0.3" />
    </>
  )
}

function ReactorScene({ gradientId }: { readonly gradientId: string }) {
  return (
    <>
      <rect width="200" height="84" fill="var(--scene-reactor-from)" />
      <radialGradient id={gradientId}>
        <stop offset="0" stopColor="var(--scene-reactor-core)" />
        <stop offset="1" stopColor="var(--scene-reactor-to)" />
      </radialGradient>
      <circle cx="100" cy="42" r="34" fill={`url(#${gradientId})`} />
      <circle cx="100" cy="42" r="22" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.5" />
      <circle cx="100" cy="42" r="8" fill="currentColor" opacity="0.7" />
    </>
  )
}

function AssemblyScene({ gradientId }: { readonly gradientId: string }) {
  return (
    <>
      <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="var(--scene-assembly-from)" />
        <stop offset="1" stopColor="var(--scene-assembly-to)" />
      </linearGradient>
      <rect width="200" height="84" fill={`url(#${gradientId})`} />
      <path d="M10 78 60 62 100 74 140 60 190 78" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <circle cx="150" cy="26" r="10" fill="currentColor" opacity="0.2" />
    </>
  )
}

const SCENES: Record<(typeof SCENE_VARIANTS)[number], (props: { readonly gradientId: string }) => React.JSX.Element> = {
  spire: SpireScene,
  reactor: ReactorScene,
  assembly: AssemblyScene,
}

/** Decorative illustrated banner; the tile's status/title/band text already carries the meaning. */
export function EventSceneArt({ seed }: { readonly seed: string }) {
  const gradientId = useId()
  const Scene = SCENES[pickVariant(seed, SCENE_VARIANTS)]

  return (
    <svg viewBox="0 0 200 84" className="event-scene-art" aria-hidden="true" focusable="false">
      <Scene gradientId={gradientId} />
    </svg>
  )
}

const CARD_GLYPH_VARIANTS = ['diamond', 'hex', 'cross'] as const

function DiamondGlyph() {
  return (
    <>
      <path d="M50 6 88 50 50 94 12 50Z" fill="none" stroke="currentColor" strokeWidth="4" />
      <path d="M50 26 70 50 50 74 30 50Z" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.7" />
    </>
  )
}

function HexGlyph() {
  return (
    <>
      <path d="M50 6 85 27 85 73 50 94 15 73 15 27Z" fill="none" stroke="currentColor" strokeWidth="4" />
      <circle cx="50" cy="50" r="16" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.7" />
    </>
  )
}

function CrossGlyph() {
  return (
    <>
      <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="4" />
      <path d="M50 18V82M18 50H82" stroke="currentColor" strokeWidth="3" opacity="0.7" />
    </>
  )
}

const CARD_GLYPHS: Record<(typeof CARD_GLYPH_VARIANTS)[number], () => React.JSX.Element> = {
  diamond: DiamondGlyph,
  hex: HexGlyph,
  cross: CrossGlyph,
}

/** Decorative card-face glyph; the card's name/grade/description text already carries the meaning. */
export function CardGlyph({ seed }: { readonly seed: string }) {
  const Glyph = CARD_GLYPHS[pickVariant(seed, CARD_GLYPH_VARIANTS)]

  return (
    <svg viewBox="0 0 100 100" className="card-glyph" aria-hidden="true" focusable="false">
      <Glyph />
    </svg>
  )
}

export function FactionEmblem() {
  return (
    <svg viewBox="0 0 100 100" className="faction-emblem" aria-hidden="true" focusable="false">
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M6 50Q50 14 94 50Q50 86 6 50Z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <circle cx="50" cy="50" r="14" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="50" cy="50" r="5" fill="currentColor" />
    </svg>
  )
}

/** Decorative connection between the selected card and target; the live summary text below carries the meaning. */
export function ConnectionGlyph() {
  return (
    <svg viewBox="0 0 140 40" className="connection-glyph" aria-hidden="true" focusable="false">
      <circle cx="14" cy="20" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M26 20H108" stroke="currentColor" strokeWidth="1.6" strokeDasharray="4 5" />
      <path d="M118 6 132 20 118 34 104 20Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

export function GradeBadge({ grade }: { readonly grade: number }) {
  const pipCount = Math.max(0, Math.min(grade, 5))

  return (
    <span className="grade-badge">
      <svg viewBox="0 0 100 26" width="64" height="18" aria-hidden="true" focusable="false" className="grade-badge-art">
        <rect x="1" y="1" width="98" height="24" rx="12" fill="none" stroke="currentColor" strokeWidth="1.5" />
        {Array.from({ length: pipCount }, (_, index) => {
          const cx = 18 + index * 16
          return <path key={index} d={`M${cx} 6 L${cx + 6} 13 L${cx} 20 L${cx - 6} 13 Z`} fill="currentColor" />
        })}
      </svg>
      <span className="grade-badge-text">Grade {grade}</span>
    </span>
  )
}
