export function TargetLines({ label, lines }: { readonly label: string; readonly lines: readonly string[] }) {
  if (lines.length === 0) return null
  return (
    <ul className="decision-targets" aria-label={label}>
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  )
}

/** A rejected or failed submission, shown until dismissed or the player makes a new choice. */
export function RejectionNotice({
  rejection,
  keepsSelection,
  onDismiss,
}: {
  readonly rejection: { readonly message: string } | null
  readonly keepsSelection: boolean
  readonly onDismiss: () => void
}) {
  if (!rejection) return null
  return (
    <p className="decision-rejection" role="alert">
      {rejection.message}
      {keepsSelection && ' Your selection is kept — adjust it and try again.'}{' '}
      <button type="button" onClick={onDismiss}>
        Dismiss
      </button>
    </p>
  )
}
