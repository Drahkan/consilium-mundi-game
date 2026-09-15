# Kernel changelog — 2026-09-15 (v3 ping)

BREAKING: none. Ping now returns `"version": 3`.

## Shared sight (allies)

`visionOf` treats ally-owned systems (and systems adjacent to ally-owned systems) as visible, same as your own. `playerKnown` is true for allies even under Uncharted. No extra UI modal. HUD chip: "Shared sight: {ally names}" — see ui-reference/play-screen.tsx and ui-reference/SHARED_SIGHT.md.

## inboxForPlayer additions

`owedDeliveries`: `[{ pactId, resources, systemId, otherId }]` — use this in ObligationsHUD. Do **not** read `pact.a.playerId` (that field does not exist). Pact shape is `aId` / `bId` / `give` / `giveSystemId` / `request` / `requestSystemId`.

Also returns `allyIds`.

## Hosting must-fix

ObligationsHUD.jsx `pactHalf` looking at `pact.a.playerId` is wrong. Switch the banner to `inbox.owedDeliveries`.

Lobby: drop the "2 players" option. Kernel min is 3 (`openMatchLegacy` clamps `num_players` to 3–10). Copy: "3–4 admiralties (open seats fill with AI)".
