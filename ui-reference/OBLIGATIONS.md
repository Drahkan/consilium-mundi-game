# Obligations UI (answerIncident + deliverPact)

There is no separate component file. Both live in `ui-reference/play-screen.tsx`.

## answerIncident — pull, not push

After `resolveIfDue` / skipReport, `GET /state` → `kernel.allyIncidents` (or CLI `inboxForPlayer` → `incidents`).

If the current player has an incident with `status` open:

1. Modal (see `IncidentDialog` in play-screen.tsx).
2. Actions map to CLI `answerIncident`:
   - `{ viewerId, incidentId, action: "ignored" }` — keep the alliance
   - `{ viewerId, incidentId, action: "broke" }` — break it
   - `{ viewerId, incidentId, action: "threatened", unless?: string }` — open diplomacy

Do not auto-break. The resolver **queues** the incident; the player answers on their next activity.

## deliverPact — schedule goods this activity

Accepting a trade offer creates a `pact` (promise). Goods are **not** auto-moved.

`inboxForPlayer` → `unsentPacts`. For each pact the current player still owes:

1. Banner: you promised X landing at system S this turn.
2. Player picks a legal landing (use `tradeFrontier`) and calls CLI `deliverPact` `{ playerId, pactId }` **or** `applyTrade` with the pact's resources/system.
3. At resolve, `evaluateDiplomacy` marks kept / partial / broken on `promiseReports`.

Reference: play-screen.tsx `unsentPactsFor` banner + `schedulePactDelivery`.
