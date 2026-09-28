# Temporal Rift game client

Browser gameplay client for Temporal Rift, using React, TypeScript, Vite and a retained 2D DOM/SVG presentation.

The first milestone is a complete human-playable game for three to five authenticated players and all five factions: invitations/lobbies, private seven-to-five hand selection, three action rounds, faction specials and knowledge, reactive paradox resolution, authoritative results and reload recovery.

## Development

Requires Node.js 22.12 or later.

```bash
cp public/config.js.example public/config.js # then fill in a reachable API/OIDC configuration
npm run dev
```

`npm run dev` first runs `npm ci` whenever `package-lock.json` differs from the one `node_modules` was installed
from (fresh clone, or a pull that changed dependencies), so the dev server never starts against stale packages. On
Windows, stop a running dev server before pulling such a change: it keeps `node_modules` files locked.

`public/config.js` is gitignored and read at startup as `window.__APP_CONFIG__` (see
`src/config/appConfig.ts`) — this is the same mechanism the built image uses in production,
generated there from environment variables instead of hand-edited.

The example targets the local stack started from the sibling `infrastructure` checkout
(`docker compose up -d`): the API is the dev server's own origin, and sign-in goes through that stack's
interactive test issuer at `http://localhost:9000/default`, which accepts any username. The dev server forwards
each API path to its owning service with the same routing as the deployed edge, so the browser never makes a
cross-origin API call:

| Path | Service | Default target (override) |
|---|---|---|
| `/api/v1/games/{id}/state`, `/api/v1/games/{id}/history`, `/ws/` | read-service | `http://localhost:8082` (`READ_SERVICE_URL`) |
| `/api/v1/games/{id}/chains` | timeline-service | `http://localhost:8081` (`TIMELINE_SERVICE_URL`) |
| `/actuator/health`, every other `/api/` path | game-service | `http://localhost:8080` (`GAME_SERVICE_URL`) |

### Pages and sign-in redirects

Each page has its own URL, so reloads, bookmarks and shared links land on the same page:

| Path | Page |
|---|---|
| `/` | Redirects to your started game, your lobby, or `/lobby` |
| `/lobby` | Create or join a game |
| `/lobbies/{lobbyId}` | One lobby; this is also the invitation link (legacy `/?game={lobbyId}` links still work) |
| `/games/{gameId}` | One game's board, action rounds and results |
| `/auth/callback` | OIDC redirect URI |

The OIDC client always uses the fixed redirect URI `{origin}/auth/callback` and post-logout URI `{origin}/`;
the page to return to after sign-in travels in the sign-in `state`, validated as an app-relative path. Register
exactly those two URIs with a real issuer. The local and E2E test issuers accept any redirect URI. Any server in
front of the built client must answer unknown paths with `index.html` (SPA fallback), as the `infrastructure`
edge configurations do; the Vite dev server does this by default.

Other checks, also run in CI:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The shell renders player-safe fixture state (event board, private hand, faction/intel and action confirmation) once the configured API is reachable and the player has signed in through the configured OIDC issuer (authorization code with PKCE, discovered from the issuer's own `.well-known/openid-configuration` and owned by the maintained `oidc-client-ts` SDK — no hand-rolled protocol code, and no dependency on one identity provider's own API conventions). Sessions persist per browser context through the SDK's `localStorage`-backed user store, survive reload, renew silently via a requested refresh token on any issuer that honors `offline_access`, and clear private state on logout, session failure or identity change. Missing/invalid configuration, denied sign-in or a failed connectivity check surface a recoverable error instead of inventing player identity or game state. Authenticated players can create a lobby, share its invitation link, join from it, and start as host with a three-to-five-player roster; membership and host/start state are recovered from the server after reload, and lost join/start responses reconcile before any retry. Participant gameplay state polls with revision reconciliation, controlled backoff and perspective cancellation, reusing the shipped Bearer request helper for authenticated calls. Once a game ends, the client shows the published winner set, ending cause and final scores with permitted reveals only, displays readiness until complete final awards arrive, and recovers the same authoritative result after reload without deriving winners from score order. During an open action round, players see their legal graded cards and owned faction specials with server-supplied availability and remaining budgets, choose the precise target coordinates each requires (single outcome, source/target outcome pair, event list, or player), and submit through the adopted action contract; a lost or rejected response reconciles accepted state before any retry, and an in-progress selection is preserved rather than discarded. Remaining hand selection and gameplay integration follow in later issues.

[Human-playable game milestone](https://github.com/temporal-rift/game-client/milestone/1) · [Gameplay umbrella issue](https://github.com/temporal-rift/game-client/issues/11) · [Project board](https://github.com/orgs/temporal-rift/projects/4)

Start with [the client foundation](https://github.com/temporal-rift/game-client/issues/1) and [the illustrated board](https://github.com/temporal-rift/game-client/issues/2). Contracts, privacy corrections and owning-service prerequisites are tracked alongside the client work.

SVG provides vector artwork and connections; HTML/CSS provides readable text and interactive controls. Later playtesting and simulation work extends this interface without a planned renderer rewrite. Authoritative rules and visibility enforcement belong to the backend.

See the [delivery plan](docs/delivery-plan.md) and [vector gameplay concept](design/gameplay-board-concept.svg). The concept illustrates visual direction using sample state; it is not a screenshot of implemented gameplay.
