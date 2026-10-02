import type { BoardHandCard } from '../board/boardView'
import { formatCountdown, useDeadlineCountdown } from '../game/useDeadlineCountdown'
import type { HandSelectionSession } from '../hand/useHandSelection'
import { CardIllustration } from '../illustrations/catalog'
import type { IllustrationSkin } from '../illustrations/catalogData'
import { GradeBadge } from './icons'

/** Present only while the caller can choose an action this round. */
export interface HandActionControls {
  readonly selectedCardInstanceId: string | null
  /** Cards the open round offers; every other card stays unselectable. */
  readonly selectableCardIds: ReadonlySet<string>
  readonly disabled: boolean
  readonly onSelect: (cardInstanceId: string) => void
}

interface PrivateHandProps {
  readonly hand: readonly BoardHandCard[]
  readonly handSelection?: HandSelectionSession
  readonly illustrationSkin?: IllustrationSkin
  readonly action?: HandActionControls | null
}

function OpenHandOffer({
  view,
  selectedCardInstanceIds,
  submitPhase,
  toggleCard,
  confirm,
  dismissRejection,
  illustrationSkin,
}: {
  readonly view: Extract<HandSelectionSession['view'], { readonly kind: 'open' }>
  readonly selectedCardInstanceIds: HandSelectionSession['selectedCardInstanceIds']
  readonly submitPhase: HandSelectionSession['submitPhase']
  readonly toggleCard: HandSelectionSession['toggleCard']
  readonly confirm: HandSelectionSession['confirm']
  readonly dismissRejection: HandSelectionSession['dismissRejection']
  readonly illustrationSkin: IllustrationSkin
}) {
  const selected = new Set(selectedCardInstanceIds)
  const canConfirm = selected.size === view.requiredSelectionCount && submitPhase.kind !== 'submitting'
  const secondsRemaining = useDeadlineCountdown(view.expiresAt)
  const deadline = secondsRemaining === null ? 'Deadline is being refreshed.' : formatCountdown(secondsRemaining)

  return (
    <section className="private-hand hand-selection" aria-label="Hand selection">
      <div className="section-heading-row">
        <h2>Choose your hand</h2>
        <span>{selected.size} / {view.requiredSelectionCount} selected</span>
      </div>
      <p className="hand-selection-deadline">
        <span>Server deadline</span>
        <strong aria-label="Time remaining">{deadline}</strong>
      </p>
      <p className="hand-selection-instruction">Keep exactly {view.requiredSelectionCount} of your seven private cards.</p>
      {submitPhase.kind === 'rejected' && (
        <div className="hand-selection-rejection" role="alert">
          <p>{submitPhase.message}</p>
          <button type="button" onClick={dismissRejection}>Dismiss</button>
        </div>
      )}
      <ul className="hand-grid hand-offer-grid" aria-label="Private card offer">
        {view.cards.map((card) => {
          const isSelected = selected.has(card.cardInstanceId)
          const isSubmitting = submitPhase.kind === 'submitting'
          return (
            <li key={card.cardInstanceId}>
              <button
                type="button"
                className={`hand-card hand-offer-card${isSelected ? ' is-selected' : ''}`}
                aria-label={`${isSelected ? 'Keeping' : 'Offer'} · ${card.name} · Grade ${card.grade} — ${card.effectSummary}`}
                aria-pressed={isSelected}
                disabled={isSubmitting || (!isSelected && selected.size === view.requiredSelectionCount)}
                onClick={() => toggleCard(card.cardInstanceId)}
              >
                <span className="hand-card-topline">
                  <span className="hand-card-state">{isSelected ? 'Keeping' : 'Offer'}</span>
                  <GradeBadge grade={card.grade} />
                </span>
                <span className="card-glyph-well">
                  <CardIllustration cardType={card.cardType} skin={illustrationSkin} />
                </span>
                <span className="hand-card-name">{card.name}</span>
                <span className="hand-card-description">{card.effectSummary}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <button className="hand-selection-confirm" type="button" disabled={!canConfirm} onClick={() => void confirm()}>
        {submitPhase.kind === 'submitting' ? 'Confirming hand…' : 'Confirm five cards'}
      </button>
    </section>
  )
}

function stateLabel(card: BoardHandCard, isSelected: boolean): string {
  if (!card.isPlayableThisRound) return 'Not playable this round'
  return isSelected ? 'Selected' : 'Playable'
}

function cardClassName(card: BoardHandCard, isSelected: boolean): string {
  return ['hand-card', card.isPlayableThisRound ? '' : 'is-unplayable', isSelected ? 'is-selected' : ''].filter(Boolean).join(' ')
}

export function PrivateHand({ hand, handSelection, illustrationSkin = 'board', action = null }: PrivateHandProps) {
  if (handSelection) {
    const { view, selectedCardInstanceIds, submitPhase, toggleCard, confirm, dismissRejection } = handSelection
    if (view.kind === 'open') {
      return (
        <OpenHandOffer
          view={view}
          selectedCardInstanceIds={selectedCardInstanceIds}
          submitPhase={submitPhase}
          toggleCard={toggleCard}
          confirm={confirm}
          dismissRejection={dismissRejection}
          illustrationSkin={illustrationSkin}
        />
      )
    }
  }

  return (
    <section className="private-hand" aria-labelledby="private-hand-heading">
      <div className="section-heading-row">
        <h2 id="private-hand-heading">Your hand</h2>
        <span>{hand.length} cards · {action ? 'choose one action' : 'private to you'}</span>
      </div>
      <ul className="hand-grid" aria-label="Hand">
        {hand.map((card) => {
          const isSelected = action?.selectedCardInstanceId === card.cardInstanceId
          const content = (
            <>
              <span className="hand-card-topline">
                <span className="hand-card-state">{stateLabel(card, isSelected)}</span>
                <GradeBadge grade={card.grade} />
              </span>
              <span className="card-glyph-well">
                <CardIllustration cardType={card.cardType} skin={illustrationSkin} />
              </span>
              <span className="hand-card-name">{card.name}</span>
              <span className="hand-card-description">{card.effect}</span>
            </>
          )
          return (
            <li key={card.cardInstanceId}>
              {action ? (
                <button
                  type="button"
                  className={cardClassName(card, isSelected)}
                  aria-pressed={isSelected}
                  disabled={action.disabled || !card.isPlayableThisRound || !action.selectableCardIds.has(card.cardInstanceId)}
                  onClick={() => action.onSelect(card.cardInstanceId)}
                >
                  {content}
                </button>
              ) : (
                <div className={cardClassName(card, false)}>{content}</div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
