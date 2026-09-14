# Grok + Emergent — standing contract for Consilium Mundi

Read this before changing anything. If a user prompt conflicts with this file
on **rules**, this file wins. If it conflicts on **lobby / timer / deploy**,
keep the working hosted UI.

There are two development environments. They are not competitors and they
must not both own the same code.

| Layer | Who owns it | Where it lives |
|---|---|---|
| Rules (combat, mapgen, diplomacy, alliances, pacts, victory, AI admiralties, `GameState`) | **Grok** | `packages/consilium-kernel/` + `KERNEL.md` |
| Hosting (FastAPI, lobby, join codes, ready-up, turn timer, Mongo, deploy, App.js chrome) | **Emergent** | `backend/server.py` routes, `backend/persistence.py`, `frontend/src/App.js` |

Grok ships a sealed TypeScript kernel. Emergent wraps it. Emergent does **not**
reimplement `resolve_turn`, galaxy generation, or diplomacy in Python.

## What this zip already did

HTTP routes are already mounted on the kernel:

```python
from kernel_api import mount_kernel
mount_kernel(app)
```

`class GameEngine` is still in `backend/server.py` so old in-process unit tests
compile. **Do not add features to it. Do not restore its HTTP routes. Do not
apply `*.grok_broken.bak`.**

`backend/kernel_api.py` speaks the JSON `frontend/src/App.js` already expects
(`systems` as a dict, `owner`, `connections`, `starfleet_details`,
`player_resources`, `combat_reports`, `ready_players`, `turn_deadline`,
`game_over`). Do not change App.js URLs to “fix” the wrap.

`GET /state` also includes a `kernel` object (threads, alliances, pacts, civs)
that App.js may ignore until the diplomacy pouch is ported.

## Required runtime

The API host must have **Node.js** on PATH. The kernel is

```
node packages/consilium-kernel/cli.mjs
```

stdin = one JSON object `{ "op": "...", ... }`
stdout = one JSON object `{ "ok": true, "state": ..., "view": ... }`

Prove it:

```
echo '{"op":"ping"}' | node packages/consilium-kernel/cli.mjs
```

Must print `"pong": true`. If Node is missing, install Node. **Do not port the
kernel to Python.**

## What you (Emergent) should do with this zip

1. Replace the project files with the contents of this archive (it is a full
   tree, not a patch). Keep secrets in `.env`; do not commit them.
2. Confirm `node` is on the API image and ping succeeds.
3. Boot the app. Create-game / join / map / move / ready / resolve must work
   through the existing App.js. New matches must **not** construct `GameEngine`.
4. After that loop works, port `ui-reference/diplomacy-modal.tsx` into App.js
   so diplomatic offers show **what is given and what is received** and have
   **Accept / Decline / Counter**. Use kernel ops `sendDispatch`,
   `acceptDispatch`, `declineDispatch`, `counterDispatch`. Do not invent a
   free-text chat box. Templated diplomacy is a design-doc rule.
5. Save to GitHub when the wrap is running.

## What you must not do

- Rewrite, translate, or “simplify” `packages/consilium-kernel/`
- Invent `resolve.py` / a second `GameState`
- Expand `class GameEngine`
- Apply `_grok_patch/` or `*.grok_broken.bak`
- Restyle the in-game chrome into a dashboard, IDE, or SaaS admin
- Implement diplomacy as a stub or a chat log

## Split going forward

- Rules / feel / diplomacy / mapgen bugs → Brandon takes them to **Grok**, who
  returns a kernel zip. You unpack `packages/consilium-kernel/` byte-for-byte
  (including `cli.mjs`) and leave hosting alone.
- Lobby / timer / Mongo / deploy / App.js chrome bugs → **you** fix them.
  Do not touch kernel files to do it.

If KERNEL.md and a user request disagree about **rules**, stop and say so
instead of “fixing” the kernel.
