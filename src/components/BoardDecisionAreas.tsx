import type { DeclarationSession } from '../declaration/useDeclaration'
import { DeclarationPanel } from './DeclarationPanel'

export interface BoardDecisionSessions {
  readonly declaration?: DeclarationSession | null
}

export function BoardDecisionAreas({ declaration }: BoardDecisionSessions) {
  if (!declaration || declaration.view.kind === 'unavailable') return null
  return (
    <div className="board-decision-area">
      <DeclarationPanel
        view={declaration.view}
        draft={declaration.draft}
        submitPhase={declaration.submitPhase}
        onSelectMode={declaration.selectMode}
        onSelectTarget={declaration.selectTarget}
        onClearDraft={declaration.clearDraft}
        onSkip={declaration.skip}
        onConfirm={() => void declaration.confirm()}
        onDismissRejection={declaration.dismissRejection}
      />
    </div>
  )
}
