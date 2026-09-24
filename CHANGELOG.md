# Kernel changelog — 2026-09-17 (v6 ping)

BREAKING: none. Ping `"version": 6`. SAVE_VERSION stays **2**.

## Game types

CLI `listGameTypes` → `{ id, name, blurb, victory, victoryLabel, playerRange, fogOfWar, uncharted, turnLimit, disableCommunications, scorchedEarth }[]`.

`openMatchLegacy` reads `config.game_type`. Victory / fog / uncharted / scorched / comms / turnLimit come from that type. Hosted clock stays `turn_time_seconds`. Omit `fow_mode` to use the type default.

Do **not** reimplement Galactic Domination / Last Standing / Corporate / Gunship in Python. Do **not** add a Trade Phase. Do **not** persist Python `_snapshot_state` — `turnSnapshots` is already in the kernel blob.
