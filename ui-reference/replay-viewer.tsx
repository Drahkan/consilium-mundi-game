import { useEffect, useMemo, useState } from "react";
import { Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GameState, TurnSnapshot } from "@/lib/game/types";
import { empireColor, UNOWNED_INK } from "@/lib/game/vision";

export function ReplayViewer({
  state,
  onClose,
}: {
  state: GameState;
  onClose: () => void;
}) {
  const frames = state.turnSnapshots ?? [];
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing || frames.length === 0) return;
    const t = window.setInterval(() => {
      setIdx((i) => {
        if (i >= frames.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 1400);
    return () => window.clearInterval(t);
  }, [playing, frames.length]);

  if (!frames.length) {
    return (
      <div className="absolute inset-0 z-50 grid place-items-center bg-bg/80 p-4">
        <div className="max-w-md rounded-xl bg-surface p-5 hairline">
          <h2 className="font-display text-2xl">No turns recorded</h2>
          <Button className="mt-4 w-full" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  const frame = frames[Math.min(idx, frames.length - 1)]!;

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-bg">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-faint">Full replay · fog lifted</p>
          <h2 className="font-display text-2xl">Turn {frame.turn}</h2>
        </div>
        <button onClick={onClose} className="grid size-11 place-items-center rounded-md hover:bg-raised" aria-label="Close replay">
          <X className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <ReplayMap state={state} frame={frame} />
      </div>
      <div className="border-t border-border px-4 py-3">
        <input
          type="range"
          min={0}
          max={frames.length - 1}
          value={idx}
          onChange={(e) => {
            setPlaying(false);
            setIdx(Number(e.target.value));
          }}
          className="w-full accent-[var(--color-accent)]"
          aria-label="Turn scrubber"
        />
        <div className="mt-3 flex items-center justify-center gap-2">
          <Button variant="secondary" size="icon" onClick={() => { setPlaying(false); setIdx((i) => Math.max(0, i - 1)); }} aria-label="Previous turn">
            <SkipBack className="size-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => {
              if (idx >= frames.length - 1) setIdx(0);
              setPlaying((p) => !p);
            }}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>
          <Button variant="secondary" size="icon" onClick={() => { setPlaying(false); setIdx((i) => Math.min(frames.length - 1, i + 1)); }} aria-label="Next turn">
            <SkipForward className="size-4" />
          </Button>
        </div>
        {frame.combat.length > 0 && (
          <ul className="mt-3 max-h-24 overflow-y-auto text-sm text-muted">
            {frame.combat.map((c, i) => (
              <li key={i}>{c.text}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ReplayMap({ state, frame }: { state: GameState; frame: TurnSnapshot }) {
  const box = useMemo(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const s of frame.systems) {
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x);
      maxY = Math.max(maxY, s.y);
    }
    const pad = 80;
    const w = Math.max(420, maxX - minX + pad * 2);
    return { x: minX - pad, y: minY - pad, w, h: w };
  }, [frame]);

  const byId = useMemo(() => new Map(frame.systems.map((s) => [s.id, s])), [frame]);
  const combat = new Set(frame.combat.map((c) => c.systemId).filter(Boolean) as string[]);

  const edges: { a: (typeof frame.systems)[0]; b: (typeof frame.systems)[0] }[] = [];
  const seen = new Set<string>();
  for (const s of frame.systems) {
    for (const n of s.neighbors) {
      const key = s.id < n ? `${s.id}|${n}` : `${n}|${s.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const other = byId.get(n);
      if (other) edges.push({ a: s, b: other });
    }
  }

  return (
    <svg className="h-full w-full" viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}>
      {edges.map(({ a, b }) => (
        <line
          key={`${a.id}-${b.id}`}
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke="#e8e6df"
          strokeOpacity="0.16"
          strokeWidth="1.1"
        />
      ))}
      {frame.systems.map((s) => {
        const color = s.ownerId ? empireColor(state, s.ownerId) : UNOWNED_INK;
        const r = s.isHome ? 12 : 9;
        const n = s.fleets.reduce((a, f) => a + f.n, 0);
        return (
          <g key={s.id} transform={`translate(${s.x}, ${s.y})`}>
            {combat.has(s.id) && <circle r={r + 10} fill="#c45c4a" fillOpacity="0.28" />}
            <circle r={r} fill="#101218" stroke={color} strokeWidth={s.ownerId ? 1.8 : 1.1} />
            {s.isHome && (
              <polygon points="0,-4 3.6,3.2 -3.6,3.2" fill={color} />
            )}
            {n > 0 && (
              <circle cx={r + 5} cy={-r} r={4} fill={color} />
            )}
            <text x={r + 7} y={3} fill="#8b9099" fontSize="9" fontFamily="Outfit, sans-serif">
              {s.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
