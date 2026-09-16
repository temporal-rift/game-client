interface ConnectivityErrorNoticeProps {
  readonly reason: string
  readonly onRetry: () => void
}

export function ConnectivityErrorNotice({ reason, onRetry }: ConnectivityErrorNoticeProps) {
  return (
    <div role="alert">
      <h1>Could not connect</h1>
      <p>{reason}</p>
      <button type="button" onClick={onRetry}>
        Retry
      </button>
    </div>
  )
}
