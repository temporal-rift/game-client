interface SignInPanelProps {
  readonly issuerUrl: string
  readonly isSigningIn: boolean
  readonly notice: string | null
  readonly onSignIn: () => void
}

function issuerHost(issuerUrl: string): string {
  try {
    return new URL(issuerUrl).host
  } catch {
    return issuerUrl
  }
}

export function SignInPanel({ issuerUrl, isSigningIn, notice, onSignIn }: SignInPanelProps) {
  return (
    <section aria-labelledby="signin-heading">
      <h1 id="signin-heading">Sign in to play</h1>
      <p>
        Each player signs in through <strong>{issuerHost(issuerUrl)}</strong> so hands and private knowledge stay
        separate. This browser keeps your session private to this context.
      </p>
      {notice && (
        <p role={notice.includes('expired') ? 'status' : 'alert'}>{notice}</p>
      )}
      <button type="button" onClick={onSignIn} disabled={isSigningIn}>
        {isSigningIn ? 'Redirecting to sign-in…' : 'Sign in'}
      </button>
    </section>
  )
}
