import type { PublicBandOutcome } from '../api/projection'

/** A public band as shown to players; `unknown` where none is published. Never an exact weight. */
export type ProbabilityBand = Lowercase<PublicBandOutcome['band']> | 'unknown'

export function toProbabilityBand(band: PublicBandOutcome['band']): ProbabilityBand {
  return band.toLowerCase() as Lowercase<PublicBandOutcome['band']>
}
