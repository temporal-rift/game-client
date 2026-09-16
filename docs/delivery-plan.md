# Initial delivery plan

The initial milestone delivers the complete human-playable client and required backend capabilities. Simulation, designer administration and durable balance analytics follow later.

## Agreed starting rules

- Normal victory is checked after the era's complete resolution and scoring. All players simultaneously reaching 20 points or satisfying their faction objective share victory.
- Seal is an ungraded Prophet special. Protection lasts through the era, with at most one accepted use per era and an initial configurable maximum of two uses per game. Remaining uses must survive recovery; rejected or duplicate requests cannot spend extra uses.
- Collide sets the selected pair to an equal integer floor midpoint and transfers any rounding remainder to the third outcome. For example, 50/31/19 becomes 40/40/20; 25/26/49 becomes 25/25/50. Dead Heat requires an eligible highest tie at detection and is not guaranteed merely by playing Collide.
- The browser displays authoritative weights/observations and results; it does not implement outcome selection or victory logic.

These are planned rules. Owning-service issues must implement and verify them before integrated playtests. Seal's scarcity is a provisional balance value.

## Delivery order

1. Build the client foundation and illustrated board with player-safe fixtures.
2. Publish recovery/visibility/targeting contracts and deliver privacy corrections, missing owner capabilities and compatible event consumers.
3. Integrate authentication/lobbies, private selection, round actions and knowledge, reactive resolution, results and reload recovery.
4. Run deployed browser verification with isolated player identities, then facilitate a normal-rule human game.

Deployed identity/routing is infrastructure-owned. Initial synchronization uses authenticated polling. Privileged diagnostics are kept outside the player entry point.

## Rule clarification gates

An advertised interaction with no legal target must be reconciled before implementation. In particular, Unravel currently describes another player's chain while the normal roster permits only one Weaver. The owner issue must establish a reachable interaction or explicitly approved replacement; the browser must not invent it.

The declaration-window and phase-opening reactive offers are starting proposals in the phase issue and must be validated through its specification workflow. OIDC provider and deployment vendor remain configurable implementation choices.

## Backlog

- [feat(player): publish recoverable gameplay view contracts](https://github.com/temporal-rift/apis/issues/74)
- [fix(scoring): authorize score queries and hide private reasons](https://github.com/temporal-rift/game-service/issues/204)
- [fix(notification): prevent hidden faction disclosure in score updates](https://github.com/temporal-rift/read-service/issues/91)
- [feat(player): expose recoverable lobby and own action state](https://github.com/temporal-rift/game-service/issues/205)
- [feat(projection): recover all player-entitled gameplay state](https://github.com/temporal-rift/read-service/issues/92)
- [feat(playtest): provide an isolated browser-playable deployment](https://github.com/temporal-rift/infrastructure/issues/46)
- [feat(client): establish the React TypeScript browser foundation](https://github.com/temporal-rift/game-client/issues/1)
- [feat(board): build the illustrated DOM and SVG gameplay board](https://github.com/temporal-rift/game-client/issues/2)
- [fix(collide): equalize selected weights exactly](https://github.com/temporal-rift/timeline-service/issues/103)
- [feat(specials): complete player-reachable timeline faction effects](https://github.com/temporal-rift/timeline-service/issues/104)
- [feat(victory): evaluate faction objectives and shared era-end wins](https://github.com/temporal-rift/game-service/issues/207)
- [feat(phases): make declarations and reactive paradox play reachable](https://github.com/temporal-rift/game-service/issues/206)
- [feat(factions): complete private intentions and special action rules](https://github.com/temporal-rift/game-service/issues/208)
- [feat(events): adopt the published timeline event major for gameplay](https://github.com/temporal-rift/game-service/issues/203)
- [feat(events): adopt the published timeline event major for gameplay](https://github.com/temporal-rift/read-service/issues/90)
- [feat(auth): support separate OIDC player sessions](https://github.com/temporal-rift/game-client/issues/3)
- [feat(lobby): support invitations and recoverable game membership](https://github.com/temporal-rift/game-client/issues/4)
- [feat(hand): implement private seven-to-five selection](https://github.com/temporal-rift/game-client/issues/7)
- [feat(actions): support graded cards and faction-special targeting](https://github.com/temporal-rift/game-client/issues/6)
- [feat(intel): distinguish public observations from private knowledge](https://github.com/temporal-rift/game-client/issues/8)
- [feat(paradox): support timed reactive resolution decisions](https://github.com/temporal-rift/game-client/issues/5)
- [feat(results): show shared winners and permitted final reveals](https://github.com/temporal-rift/game-client/issues/9)
- [feat(sync): recover player state through authenticated polling](https://github.com/temporal-rift/game-client/issues/10)
- [test(browser): verify complete games with isolated player contexts](https://github.com/temporal-rift/infrastructure/issues/47)
- [feat(gameplay): deliver a complete human-playable browser game](https://github.com/temporal-rift/game-client/issues/11)

Every issue is tracked on the organization board with initial status Todo. The gameplay umbrella links the component issues; completing planning does not imply implementation is complete.

## Visual direction

The [vector concept](../design/gameplay-board-concept.svg) demonstrates event illustrations, graded cards, private faction/intel and clear confirmation. SVG handles artwork; semantic HTML controls and CSS handle interaction and responsive text. Use reusable artwork and components instead of a planned canvas/3D migration.
