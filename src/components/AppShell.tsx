import { useState } from 'react'
import type { PlayerView } from '../types/playerView'
import { ActionConfirmationPanel } from './ActionConfirmationPanel'
import { BandPatternDefs } from './BandMeter'
import { EventBoard } from './EventBoard'
import { FactionIntelPanel } from './FactionIntelPanel'
import { PrivateHand } from './PrivateHand'
import { RiftMark } from './icons'

interface AppShellProps {
  readonly playerView: PlayerView
  readonly isSampleData: boolean
}

export function AppShell({ playerView, isSampleData }: AppShellProps) {
  const [seededGameId, setSeededGameId] = useState(playerView.gameId)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(playerView.pendingAction?.cardId ?? null)
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(playerView.pendingAction?.targetId ?? null)

  if (playerView.gameId !== seededGameId) {
    setSeededGameId(playerView.gameId)
    setSelectedCardId(playerView.pendingAction?.cardId ?? null)
    setSelectedTargetId(playerView.pendingAction?.targetId ?? null)
  }

  // A selection surviving a same-game state refresh must still resolve against the
  // latest hand/events: a card can be spent and a once-valid target can stop being legal.
  const effectiveCardId = playerView.hand.some((card) => card.id === selectedCardId) ? selectedCardId : null
  const targetCandidate = playerView.events.find((event) => event.id === selectedTargetId) ?? null
  const effectiveTargetId = targetCandidate?.isValidTarget ? selectedTargetId : null

  const selectedCard = playerView.hand.find((card) => card.id === effectiveCardId) ?? null
  const selectedTarget = targetCandidate?.isValidTarget ? targetCandidate : null

  const toggleCard = (id: string) => setSelectedCardId(effectiveCardId === id ? null : id)
  const toggleTarget = (id: string) => setSelectedTargetId(effectiveTargetId === id ? null : id)

  return (
    <div>
      <BandPatternDefs />
      <header>
        <h1>
          <RiftMark /> Temporal Rift
        </h1>
        <p className="status-row">
          <span className="pill">Era {playerView.currentEra}</span>
          <span className="pill">Round {playerView.currentRound}</span>
          <span className="pill">{playerView.phaseLabel}</span>
        </p>
        {playerView.phaseDeadlineLabel && <p className="deadline">Deadline: {playerView.phaseDeadlineLabel}</p>}
        {isSampleData && <p role="status">Showing sample data — not a live game.</p>}
      </header>
      <main>
        <EventBoard events={playerView.events} selectedTargetId={effectiveTargetId} onSelectTarget={toggleTarget} />
        <PrivateHand hand={playerView.hand} selectedCardId={effectiveCardId} onSelectCard={toggleCard} />
        <FactionIntelPanel faction={playerView.faction} />
        <ActionConfirmationPanel
          selectedCard={selectedCard}
          selectedTarget={selectedTarget}
          confirmLabel={playerView.pendingAction?.confirmLabel ?? 'Confirm action'}
          isSampleData={isSampleData}
        />
      </main>
    </div>
  )
}
