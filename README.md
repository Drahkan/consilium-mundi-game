# Consilium Mundi (hosted)

Two environments, one game. **Read `GROK_EMERGENT.md` first.**

- **Grok** owns the rules kernel: `packages/consilium-kernel/`
- **Emergent** owns lobby, clocks, Mongo, deploy, and `frontend/src/App.js`

This archive is already wired: FastAPI calls Node (`cli.mjs`) instead of
`GameEngine.resolve_turn`. Do not undo that.

| File | Why it exists |
|---|---|
| `GROK_EMERGENT.md` | Standing split of labor. Pin this in Emergent. |
| `KERNEL.md` | Sealed-kernel law (do not rewrite combat/mapgen/diplomacy). |
| `HOSTING.md` | How `kernel_api.py` maps onto App.js JSON. |
| `EMERGENT_PROMPT.md` | Paste-ready prompt to send with this zip. |
| `ui-reference/` | Diplomacy pouch, map, play HUD — port into App.js; do not invent a chat box. |

API host needs **Node** on PATH.

```
echo '{"op":"ping"}' | node packages/consilium-kernel/cli.mjs
```

Must print `"pong": true`.
