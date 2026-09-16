# Temporal Rift game client

Browser gameplay client for Temporal Rift, using React, TypeScript, Vite and a retained 2D DOM/SVG presentation.

This repository currently contains the agreed visual direction and delivery backlog. The application has not been implemented yet.

The first milestone is a complete human-playable game for three to five authenticated players and all five factions: invitations/lobbies, private seven-to-five hand selection, three action rounds, faction specials and knowledge, reactive paradox resolution, authoritative results and reload recovery.

[Human-playable game milestone](https://github.com/temporal-rift/game-client/milestone/1) · [Gameplay umbrella issue](https://github.com/temporal-rift/game-client/issues/11) · [Project board](https://github.com/orgs/temporal-rift/projects/4)

Start with [the client foundation](https://github.com/temporal-rift/game-client/issues/1) and [the illustrated board](https://github.com/temporal-rift/game-client/issues/2). Contracts, privacy corrections and owning-service prerequisites are tracked alongside the client work.

SVG provides vector artwork and connections; HTML/CSS provides readable text and interactive controls. Later playtesting and simulation work extends this interface without a planned renderer rewrite. Authoritative rules and visibility enforcement belong to the backend.

See the [delivery plan](docs/delivery-plan.md) and [vector gameplay concept](design/gameplay-board-concept.svg). The concept illustrates visual direction using sample state; it is not a screenshot of implemented gameplay.
