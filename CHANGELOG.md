# Kernel changelog — 2026-09-16 (v5 ping)

BREAKING: none. Ping `"version": 5`. SAVE_VERSION stays **2**.

## recap.snapshot.players (requested)

`TurnSnapshot.players` is a slim list `{ id, name, civName, colors }[]`.
`captureSnapshot` writes it on new frames.
`recap` overlays it even on old blobs (from live `state.players`).
`recap.players` is also at the top level of the recap payload.

Do not store full Player objects on the snapshot.

## Hosting this pass (no kernel)

- App.js hook split (pouch mount / turn-timer / recap-fetch): yes.
- `react/no-undef` (or eslint no-undef): yes — catch isDragging/axios at build.
- Toast kernel 400s on `/espionage-orders` (and other kernel routes): show `error` / `detail` string. Do not swallow.
- Duplicate "Owner" line in info-panel: drop one.
- FOW lobby off/basic already maps to kernel `fow_mode`. Do not add extra FOW modes.
