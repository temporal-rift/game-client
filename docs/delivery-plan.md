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

- [Define complete participant-scoped gameplay contracts](https://github.com/temporal-rift/apis/issues/74)
- [See scores without losing hidden-faction privacy](https://github.com/temporal-rift/game-service/issues/204)
- [Receive score updates that preserve hidden factions](https://github.com/temporal-rift/read-service/issues/91)
- [Resume my lobby and accepted gameplay decisions](https://github.com/temporal-rift/game-service/issues/205)
- [Recover my complete private-perspective game view](https://github.com/temporal-rift/read-service/issues/92)
- [Play through an isolated authenticated browser deployment](https://github.com/temporal-rift/infrastructure/issues/46)
- [Open a reliable browser gameplay interface](https://github.com/temporal-rift/game-client/issues/1)
- [Understand and interact with the illustrated gameplay board](https://github.com/temporal-rift/game-client/issues/2)
- [Create exact selected-outcome ties with Collide](https://github.com/temporal-rift/timeline-service/issues/103)
- [Use reachable causal and cross-era faction effects](https://github.com/temporal-rift/timeline-service/issues/104)
- [Receive complete era-end victories and shared results](https://github.com/temporal-rift/game-service/issues/207)
- [Declare and respond to paradoxes before their deadlines](https://github.com/temporal-rift/game-service/issues/206)
- [Use faction specials with private intentions and clear limits](https://github.com/temporal-rift/game-service/issues/208)
- [Keep gameplay consistent across published timeline event versions](https://github.com/temporal-rift/game-service/issues/203)
- [Keep gameplay consistent across published timeline event versions](https://github.com/temporal-rift/read-service/issues/90)
- [Sign in with my own private player session](https://github.com/temporal-rift/game-client/issues/3)
- [Invite players and resume my game lobby](https://github.com/temporal-rift/game-client/issues/4)
- [Choose and recover my private five-card hand](https://github.com/temporal-rift/game-client/issues/7)
- [Confirm graded cards and legal faction-special targets](https://github.com/temporal-rift/game-client/issues/6)
- [Distinguish public observations from my private knowledge](https://github.com/temporal-rift/game-client/issues/8)
- [Make timed choices during paradox resolution](https://github.com/temporal-rift/game-client/issues/5)
- [See authoritative shared winners and final reveals](https://github.com/temporal-rift/game-client/issues/9)
- [Resume safely after reload or interrupted requests](https://github.com/temporal-rift/game-client/issues/10)
- [Verify complete games with separate private player views](https://github.com/temporal-rift/infrastructure/issues/47)
- [Play a complete private multiplayer Temporal Rift game](https://github.com/temporal-rift/game-client/issues/11)

All 25 backlog issues use the user-story format: explicit user outcomes, acceptance scenarios, rules, scope, compatibility and Definition of Done. Each is classified with the user-story label and tracked on the organization board. The gameplay umbrella links the component issues; completing planning does not imply implementation is complete.

## Visual direction

The [vector concept](../design/gameplay-board-concept.svg) demonstrates event illustrations, graded cards, private faction/intel and clear confirmation. SVG handles artwork; semantic HTML controls and CSS handle interaction and responsive text. Use reusable artwork and components instead of a planned canvas/3D migration.
