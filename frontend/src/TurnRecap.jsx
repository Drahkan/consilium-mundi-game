import React from "react";

// Drop into frontend/src/TurnRecap.jsx
// Data: GET /api/game/{id}/recap?player_id=  OR kernel recap CLI
//   { turn, previousTurn, phase, result, winnerIds, log, promiseReports, snapshot }
// Do not invent a third event log. Replay still uses turnSnapshots + ReplayViewer.

function resultLabel(r) {
  if (r === "kept") return "Performed";
  if (r === "partial") return "Performed differently";
  return "Not performed";
}

export default function TurnRecap({ recap, meId, nameOf, onClose, onReplay, onOpenDiplomacy }) {
  if (!recap) return null;
  const ended = recap.phase === "ended";
  const won = (recap.winnerIds || []).includes(meId);
  const reports = recap.promiseReports || [];
  const theirs = reports.filter(
    (r) => r.otherId === meId || (r.kind === "alliance" && (r.actorId === meId || r.otherId === meId)),
  );
  const mine = reports.filter((r) => r.actorId === meId && r.kind !== "alliance");
  const log = recap.log || [];
  const quiet = !theirs.length && !mine.length && !log.length;

  return (
    <div className="turn-recap-scrim" data-testid="turn-recap">
      <div className="turn-recap">
        <p className="turn-recap-eyebrow">
          {ended ? "Final dispatch" : `Turn ${recap.previousTurn} resolved`}
        </p>
        <h2>
          {ended
            ? won && recap.result === "win"
              ? "The galaxy is yours"
              : recap.result === "tie"
                ? "A divided sky"
                : "Your government has fallen"
            : "After-action"}
        </h2>

        {theirs.length > 0 && (
          <section>
            <h3>Their word</h3>
            <ul>
              {theirs.map((r) => (
                <li key={r.id} data-testid={`recap-their-${r.id}`}>
                  <b>{nameOf ? nameOf(r.actorId) : r.actorId}</b>
                  <span data-testid={`recap-result-${r.id}`}>{resultLabel(r.result)}</span>
                  <p>{r.detail}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {mine.length > 0 && (
          <section>
            <h3>Your word</h3>
            <ul>
              {mine.map((r) => (
                <li key={r.id}>
                  {resultLabel(r.result)} — {r.detail}
                </li>
              ))}
            </ul>
          </section>
        )}

        <ul className="turn-recap-log">
          {quiet && <li>The sector was quiet.</li>}
          {log.map((e) => (
            <li key={e.id} data-severity={e.severity}>
              {e.text}
            </li>
          ))}
        </ul>

        <div className="turn-recap-actions">
          {onReplay && recap.snapshotCount > 0 && (
            <button type="button" data-testid="turn-recap-replay" onClick={onReplay}>
              Replay turns
            </button>
          )}
          {onOpenDiplomacy && (
            <button type="button" data-testid="turn-recap-diplomacy" onClick={onOpenDiplomacy}>
              Open pouch
            </button>
          )}
          <button type="button" data-testid="turn-recap-close" onClick={onClose}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
