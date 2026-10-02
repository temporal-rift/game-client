import { useEffect, useId, useState } from 'react'
import type { RoundSummaryView } from '../round-summary/roundSummaryView'
import { RoundSummaryPanel } from './RoundSummaryPanel'

type ReadySummary = Extract<RoundSummaryView, { kind: 'ready' }>

function SummaryPresentation({ view }: { readonly view: ReadySummary }) {
  const [presentation, setPresentation] = useState<'brief' | 'open' | 'closed'>('brief')
  const contentId = useId()
  const expanded = presentation !== 'closed'

  useEffect(() => {
    if (presentation !== 'brief') return
    const timer = window.setTimeout(() => setPresentation('closed'), 6_000)
    return () => window.clearTimeout(timer)
  }, [presentation])

  return (
    <section className="board-round-summary" aria-label="Round recap" onFocusCapture={() => setPresentation((current) => current === 'brief' ? 'open' : current)}>
      <div className="board-summary-bar">
        <output>Era {view.eraNumber} · Round {view.roundNumber} closed</output>
        <div className="board-summary-controls">
          {expanded && (
            <button type="button" onClick={() => setPresentation('open')}>Keep summary open</button>
          )}
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={contentId}
            onClick={() => setPresentation(expanded ? 'closed' : 'open')}
          >
            Last round summary
          </button>
        </div>
      </div>
      <div id={contentId} hidden={!expanded}>
        <RoundSummaryPanel view={view} />
      </div>
    </section>
  )
}

export function BoardRoundSummary({ view }: { readonly view: RoundSummaryView }) {
  if (view.kind !== 'ready') return null
  return <SummaryPresentation key={JSON.stringify([view.gameId, view.eraNumber, view.roundNumber])} view={view} />
}
