import type { EventBoardEntry, KnowledgeItem } from '../types/playerView'

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
