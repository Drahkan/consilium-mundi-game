# Espionage panel

Port `EspionagePanel.jsx` into the selected-system dock / OrdersTray.

- Cost: **1 Tech** per action (kernel already charges).
- Actions: sabotage fleets, sabotage starport, destabilize government, counter-espionage.
- Existing route: `POST /api/game/{id}/espionage-orders` → `applyEspionage`.
- Map `counter_espionage` → kernel kind `counter` (already done in kernel_api).
- If targeting an **allied** owned system, confirm first. Kernel `hostileOrderWarning` text; do not auto-break the alliance.

Do not add fake / intercept here unless the kernel already queued them via diplomacy.
