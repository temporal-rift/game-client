import { CARD_CATEGORIES, cardCategoryDisplayName } from '../action/actionRules'
import { describeTargets, pickDisguise, targetPrompt, type ActionSelection, type OpenActionRoundView } from '../action/actionTargeting'
import type { AcceptedDecision } from '../action/actionView'
import type { ActionSubmissionSession } from '../action/useActionSubmission'
import type { BoardRoundStatus } from '../board/boardView'
import { CardIllustration, SpecialIllustration } from '../illustrations/catalog'
import type { IllustrationSkin } from '../illustrations/catalogData'
import type { ParadoxResolutionSession } from '../paradox/useParadoxResolution'
import { ParadoxDecisionControls, ParadoxDecisionPanel, ParadoxRejectionNotice } from './ParadoxDecision'

interface ActionRailProps {
  readonly roundStatus: BoardRoundStatus | null
  /** Null on a game page without the caller's own seat. */
  readonly action: ActionSubmissionSession | null
  /** The open round the caller can still act in, with the resolved selection; null otherwise. */
  readonly decision: { readonly round: OpenActionRoundView; readonly selection: ActionSelection } | null
  /** Null on a game page without the caller's own seat. */
  readonly paradox?: ParadoxResolutionSession | null
  /** Whether the caller can still choose in an open paradox-resolution phase. */
  readonly canResolve?: boolean
  readonly illustrationSkin: IllustrationSkin
}

function ownStateLabel(hasSubmitted: boolean | null): string | null {
  if (hasSubmitted === null) return null
  return hasSubmitted ? 'You have submitted' : 'You have not submitted'
}

function TargetLines({ label, lines }: { readonly label: string; readonly lines: readonly string[] }) {
  if (lines.length === 0) return null
  return (
    <ul className="decision-targets" aria-label={label}>
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  )
}

function DisguiseChoice({ selection, onPick }: { readonly selection: ActionSelection; readonly onPick: ActionSubmissionSession['retarget'] }) {
  return (
    <fieldset className="disguise-choice" aria-label="Choose a disguise">
      {CARD_CATEGORIES.map((category) => (
        <button key={category} type="button" aria-pressed={selection.coordinates.disguiseCategory === category} onClick={() => onPick(pickDisguise(category))}>
          {cardCategoryDisplayName(category)}
        </button>
      ))}
    </fieldset>
  )
}

function DraftSummary({
  round,
  selection,
  onRetarget,
  illustrationSkin,
}: {
  readonly round: OpenActionRoundView
  readonly selection: ActionSelection
  readonly onRetarget: ActionSubmissionSession['retarget']
  readonly illustrationSkin: IllustrationSkin
}) {
  const { choice } = selection
  if (!choice) {
    return <p className="decision-hint">Choose a card in your hand or a faction special, or pass.</p>
  }
  if (choice.kind === 'pass') {
    return (
      <>
        <p className="decision-name">Pass</p>
        <p className="decision-effect">You play no card or special this round.</p>
      </>
    )
  }
  const prompt = selection.targetMode ? targetPrompt(selection.targetMode, selection.coordinates, selection.listSize) : null
  const targets = describeTargets(selection.coordinates, { events: round.activeEvents, opponents: round.opponents })
  return (
    <>
      <span className="decision-art">
        {choice.kind === 'card' ? (
          <CardIllustration cardType={choice.card.cardType} skin={illustrationSkin} />
        ) : (
          <SpecialIllustration specialAction={choice.special.specialAction} skin={illustrationSkin} />
        )}
      </span>
      <p className="decision-name">{choice.kind === 'card' ? choice.card.name : choice.special.name}</p>
      <p className="decision-grade">{choice.kind === 'card' ? `Grade ${choice.card.grade}` : 'Faction special'}</p>
      <TargetLines label="Chosen targets" lines={targets} />
      {selection.targetMode === 'DISGUISE' && <DisguiseChoice selection={selection} onPick={onRetarget} />}
      {prompt && <p className="decision-hint">{prompt}</p>}
      <p className="decision-effect">{choice.kind === 'card' ? choice.card.effectSummary : choice.special.effectSummary}</p>
    </>
  )
}

