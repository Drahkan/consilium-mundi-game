# Shared sight with allies

No separate modal. When two admiralties are allied, each sees the other's owned systems (and adjacent systems) as if they owned them. Kernel does this in `visionOf` — `viewLegacy` / GET /state already fog correctly after kernel v3.

HUD: one line, same place as the turn counter in ui-reference/play-screen.tsx:

```
Shared sight: The Xeni, House Voss
```

Data: GET /diplomacy/inbox/{pid} → `allyIds`, or `kernel.alliances` on GET /state.

Do not invent a "Shared Sight" panel, map overlay chrome, or a toggle. Allies always share sight; breaking the alliance ends it.
