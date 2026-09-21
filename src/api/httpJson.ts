/**
 * The response-body plumbing shared by every participant-scoped HTTP client
 * in this module: safely parsing a JSON body and reading a non-empty string
 * field from it. Each client still defines its own error class (for
 * accurate `instanceof` checks) and its own URL builders/response shapes —
 * only this feature-independent parsing is shared.
 */

export async function readJsonSafe(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const text = await response.text()
    if (!text) {
      return null
    }
    const parsed: unknown = JSON.parse(text)
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}
