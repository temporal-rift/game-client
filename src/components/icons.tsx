import { useId } from 'react'
import type { CardKind, EventArtwork, EventBoardEntry, KnowledgeItem } from '../types/playerView'

const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  'aria-hidden': true,
  focusable: false,
} as const

export function RiftMark() {
  return (
    <svg viewBox="0 0 100 100" className="rift-mark" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M50 5 85 25v50L50 95 15 75V25Z" />
        <path d="M50 18 73 32v36L50 82 27 68V32Z" />
        <path d="m60 24-20 21 17 3-18 28M50 5v13M85 25 73 32M15 75l12-7" />
      </g>
    </svg>
  )
}

function ResolvedIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="m7.5 12.5 3 3 6-6.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function InProgressIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  )
}

function UpcomingIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.6" />
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
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
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

function DelegateScene() {
  return (
    <>
      <rect width="340" height="155" fill="#25223a" />
      <circle cx="247" cy="51" r="33" fill="#bb9472" opacity=".2" />
      <circle cx="247" cy="51" r="21" fill="#bb9472" opacity=".14" />
      <path d="M0 123 46 105l30 6 18-24 50 22 43-15 49 18 53-17 51 20v40H0Z" fill="#181d30" />
      <g fill="#293046" stroke="#6b7083" strokeWidth="1">
        <path d="M77 137V55l58-19 58 19v82Z" />
        <path d="M85 58h100M89 65v70M110 65v70M134 65v70M157 65v70M180 65v70M64 137h142l14 8H49Z" />
      </g>
      <g fill="#111a2c">
        <circle cx="270" cy="101" r="9" />
        <path d="m250 150 3-28q17-17 29 1l15 32Z" />
      </g>
      <g fill="none" stroke="#cba57d" strokeWidth="1" opacity=".55">
        <path d="M21 18h72M25 25h44M230 125l23-22M8 148h329" />
      </g>
    </>
  )
}

function ReactorScene() {
  const glowId = useId()
  return (
    <>
      <defs>
        <radialGradient id={glowId}>
          <stop stopColor="#baf4e1" />
          <stop offset=".12" stopColor="#65baa9" stopOpacity=".8" />
          <stop offset="1" stopColor="#36688b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="340" height="155" fill="#152937" />
      <ellipse cx="177" cy="73" rx="117" ry="83" fill={`url(#${glowId})`} />
      <g fill="#182c3a" stroke="#548394" strokeWidth="1">
        <path d="M0 130 32 105l20 5 12-27h24l12 26 26 10v36H0ZM235 155v-51l18-9 18 10 12-32h12l12 39 33-12v55Z" />
      </g>
      <g fill="none" stroke="#7cb2b3" strokeWidth="1.4">
        <ellipse cx="176" cy="74" rx="49" ry="19" transform="rotate(-30 176 74)" />
        <ellipse cx="176" cy="74" rx="49" ry="19" transform="rotate(30 176 74)" />
        <ellipse cx="176" cy="74" rx="18" ry="48" />
        <circle cx="176" cy="74" r="37" />
        <path d="m118 139 27-30M206 109l29 30M160 113l-6 42M192 113l6 42" />
      </g>
      <circle cx="176" cy="74" r="9" fill="#b2f4d9" />
      <circle cx="176" cy="74" r="4" fill="#efffec" />
      <g stroke="#537586" strokeWidth="1" opacity=".5">
        <path d="M15 27h59M31 34h55M266 24h63M277 32h39M5 146h331" />
      </g>
    </>
  )
}

