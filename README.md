# Temporal Rift game client

Browser gameplay client for Temporal Rift, using React, TypeScript, Vite and a retained 2D DOM/SVG presentation.

The first milestone is a complete human-playable game for three to five authenticated players and all five factions: invitations/lobbies, private seven-to-five hand selection, three action rounds, faction specials and knowledge, reactive paradox resolution, authoritative results and reload recovery.

## Development

Requires Node.js 22.12 or later.

```bash
npm install
cp .env.example .env.local # then fill in a reachable API/OIDC configuration
npm run dev
```

Other checks, also run in CI:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The shell renders player-safe fixture state (event board, private hand, faction/intel and action confirmation) once the configured API is reachable and the player has signed in through the configured OIDC issuer (authorization code with PKCE, discovered from the issuer's own `.well-known/openid-configuration` and owned by the maintained `oidc-client-ts` SDK — no hand-rolled protocol code, and no dependency on one identity provider's own API conventions). Sessions persist per browser context through the SDK's `localStorage`-backed user store, survive reload via silent renewal, and clear private state on logout, session failure or identity change. Missing/invalid configuration, denied sign-in or a failed connectivity check surface a recoverable error instead of inventing player identity or game state. Authenticated players can create a lobby, share its invitation link, join from it, and start as host with a three-to-five-player roster; membership and host/start state are recovered from the server after reload, and lost join/start responses reconcile before any retry. Participant gameplay state polls with revision reconciliation, controlled backoff and perspective cancellation, reusing the shipped Bearer request helper for authenticated calls. Once a game ends, the client shows the published winner set, ending cause and final scores with permitted reveals only, displays readiness until complete final awards arrive, and recovers the same authoritative result after reload without deriving winners from score order. During an open action round, players see their legal graded cards and owned faction specials with server-supplied availability and remaining budgets, choose the precise target coordinates each requires (single outcome, source/target outcome pair, event list, or player), and submit through the adopted action contract; a lost or rejected response reconciles accepted state before any retry, and an in-progress selection is preserved rather than discarded. Remaining hand selection and gameplay integration follow in later issues.

[Human-playable game milestone](https://github.com/temporal-rift/game-client/milestone/1) · [Gameplay umbrella issue](https://github.com/temporal-rift/game-client/issues/11) · [Project board](https://github.com/orgs/temporal-rift/projects/4)

Start with [the client foundation](https://github.com/temporal-rift/game-client/issues/1) and [the illustrated board](https://github.com/temporal-rift/game-client/issues/2). Contracts, privacy corrections and owning-service prerequisites are tracked alongside the client work.

SVG provides vector artwork and connections; HTML/CSS provides readable text and interactive controls. Later playtesting and simulation work extends this interface without a planned renderer rewrite. Authoritative rules and visibility enforcement belong to the backend.

See the [delivery plan](docs/delivery-plan.md) and [vector gameplay concept](design/gameplay-board-concept.svg). The concept illustrates visual direction using sample state; it is not a screenshot of implemented gameplay.
