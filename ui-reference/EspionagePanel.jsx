import React, { useState } from "react";

// Drop into frontend/src/EspionagePanel.jsx
// Wire: selected system dock / OrdersTray.
// POST /api/game/{id}/espionage-orders already maps to kernel applyEspionage.
// Cost is always 1 Tech. Kinds: sabotage (fleets|starport), destabilize, counter.
//
// hostileWarning(kind, systemId) should call GET state / a host helper; if the
// kernel would fire hostileOrderWarning, show confirm before onSchedule.

const ACTS = [
  { kind: "sabotage", label: "Sabotage fleets", extra: { targetUpgrade: "fleets" } },
  { kind: "sabotage", label: "Sabotage starport", extra: { targetUpgrade: "starport" } },
  { kind: "destabilize", label: "Destabilize government", extra: {} },
  { kind: "counter", label: "Counter-espionage (here if owned)", extra: {} },
];

export default function EspionagePanel({
  system,
  queued = [],
  tech = 0,
  onSchedule,
  onCancel,
  confirmHostile,
}) {
  const [busy, setBusy] = useState(null);
  if (!system) return null;

  const run = async (act) => {
    const payload = { kind: act.kind, systemId: system.id || system.system_id, ...act.extra };
    const go = async () => {
      setBusy(act.label);
      try {
        await onSchedule(payload);
      } finally {
        setBusy(null);
      }
    };
    if ((act.kind === "sabotage" || act.kind === "destabilize") && confirmHostile) {
      const warn = await confirmHostile(act.kind, payload.systemId);
      if (warn) {
        if (!window.confirm(warn)) return;
      }
    }
    await go();
  };

  return (
    <div className="espionage-panel" data-testid="espionage-panel">
      <div className="espionage-panel-title">Espionage · 1 Tech each</div>
      {ACTS.map((a) => (
        <button
          key={a.label}
          type="button"
          data-testid={`espionage-${a.kind}-${a.extra.targetUpgrade || "default"}`}
          disabled={tech < 1 || busy === a.label}
          onClick={() => run(a)}
        >
          {a.label}
        </button>
      ))}
      {queued.map((e) => (
        <button
          key={e.id}
          type="button"
          className="espionage-queued"
          data-testid={`espionage-cancel-${e.id}`}
          onClick={() => onCancel(e.id)}
        >
          Cancel {e.kind}
          {e.targetUpgrade ? ` / ${e.targetUpgrade}` : ""}
        </button>
      ))}
    </div>
  );
}
