import type { PlayerIdentity } from '../auth/session'

interface SessionBarProps {
  readonly identity: PlayerIdentity
  readonly faction: string | null
  readonly onSignOut: () => void
}

function displayLabel(identity: PlayerIdentity): string {
  if (identity.displayName && identity.displayName.length > 0) {
    return identity.displayName
  }
  const subject = identity.subject
  return subject.length > 12 ? `player …${subject.slice(-4)}` : 'Authenticated player'
}

export function SessionBar({ identity, faction, onSignOut }: SessionBarProps) {
  return (
    <output aria-label="Current player session">
      <span>
        Signed in as <strong>{displayLabel(identity)}</strong>
      </span>{' '}
      {faction && (
        <span aria-label="Your faction">
          Your faction: <strong>{faction}</strong>
        </span>
      )}{' '}
      <button type="button" onClick={onSignOut}>
        Sign out
      </button>
    </output>
  )
}
