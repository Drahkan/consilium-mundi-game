import React, { useEffect, useState } from "react";

// Drop into frontend/src/GameTypeSelect.jsx
// GET /api/game-types → CLI listGameTypes
// Pass selected id as create-game config.game_type

export default function GameTypeSelect({ value, onChange, types }) {
  const [rows, setRows] = useState(types || []);
  useEffect(() => {
    if (types) return;
    fetch("/api/game-types")
      .then((r) => r.json())
      .then((d) => setRows(d.gameTypes || d.types || []))
      .catch(() => {});
  }, [types]);
  const cur = rows.find((t) => t.id === value) || rows[0];
  return (
    <div className="game-type-select" data-testid="landing-game-type">
      <label>Scenario</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {rows.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} — {t.victoryLabel}
          </option>
        ))}
      </select>
      {cur && <p className="game-type-blurb">{cur.blurb}</p>}
    </div>
  );
}
