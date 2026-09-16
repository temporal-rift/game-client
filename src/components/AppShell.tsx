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
  const [selectedCardId, setSelectedCardId] = useState<string | null>(playerView.pendingAction?.cardId ?? null)
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(playerView.pendingAction?.targetId ?? null)

  const selectedCard = playerView.hand.find((card) => card.id === selectedCardId) ?? null
  const selectedTarget = playerView.events.find((event) => event.id === selectedTargetId) ?? null

  const toggleCard = (id: string) => setSelectedCardId((current) => (current === id ? null : id))
  const toggleTarget = (id: string) => setSelectedTargetId((current) => (current === id ? null : id))

  return (
    <div>
      <BandPatternDefs />
      <header>
        <h1>
          <RiftMark /> Temporal Rift
        </h1>
        <p>
          Era {playerView.currentEra}, round {playerView.currentRound} — {playerView.phaseLabel}
        </p>
        {playerView.phaseDeadlineLabel && <p>Deadline: {playerView.phaseDeadlineLabel}</p>}
        {isSampleData && <p role="status">Showing sample data — not a live game.</p>}
      </header>
      <main>
        <EventBoard events={playerView.events} selectedTargetId={selectedTargetId} onSelectTarget={toggleTarget} />
        <PrivateHand hand={playerView.hand} selectedCardId={selectedCardId} onSelectCard={toggleCard} />
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
