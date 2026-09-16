import type { ProbabilityBand } from '../types/playerView'

const LABELS: Record<ProbabilityBand, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  unknown: 'Unknown',
}

export function BandLabel({ band }: { readonly band: ProbabilityBand }) {
  return <span className={`band-label band-${band}`}>{LABELS[band]}</span>
}
