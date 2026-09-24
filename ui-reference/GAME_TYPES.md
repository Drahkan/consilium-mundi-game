# Game types (lobby)

Victory conditions already live in the kernel (`evaluateVictory`). Do **not** reimplement them in Python. Do **not** invent a Trade Phase.

CLI:
```
echo '{"op":"listGameTypes"}' | node packages/consilium-kernel/cli.mjs
echo '{"op":"optionsForType","gameType":"ragnarok","playerCount":3}' | node packages/consilium-kernel/cli.mjs
```

Create-game `config.game_type` one of:
`standard` | `ragnarok` | `reckoning` | `weekend` | `tradeWars` | `postApocalypse`

`openMatchLegacy` applies that type's victory, fog, uncharted, scorchedEarth, disableCommunications, turnLimit. Hosted turn *timer* stays `turn_time_seconds` (kernel `turnDuration` stays `none`). `fow_mode` is an override; omit it to use the type default.

Lobby: dropdown from `listGameTypes` (name + blurb + victoryLabel). HUD: `kernel.options.victory` / victoryLabel. End screen already uses `kernel.result`.

Replay snapshots: already in `engine.turnSnapshots` inside the serialize blob. Do **not** wire Python `_snapshot_state`.
