import type { DeclarationSession } from '../declaration/useDeclaration'
import type { KnowledgeSession } from '../knowledge/useKnowledge'
import { DeclarationPanel } from './DeclarationPanel'
import { KnowledgePanel } from './KnowledgePanel'

export interface BoardDecisionSessions {
  readonly declaration?: DeclarationSession | null
  readonly knowledge?: KnowledgeSession | null
}

export function BoardDecisionAreas({ declaration, knowledge }: BoardDecisionSessions) {
  return (
    <>
      {declaration && declaration.view.kind !== 'unavailable' && (
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
      )}
      {knowledge && knowledge.view.kind !== 'unavailable' && (
        <div className="board-knowledge-area">
          <KnowledgePanel
            view={knowledge.view}
            error={knowledge.message}
            isRefreshing={knowledge.isRefreshing}
            onRefresh={() => void knowledge.refresh()}
          />
        </div>
      )}
    </>
  )
}
