interface ConfigurationErrorNoticeProps {
  readonly errors: readonly string[]
}

export function ConfigurationErrorNotice({ errors }: ConfigurationErrorNoticeProps) {
  return (
    <div role="alert">
      <h1>Client is not configured</h1>
      <p>The application cannot start until its runtime configuration is fixed.</p>
      <ul>
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </div>
  )
}