function PactScene() {
  return (
    <>
      <rect width="340" height="155" fill="#222b3b" />
      <path d="m0 99 39-23 23 10 50-55 55 67 43-45 67 48 36-25 27 10v69H0Z" fill="#344455" />
      <path d="m79 69 33-38 31 38-24-11-9-6-8 10Z" fill="#80909b" opacity=".5" />
      <path d="m0 132 60-32 50 25 58-27 57 34 67-23 48 25v21H0Z" fill="#152332" />
      <g fill="none" stroke="#8494aa" strokeWidth="1.3">
        <path d="M15 138q149-94 306-9M17 141h309M52 118v22M95 98v42M140 89v51M186 91v49M231 103v37M278 118v22" />
      </g>
      <path d="m173 91 7 14-12 11 12 11-6 14" stroke="#d2ae7f" strokeWidth="2" fill="none" />
      <circle cx="257" cy="37" r="13" fill="#b4bbc5" opacity=".18" />
    </>
  )
}

const EVENT_SCENES: Record<EventArtwork, () => React.JSX.Element> = {
  delegate: DelegateScene,
  reactor: ReactorScene,
  pact: PactScene,
}

/** Decorative event illustration; the adjacent title and outcome controls carry the meaning. */
export function EventSceneArt({ artwork }: { readonly artwork: EventArtwork }) {
  const Scene = EVENT_SCENES[artwork]
  return (
    <svg viewBox="0 0 340 155" className="event-scene-art" aria-hidden="true" focusable="false">
      <Scene />
    </svg>
  )
}

function PushGlyph() {
  return (
    <>
      <circle cx="50" cy="50" r="34" />
      <path d="M50 76V24M30 44l20-20 20 20M27 66V55M73 66V55" />
      <circle cx="50" cy="50" r="43" strokeDasharray="2 8" />
    </>
  )
}

function SuppressGlyph() {
  return (
    <>
      <circle cx="50" cy="50" r="34" />
      <path d="M50 24v52M30 56l20 20 20-20M27 34v11M73 34v11M15 15l10 10M75 75l10 10M85 15 75 25M25 75 15 85" />
    </>
  )
}

function ScanGlyph() {
  return (
    <>
      <circle cx="50" cy="50" r="34" />
      <circle cx="50" cy="50" r="19" />
      <path d="M50 16v34l25-25M50 7v9M50 84v9M7 50h9M84 50h9" />
    </>
  )
}

function NullifyGlyph() {
  return (
    <>
      <path d="m50 9 35 20v42L50 91 15 71V29Z" />
      <circle cx="50" cy="50" r="24" />
      <path d="m32 32 36 36M68 32 32 68" />
    </>
  )
}

function CollideGlyph() {
  return (
    <>
      <circle cx="35" cy="50" r="25" />
      <circle cx="65" cy="50" r="25" />
      <path d="M50 9v17M50 74v17M6 50h9M85 50h9M46 34l9 11-10 9 9 12" />
    </>
  )
}

const CARD_GLYPHS: Record<CardKind, () => React.JSX.Element> = {
  push: PushGlyph,
  suppress: SuppressGlyph,
  scan: ScanGlyph,
  nullify: NullifyGlyph,
  collide: CollideGlyph,
}

/** Decorative card-face glyph; the card name, grade and description carry the meaning. */
export function CardGlyph({ kind }: { readonly kind: CardKind }) {
  const Glyph = CARD_GLYPHS[kind]
  return (
    <svg viewBox="0 0 100 100" className={`card-glyph card-glyph-${kind}`} aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="2">
        <Glyph />
      </g>
    </svg>
  )
}

export function FactionEmblem() {
  return (
    <svg viewBox="0 0 100 100" className="faction-emblem" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="50" cy="50" r="30" />
        <path d="M10 50q40-33 80 0-40 33-80 0Z" />
        <circle cx="50" cy="50" r="12" />
        <path d="M50 5v9M50 86v9M5 50h9M86 50h9M18 18l7 7M75 75l7 7M82 18l-7 7M25 75l-7 7" />
      </g>
    </svg>
  )
}

const ROMAN_GRADES = ['0', 'I', 'II', 'III', 'IV', 'V'] as const

export function GradeBadge({ grade }: { readonly grade: number }) {
  const displayGrade = ROMAN_GRADES[Math.max(0, Math.min(grade, 5))]
  return (
    <span className="grade-badge" aria-label={`Grade ${grade}`}>
      {displayGrade}
    </span>
  )
}
