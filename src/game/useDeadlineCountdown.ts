import { useEffect, useState } from 'react'

export function deadlineRemainingSeconds(deadline: string | null | undefined, now = Date.now()): number | null {
  if (!deadline) return null
  const expiresAt = Date.parse(deadline)
  if (!Number.isFinite(expiresAt)) return null
  return Math.max(0, Math.ceil((expiresAt - now) / 1000))
}

export function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function useDeadlineCountdown(deadline: string | null | undefined): number | null {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!deadline) return
    const interval = globalThis.setInterval(() => setNow(Date.now()), 1000)
    return () => globalThis.clearInterval(interval)
  }, [deadline])

  return deadlineRemainingSeconds(deadline, now)
}
