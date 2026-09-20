interface AuthErrorNoticeProps {
  readonly message: string
  readonly onRetry: () => void
  readonly onSignOut: () => void
}

export function AuthErrorNotice({ message, onRetry, onSignOut }: AuthErrorNoticeProps) {
  return (
    <div role="alert">
      <h1>Sign-in needs attention</h1>
      <p>{message}</p>
      <button type="button" onClick={onRetry}>
        Try signing in again
      </button>{' '}
      <button type="button" onClick={onSignOut}>
        Start over
      </button>
    </div>
  )
}
