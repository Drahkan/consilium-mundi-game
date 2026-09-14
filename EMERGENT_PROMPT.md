# Prompt to paste into Emergent (with this zip attached)

Copy everything below the line.

---

I am attaching a zip of the Consilium Mundi project. It is a full tree, not a patch. Use THESE files as the project. Do not re-download GitHub to replace them. If you can Save to GitHub after the wrap works, do that.

Read GROK_EMERGENT.md and KERNEL.md first. They are standing instructions and outrank any habit of rewriting game rules in Python.

What this zip is:
- frontend/src/App.js — existing lobby, map, orders, ready-up, timer, replay. Keep the URLs.
- backend/kernel_api.py + packages/consilium-kernel/cli.mjs — TypeScript rules kernel, run with Node. HTTP is already mounted via mount_kernel(app) in backend/server.py.
- class GameEngine in server.py is legacy. Do not add features to it. Do not restore its HTTP routes. Do not apply *.grok_broken.bak.

Your job:
1. Unpack this zip as the project.
2. Put Node on the API host if missing. Do NOT port the kernel to Python.
3. Boot. Confirm create-game / join / map / move / ready / resolve work with existing App.js. New matches must not construct GameEngine.
4. After that loop works: port ui-reference/diplomacy-modal.tsx so offers show goods GIVEN and RECEIVED, with Accept / Decline / Counter. Kernel ops: sendDispatch, acceptDispatch, declineDispatch, counterDispatch. No free-text chat.
5. Save to GitHub if you can.

When finished, reply with EXACTLY this report (fill every field; paste command output, do not paraphrase). I will hand this report to the other environment.

```
## Kernel wrap report
Ping command: echo '{"op":"ping"}' | node packages/consilium-kernel/cli.mjs
Ping stdout:
Node version:
KERNEL.md present: yes/no
GROK_EMERGENT.md present: yes/no
mount_kernel(app) in server.py: yes/no
GameEngine HTTP routes still registered: yes/no
New matches construct GameEngine: yes/no

POST /api/create-game request body:
POST /api/create-game status + JSON:
POST /api/join-game status + JSON (or N/A):
GET /api/game/{id}/state?player_id= keys:
State.systems is a dict: yes/no
State has player_resources: yes/no
State has kernel.threads: yes/no

Create → join → order → ready → resolve: pass/fail
Error text if fail:

Diplomacy pouch ported (Accept/Decline/Counter + goods visible): yes/no
Files changed (paths only):
Git pushed: yes/no
Commit hash or "not pushed":

Do not invent remaining work. Remaining (only real blockers):
```
