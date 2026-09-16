import type { PlayerView } from '../types/playerView'
import { ActionConfirmationPanel } from './ActionConfirmationPanel'
import { EventBoard } from './EventBoard'
import { FactionIntelPanel } from './FactionIntelPanel'
import { PrivateHand } from './PrivateHand'

interface AppShellProps {
  readonly playerView: PlayerView
  readonly isSampleData: boolean
}

export function AppShell({ playerView, isSampleData }: AppShellProps) {
  return (
    <div>
      <header>
        <h1>Temporal Rift</h1>
        <p>
          Era {playerView.currentEra}, round {playerView.currentRound}
        </p>
        {isSampleData && <p role="status">Showing sample data — not a live game.</p>}
      </header>
      <main>
        <EventBoard events={playerView.events} />
        <PrivateHand hand={playerView.hand} />
        <FactionIntelPanel faction={playerView.faction} />
        <ActionConfirmationPanel pendingAction={playerView.pendingAction} />
      </main>
    </div>
  )
}
