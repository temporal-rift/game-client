import type { BoardView } from '../board/boardView'
import type { DeclarationSession } from '../declaration/useDeclaration'
import type { HandSelectionSession } from '../hand/useHandSelection'

interface PhaseInstructions {
  readonly title: string
  readonly instruction: string
  readonly next: string
}

function declarationGuideFor(declaration?: DeclarationSession | null): PhaseInstructions {
  let instruction: string
  const title = 'Before Round 1: optional public declaration'
  if (declaration?.view.kind === 'open') instruction = 'As an Activist, you may publicly back one outcome with Rally or eligible Momentum. Declaring uses your Round 1 action. Decline if you prefer to play a card or another special in Round 1.'
  else if (declaration?.view.kind === 'submitted') instruction = 'Your declaration is accepted and counts as your Round 1 action. You do not need to choose again in Round 1.'
  else instruction = 'You do not need to act in this phase. Only eligible Activists can declare. You can read your cards and plan your Round 1 action.'
  if (declaration?.submitPhase.kind === 'skipped') instruction = 'You declined the declaration. Your ordinary Round 1 action is still available.'
  if (declaration?.submitPhase.kind === 'submitting') instruction = 'Your decision is being submitted. Wait for the server acknowledgement.'
  if (declaration?.submitPhase.kind === 'declining') instruction = 'Your decline is being submitted. Wait for the server acknowledgement.'
  if (declaration?.submitPhase.kind === 'awaiting-projection') instruction = 'Your declaration is being reconciled. Wait for authoritative game state before choosing again.'
  if (declaration?.submitPhase.kind === 'decline-unknown') instruction = 'The decline response was lost. Use Retry decline to recover the server decision before choosing again.'
  const next = 'Round 1 opens when declaration decisions are finished, or the decision limit expires.'
  return { title, instruction, next }
}

function handGuideFor(handSelection?: HandSelectionSession): PhaseInstructions {
  const title = 'Build your hand for this era'
  const instruction = handSelection?.view.kind === 'accepted' || handSelection?.submitPhase.kind === 'submitted'
    ? 'Your five cards are kept. Wait for the other players to finish; you can use this time to read your faction abilities.'
    : 'Read the seven offered cards, choose the five you want to keep, then confirm. Consider your faction goal and the current events. Unused cards will be discarded at the end of this era.'
  const next = 'After everyone keeps a hand, Activists have an optional declaration opportunity before Round 1. If your selection time expires, five cards are kept at random.'
  return { title, instruction, next }
}

function actionGuideFor(view: BoardView): PhaseInstructions {
  let next: string
  const round = view.header.round?.number
  const title = `Round ${round ?? ''}: choose one action`
  const instruction = view.roundStatus?.hasSubmitted
    ? 'Your action is submitted. Wait for the other players; you cannot submit a second action this round.'
    : 'Choose one playable card or available faction special, select its highlighted targets, review your choice, then confirm. You can also pass. Choices are secret and resolve together; submitting last gives no advantage.'
  if (round === 3) next = 'After everyone decides or time expires, the era resolves. Any detected paradox opens a separate reaction phase.'
  else if (round === 2) next = 'After this round resolves, updated public probability bands appear before Round 3 opens.'
  else next = 'After this round resolves, review the summary and any private information before choosing in Round 2.'
  return { title, instruction, next }
}

function paradoxGuideFor(view: BoardView): PhaseInstructions {
  const title = 'React to the paradox'
  const instruction = view.roundStatus?.hasSubmitted
    ? 'Your reaction is submitted. Wait for the other players to decide.'
    : 'Review the marked events. Choose an offered resolution card, select a highlighted target, then confirm, or pass. Faction specials are unavailable in this phase.'
  const next = 'When reactions finish or time expires, the events resolve or cascade, then scores are evaluated.'
  return { title, instruction, next }
}

function passiveGuideFor(phase: BoardView['header']['phase']): PhaseInstructions {
  const text = {
    LOBBY: ['Waiting for the game to begin', 'Use Cards & factions to learn the shared rules.', 'The host starts the game when the lobby is ready.'],
    ERA_START: ['Preparing the next era', 'No action is needed while events and private card offers arrive.', 'You will choose five cards from your next seven-card offer.'],
    RESOLUTION: ['Resolving this era', 'No action is needed. The game applies actions and checks for paradoxes.', 'You may receive a paradox reaction choice; otherwise outcomes and scores follow.'],
    ERA_END: ['Review this era’s results', 'Review the outcomes and scores. No action is needed during the transition.', 'A new era begins unless a victory or special ending finishes the game.'],
    GAME_ENDED: ['The game has ended', 'Review the final scores, revealed factions and results.', 'Return to the lobby when you are ready.'],
  } as const
  const entry = text[phase as keyof typeof text] ?? text.ERA_START
  const [title, instruction, next] = entry
  return { title, instruction, next }
}

function guideFor(view: BoardView, handSelection?: HandSelectionSession, declaration?: DeclarationSession | null): PhaseInstructions {
  switch (view.header.phase) {
    case 'DECLARATION': return declarationGuideFor(declaration)
    case 'HAND_SELECTION': return handGuideFor(handSelection)
    case 'ACTION_ROUND_1':
    case 'ACTION_ROUND_2':
    case 'ACTION_ROUND_3': return actionGuideFor(view)
    case 'PARADOX_RESOLUTION': return paradoxGuideFor(view)
    default: return passiveGuideFor(view.header.phase)
  }
}

export function PhaseGuide({ view, handSelection, declaration, decisionPending = false }: {
  readonly view: BoardView
  readonly handSelection?: HandSelectionSession
  readonly declaration?: DeclarationSession | null
  readonly decisionPending?: boolean
}) {
  const guide = guideFor(view, handSelection, declaration)
  const instruction = decisionPending ? 'Waiting for the server to confirm your decision. Do not make another choice yet.' : guide.instruction
  return <section className="phase-guide" aria-label="What to do now"><h2>{guide.title}</h2><p>{instruction}</p><p className="phase-next"><strong>Next: </strong>{guide.next}</p></section>
}
