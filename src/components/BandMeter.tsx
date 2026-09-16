const SEGMENT_PATTERNS = ['url(#band-pattern-outcome-a)', 'url(#band-pattern-outcome-b)', 'url(#band-pattern-outcome-c)']
const NUMERIC_COMPONENT = /^-?\d+(\.\d+)?$/

function parseBand(band: string): readonly number[] | null {
  if (band.trim().toLowerCase() === 'unknown') {
    return null
  }

  const rawParts = band.split('/').map((part) => part.trim())
  if (rawParts.length === 0 || rawParts.some((part) => !NUMERIC_COMPONENT.test(part))) {
    return null
  }

  return rawParts.map(Number)
}

export function BandPatternDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute', overflow: 'hidden' }} aria-hidden="true" focusable="false">
      <defs>
        <pattern id="band-pattern-outcome-a" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="currentColor" opacity="0.85" />
        </pattern>
        <pattern id="band-pattern-outcome-b" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="3" />
        </pattern>
        <pattern id="band-pattern-outcome-c" width="8" height="8" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="4" r="1.6" fill="currentColor" />
        </pattern>
        <pattern id="band-pattern-unknown" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="currentColor" strokeWidth="2" strokeDasharray="2 3" />
        </pattern>
      </defs>
    </svg>
  )
}

export function BandMeter({ band }: { readonly band: string }) {
  const parts = parseBand(band)

  if (!parts) {
    return (
      <span className="band-meter">
        <svg viewBox="0 0 200 16" width="160" height="14" aria-hidden="true" focusable="false">
          <rect width="200" height="16" fill="url(#band-pattern-unknown)" stroke="currentColor" strokeWidth="1" />
        </svg>
        <span className="band-meter-text">Unknown</span>
      </span>
    )
  }

  const total = parts.reduce((sum, value) => sum + value, 0) || 1
  const segments = parts.reduce<Array<{ x: number; width: number; pattern: string }>>((acc, value, index) => {
    const previous = acc[index - 1]
    const x = previous ? previous.x + previous.width : 0
    const width = (value / total) * 200
    acc.push({ x, width, pattern: SEGMENT_PATTERNS[index % SEGMENT_PATTERNS.length] })
    return acc
  }, [])

  return (
    <span className="band-meter">
      <svg viewBox="0 0 200 16" width="160" height="14" aria-hidden="true" focusable="false">
        {segments.map((segment, index) => (
          <rect key={index} x={segment.x} y="0" width={segment.width} height="16" fill={segment.pattern} stroke="currentColor" strokeWidth="0.5" />
        ))}
      </svg>
      <span className="band-meter-text">{parts.join(' / ')}</span>
    </span>
  )
}
