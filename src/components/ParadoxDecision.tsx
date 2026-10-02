import { describeTargets } from '../action/actionTargeting'
import { CardIllustration } from '../illustrations/catalog'
import type { IllustrationSkin } from '../illustrations/catalogData'
import type { ParadoxResolutionView } from '../paradox/paradoxView'
import type { ParadoxResolutionSession } from '../paradox/useParadoxResolution'
import { TargetLines } from './DecisionParts'

type PhaseView = Exclude<ParadoxResolutionView, { readonly kind: 'unavailable' }>
type OpenPhaseView = Extract<ParadoxResolutionView, { readonly kind: 'open' }>

function OpenParadoxes({ view }: { readonly view: PhaseView }) {
  if (view.paradoxes.length === 0) return null
  const titleOf = (eventId: string) => view.affectedEvents.find((event) => event.eventId === eventId)?.title ?? 'Unknown event'
  return (
    <ul className="decision-targets paradox-summary" aria-label="Open paradoxes">
      {view.paradoxes.map((paradox) => (
        <li key={paradox.paradoxId}>
          {paradox.typeLabel} · {titleOf(paradox.affectedEventId)}
        </li>
      ))}
    </ul>
  )
}

function DraftSummary({
  view,
  session,
  illustrationSkin,
}: {
  readonly view: OpenPhaseView
  readonly session: ParadoxResolutionSession
  readonly illustrationSkin: IllustrationSkin
}) {
  const { draft } = session
  if (draft.kind === 'pass') {
    return (
      <>
        <p className="decision-name">Pass</p>
        <p className="decision-effect">You play no resolution card this phase; no card is spent.</p>
      </>
    )
  }
  const card = draft.kind === 'card' ? view.cards.find((option) => option.cardInstanceId === draft.cardInstanceId) : undefined
  if (draft.kind !== 'card' || !card) {
    return <p className="decision-hint">Choose an eligible resolution card, then an outcome on an affected event, or pass.</p>
  }
  const targets = draft.target
    ? describeTargets({ targetEventId: draft.target.eventId, targetOutcomeId: draft.target.outcomeId }, { events: view.affectedEvents, opponents: [] })
    : []
  return (
    <>
      <span className="decision-art">
        <CardIllustration cardType={card.cardType} skin={illustrationSkin} />
      </span>
      <p className="decision-name">{card.name}</p>
      <p className="decision-grade">Grade {card.grade}</p>
      <TargetLines label="Chosen targets" lines={targets} />
      {!draft.target && <p className="decision-hint">Choose an outcome on an affected event.</p>}
      <p className="decision-effect">{card.effectSummary}</p>
    </>
  )
}

/** The caller's choice for the open phase: what is at stake, the draft or the accepted choice. */
export function ParadoxDecisionPanel({
  session,
  illustrationSkin,
}: {
  readonly session: ParadoxResolutionSession
  readonly illustrationSkin: IllustrationSkin
}) {
  const { view } = session
  if (view.kind === 'unavailable') return null
  let body
  if (view.kind === 'submitted') {
    body = (
      <>
        <output className="decision-status">Your resolution choice is submitted for this phase. Other choices stay hidden.</output>
        <p className="decision-name">{view.acceptedChoice.summary}</p>
        <TargetLines label="Submitted targets" lines={view.acceptedChoice.targets} />
      </>
    )
  } else if (session.submitPhase.kind === 'awaiting-projection') {
    body = <output className="decision-status">Waiting for game state to reflect your choice.</output>
  } else {
    body = <DraftSummary view={view} session={session} illustrationSkin={illustrationSkin} />
  }
  return (
    <section className="decision-panel" aria-live="polite">
      <h2 className="panel-eyebrow">Your resolution</h2>
      <OpenParadoxes view={view} />
      {body}
      <p className="hidden-weights">Exact live weights remain hidden. The server validates your choice.</p>
    </section>
  )
}

function isComplete(session: ParadoxResolutionSession): boolean {
  const { draft } = session
  return draft.kind === 'pass' || (draft.kind === 'card' && draft.target !== null)
}

/** Confirm, pass and clear while the caller can still choose in the open phase. */
export function ParadoxDecisionControls({ session }: { readonly session: ParadoxResolutionSession }) {
  const isSubmitting = session.submitPhase.kind === 'submitting'
  return (
    <div className="decision-controls">
      <button type="button" className="confirm-action" onClick={() => void session.confirm()} disabled={!isComplete(session) || isSubmitting}>
        {isSubmitting ? 'Submitting…' : 'Confirm resolution choice'}
      </button>
      <div className="decision-secondary">
        <button type="button" aria-pressed={session.draft.kind === 'pass'} onClick={session.choosePass} disabled={isSubmitting}>
          Pass
        </button>
        {session.draft.kind !== 'none' && (
          <button type="button" onClick={session.clearDraft} disabled={isSubmitting}>
            Clear selection
          </button>
        )}
      </div>
      <p className="decision-rule">One resolution card or a pass this phase</p>
    </div>
  )
}