function AcceptedSummary({ decision }: { readonly decision: AcceptedDecision | null }) {
  return (
    <>
      <output className="decision-status">Your action is submitted for this round. Private until round closure.</output>
      {decision && (
        <>
          <p className="decision-name">{decision.summary}</p>
          <TargetLines label="Submitted targets" lines={decision.targets} />
        </>
      )}
    </>
  )
}

function DecisionPanel({ action, decision, illustrationSkin }: Omit<ActionRailProps, 'roundStatus'>) {
  const round = action?.view.kind === 'open' ? action.view : null
  if (!action || !round) return null
  let body
  if (round.hasSubmitted) {
    body = <AcceptedSummary decision={round.acceptedDecision} />
  } else if (decision) {
    body = <DraftSummary round={decision.round} selection={decision.selection} onRetarget={action.retarget} illustrationSkin={illustrationSkin} />
  } else {
    body = <output className="decision-status">Waiting for game state to reflect your action.</output>
  }
  return (
    <section className="decision-panel" aria-live="polite">
      <h2 className="panel-eyebrow">Your action</h2>
      {body}
      <p className="hidden-weights">Exact live weights remain hidden. The server validates your action.</p>
    </section>
  )
}

function DecisionControls({ action, selection }: { readonly action: ActionSubmissionSession; readonly selection: ActionSelection }) {
  const isSubmitting = action.submitPhase.kind === 'submitting'
  return (
    <div className="decision-controls">
      <button type="button" className="confirm-action" onClick={() => void action.confirm()} disabled={!selection.isComplete || isSubmitting}>
        {isSubmitting ? 'Submitting…' : 'Confirm action'}
      </button>
      <div className="decision-secondary">
        <button type="button" aria-pressed={action.draft.kind === 'pass'} onClick={action.choosePass} disabled={isSubmitting}>
          Pass
        </button>
        {selection.choice && (
          <button type="button" onClick={action.clearDraft} disabled={isSubmitting}>
            Clear selection
          </button>
        )}
      </div>
      <p className="decision-rule">One action or a pass this round</p>
    </div>
  )
}

function RejectionNotice({ action }: { readonly action: ActionSubmissionSession }) {
  if (!action.rejection) return null
  const keepsSelection = action.draft.kind !== 'none'
  return (
    <p className="decision-rejection" role="alert">
      {action.rejection.message}
      {keepsSelection && ' Your selection is kept — adjust it and try again.'}{' '}
      <button type="button" onClick={action.dismissRejection}>
        Dismiss
      </button>
    </p>
  )
}

/** The caller's decision for the open window, who has decided (never what), and the window's controls. */
export function ActionRail({ roundStatus, action, decision, paradox = null, canResolve = false, illustrationSkin }: ActionRailProps) {
  const ownState = roundStatus ? ownStateLabel(roundStatus.hasSubmitted) : null
  const inParadoxPhase = paradox !== null && paradox.view.kind !== 'unavailable'
  return (
    <aside className="action-rail">
      {inParadoxPhase ? (
        <ParadoxDecisionPanel session={paradox} illustrationSkin={illustrationSkin} />
      ) : (
        <DecisionPanel action={action} decision={decision} illustrationSkin={illustrationSkin} />
      )}
      <section className="round-status-panel" aria-labelledby="round-status-heading">
        <h2 id="round-status-heading" className="panel-eyebrow">
          Round status
        </h2>
        {roundStatus ? (
          <>
            <p className="submission-count">
              {roundStatus.submittedCount} / {roundStatus.totalPlayers} players submitted
            </p>
            {ownState && (
              <p className="submission-state">
                <span className="status-dot" aria-hidden="true" />
                {ownState}
              </p>
            )}
          </>
        ) : (
          <p className="submission-count">No decision window is open</p>
        )}
        {action && decision && <DecisionControls action={action} selection={decision.selection} />}
        {paradox && canResolve && <ParadoxDecisionControls session={paradox} />}
        {action && <RejectionNotice action={action} />}
        {paradox && <ParadoxRejectionNotice session={paradox} />}
      </section>
    </aside>
  )
}
