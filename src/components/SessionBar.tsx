import type { PlayerIdentity } from '../auth/session'

interface SessionBarProps {
  readonly identity: PlayerIdentity
  readonly onSignOut: () => void
}

function displayLabel(identity: PlayerIdentity): string {
  if (identity.displayName && identity.displayName.length > 0) {
    return identity.displayName
  }
  const subject = identity.subject
  return subject.length > 12 ? `player …${subject.slice(-4)}` : 'Authenticated player'
}

export function SessionBar({ identity, onSignOut }: SessionBarProps) {
  return (
    <div role="status" aria-label="Current player session">
      <span>
        Signed in as <strong>{displayLabel(identity)}</strong>
      </span>{' '}
      <button type="button" onClick={onSignOut}>
        Sign out
      </button>
    </div>
  )
}
