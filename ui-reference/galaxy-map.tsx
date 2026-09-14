import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { Fleet, GameState, StarSystem } from "@/lib/game/types";
import {
  empireColor,
  systemInk,
  UNOWNED_INK,
  visionOf,
  type Vision,
} from "@/lib/game/vision";
import { cn } from "@/lib/utils";

interface Props {
  state: GameState;
  viewerId: string;
  selectedId: string | null;
  orderMode: string | null;
  legalDest: Set<string>;
  onSelect: (id: string) => void;
}

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MIN_VIEW = 220;
const MAX_VIEW = 1600;

function boundsOf(systems: StarSystem[]) {
  if (!systems.length) return { x: 40, y: 40, w: 920, h: 920 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of systems) {
    minX = Math.min(minX, s.x);
    minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x);
    maxY = Math.max(maxY, s.y);
  }
  const pad = 90;
  return {
    x: minX - pad,
    y: minY - pad,
    w: Math.max(420, maxX - minX + pad * 2),
    h: Math.max(420, maxY - minY + pad * 2),
  };
}

function clampView(next: ViewBox, systems: StarSystem[]): ViewBox {
  const b = boundsOf(systems);
  const w = Math.min(MAX_VIEW, Math.max(MIN_VIEW, next.w));
  const slack = w * 0.4;
  const minX = b.x - slack;
  const maxX = b.x + b.w - w + slack;
  const minY = b.y - slack;
  const maxY = b.y + b.h - w + slack;
  return {
    x: Math.min(maxX, Math.max(minX, next.x)),
    y: Math.min(maxY, Math.max(minY, next.y)),
    w,
    h: w,
  };
}

export function GalaxyMap({
  state,
  viewerId,
  selectedId,
  orderMode,
  legalDest,
  onSelect,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState(() => boundsOf(state.systems));
  const viewRef = useRef(view);
  viewRef.current = view;

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pan = useRef<{
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    vw: number;
  } | null>(null);
  const pinch = useRef<{
    dist: number;
    midX: number;
    midY: number;
    view: ViewBox;
  } | null>(null);
  const suppressClick = useRef(false);

  const systems = state.systems;
  const systemsRef = useRef(systems);
  systemsRef.current = systems;

  function commitView(next: ViewBox) {
    const clamped = clampView(next, systemsRef.current);
    viewRef.current = clamped;
    setView(clamped);
  }

  function zoomToward(clientX: number, clientY: number, factor: number) {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const v = viewRef.current;
    const mx = ((clientX - rect.left) / Math.max(1, rect.width)) * v.w + v.x;
    const my = ((clientY - rect.top) / Math.max(1, rect.height)) * v.h + v.y;
    const nw = v.w * factor;
    commitView({
      x: mx - ((mx - v.x) / v.w) * nw,
      y: my - ((my - v.y) / v.h) * nw,
      w: nw,
      h: nw,
    });
  }

  useEffect(() => {
    setView(boundsOf(state.systems));
  }, [state.id]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomToward(e.clientX, e.clientY, e.deltaY > 0 ? 1.08 : 0.92);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function beginPinch() {
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return;
    const a = pts[0]!;
    const b = pts[1]!;
    pan.current = null;
    pinch.current = {
      dist: Math.hypot(b.x - a.x, b.y - a.y) || 1,
      midX: (a.x + b.x) / 2,
      midY: (a.y + b.y) / 2,
      view: { ...viewRef.current },
    };
    suppressClick.current = true;
  }

  const starDown = useRef<string | null>(null);
  const moved = useRef(false);

  function starIdFromEvent(e: PointerEvent<SVGSVGElement>): string | null {
    const el = e.target as Element | null;
    return el?.closest?.("[data-system]")?.getAttribute("data-system") ?? null;
  }

  function onPointerDown(e: PointerEvent<SVGSVGElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const starId = starIdFromEvent(e);
    starDown.current = starId;
    moved.current = false;
    suppressClick.current = false;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size >= 2) {
      if (e.cancelable) e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* some browsers refuse capture on SVG */
      }
      beginPinch();
      return;
    }

    if (starId) {
      // Select on pointerup. Do not capture — that plus preventDefault was
      // swallowing clicks and made stars unselectable.
      return;
    }

    if (e.pointerType !== "mouse" && e.cancelable) e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* some browsers refuse capture on SVG */
    }
    const v = viewRef.current;
    pan.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      vx: v.x,
      vy: v.y,
      vw: v.w,
    };
  }

  function onPointerMove(e: PointerEvent<SVGSVGElement>) {
    if (!pointers.current.has(e.pointerId) && !pan.current && !pinch.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const pinchState = pinch.current;
    if (pinchState && pointers.current.size >= 2) {
      const pts = [...pointers.current.values()];
      const a = pts[0]!;
      const b = pts[1]!;
      const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const start = pinchState.view;
      const rw = Math.max(1, rect.width);
      const rh = Math.max(1, rect.height);
      const worldX = ((pinchState.midX - rect.left) / rw) * start.w + start.x;
      const worldY = ((pinchState.midY - rect.top) / rh) * start.h + start.y;
      const nw = start.w * (pinchState.dist / dist);
      commitView({
        x: worldX - ((midX - rect.left) / rw) * nw,
        y: worldY - ((midY - rect.top) / rh) * nw,
        w: nw,
        h: nw,
      });
      return;
    }

    const down = pointers.current.get(e.pointerId);
    if (starDown.current && !pan.current && down) {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) {
        moved.current = true;
        starDown.current = null;
        if (e.cancelable) e.preventDefault();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        const v = viewRef.current;
        pan.current = {
          id: e.pointerId,
          x: down.x,
          y: down.y,
          vx: v.x,
          vy: v.y,
          vw: v.w,
        };
      } else {
        return;
      }
    }

    const d = pan.current;
    if (!d || d.id !== e.pointerId) return;
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = ((e.clientX - d.x) / Math.max(1, rect.width)) * d.vw;
    const dy = ((e.clientY - d.y) / Math.max(1, rect.height)) * d.vw;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) {
      moved.current = true;
      suppressClick.current = true;
    }
    commitView({ x: d.vx - dx, y: d.vy - dy, w: viewRef.current.w, h: viewRef.current.h });
  }

  function endPointer(e: PointerEvent<SVGSVGElement>) {
    pointers.current.delete(e.pointerId);
    if (pan.current?.id === e.pointerId) pan.current = null;
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 1) {
      const [id, p] = [...pointers.current.entries()][0]!;
      const v = viewRef.current;
      pan.current = { id, x: p.x, y: p.y, vx: v.x, vy: v.y, vw: v.w };
    }
  }

  function onPointerUp(e: PointerEvent<SVGSVGElement>) {
    const starId = starDown.current;
    const didMove = moved.current || suppressClick.current;
    const pinching = !!pinch.current;
    endPointer(e);
    starDown.current = null;
    suppressClick.current = false;
    moved.current = false;
    if (starId && !didMove && !pinching) onSelect(starId);
  }


  const vis = useMemo(() => {
    const m = new Map<string, Vision>();
    for (const s of systems) m.set(s.id, visionOf(state, viewerId, s));
    return m;
  }, [state, viewerId, systems]);

  const edges = useMemo(() => {
    const seen = new Set<string>();
    const list: { a: StarSystem; b: StarSystem }[] = [];
    for (const s of systems) {
      for (const n of s.neighbors) {
        const key = s.id < n ? `${s.id}|${n}` : `${n}|${s.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const other = systems.find((x) => x.id === n);
        if (other) list.push({ a: s, b: other });
      }
    }
    return list;
  }, [systems]);

  const selected = systems.find((s) => s.id === selectedId);

  const orders = systems.flatMap((s) =>
    s.fleets
      .filter((f) => f.ownerId === viewerId && f.order.kind === "move")
      .map((f) => ({ f, from: s })),
  );
  const supports = systems.flatMap((s) =>
    s.fleets
      .filter((f) => f.ownerId === viewerId && f.order.kind === "support")
      .map((f) => ({ f, from: s })),
  );
  const rallies = systems.flatMap((s) =>
    s.fleets
      .filter((f) => f.ownerId === viewerId && f.rallySystemId)
      .map((f) => ({ f, from: s })),
  );

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden touch-none">
      <svg
        className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={endPointer}
      >
        <defs>
          <radialGradient id="core" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#7eb8c9" stopOpacity="0.09" />
            <stop offset="100%" stopColor="#7eb8c9" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="500" cy="500" r="250" fill="url(#core)" style={{ pointerEvents: "none" }} />

        {edges.map(({ a, b }) => {
          const va = vis.get(a.id);
          const vb = vis.get(b.id);
          if (va === "hidden" && vb === "hidden") return null;
          const faded = va === "hidden" || vb === "hidden" || va === "fog" || vb === "fog";
          const highlight =
            selected &&
            (selected.id === a.id || selected.id === b.id);
          return (
            <line
              key={`${a.id}-${b.id}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={highlight ? "#7eb8c9" : "#e8e6df"}
              strokeOpacity={highlight ? 0.45 : faded ? 0.08 : 0.16}
              strokeWidth={highlight ? 1.8 : 1.1}
            />
          );
        })}

        {orders.map(({ f, from }) => {
          const dest = systems.find(
            (s) => f.order.kind === "move" && s.id === f.order.destId,
          );
          if (!dest) return null;
          return (
            <OrderArrow key={f.id} from={from} to={dest} color={empireColor(state, f.ownerId)} />
          );
        })}
        {supports.map(({ f, from }) => {
          const dest = systems.find(
            (s) => f.order.kind === "support" && s.id === f.order.destId,
          );
          if (!dest) return null;
          return (
            <OrderArrow
              key={f.id}
              from={from}
              to={dest}
              color={empireColor(state, f.ownerId)}
              dashed
            />
          );
        })}
        {rallies.map(({ f, from }) => {
          const dest = systems.find((s) => s.id === f.rallySystemId);
          if (!dest) return null;
          const color = empireColor(state, f.ownerId);
          return (
            <g key={`rally-${f.id}`} style={{ pointerEvents: "none" }}>
              <line
                x1={from.x}
                y1={from.y}
                x2={dest.x}
                y2={dest.y}
                stroke={color}
                strokeWidth="1.4"
                strokeOpacity="0.45"
                strokeDasharray="5 6"
              />
              <g transform={`translate(${dest.x}, ${dest.y})`}>
                <path
                  d="M 8 -18 L 8 -4 L 20 -8 L 8 -18"
                  fill={color}
                  fillOpacity="0.85"
                />
                <line x1="8" y1="-18" x2="8" y2="6" stroke={color} strokeWidth="1.6" />
              </g>
            </g>
          );
        })}

        {systems.map((s) => {
          const v = vis.get(s.id) ?? "hidden";
          if (v === "hidden") return null;
          const owned = !!s.ownerId;
          const color = owned ? systemInk(state, s) : UNOWNED_INK;
          const isSel = s.id === selectedId;
          const legal = legalDest.has(s.id);
          const r = s.isHome ? 14 : s.kind === "core" ? 9 : 11;
          const fog = v === "fog";
          return (
            <g
              key={s.id}
              data-system={s.id}
              transform={`translate(${s.x}, ${s.y})`}
              className="cursor-pointer"
              role="button"
              tabIndex={0}
              aria-label={s.name}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(s.id);
              }}
            >
              {isSel && (
                <circle r={r + 10} fill="none" stroke="#7eb8c9" strokeOpacity="0.7" strokeWidth="1.2" />
              )}
              {legal && (
                <>
                  <circle r={r + 12} fill="#7a9e6b" fillOpacity="0.2" />
                  <circle r={r + 8} fill="none" stroke="#7a9e6b" strokeWidth="1.8" strokeDasharray="4 3" />
                </>
              )}
              <circle r={28} fill="transparent" />
              {owned && (
                <circle
                  r={r + 3}
                  fill={color}
                  fillOpacity={0.22}
                />
              )}
              <circle
                r={r}
                fill="#101218"
                stroke={isSel ? "#e8e6df" : color}
                strokeWidth={owned && s.isHome ? 2.2 : owned ? 1.8 : 1.1}
                strokeOpacity={owned ? 1 : 0.5}
              />
              {s.isHome && owned && (
                <polygon
                  points="0,-5 4.5,4 -4.5,4"
                  fill={color}
                  opacity={0.95}
                />
              )}
              {s.isHome && !owned && (
                <polygon
                  points="0,-5 4.5,4 -4.5,4"
                  fill={UNOWNED_INK}
                  opacity={0.45}
                />
              )}
              {!s.isHome && (
                <circle
                  r={s.kind === "core" ? 2.4 : 3.2}
                  fill={color}
                  opacity={owned ? 1 : 0.4}
                />
              )}
              {!fog && s.fleets.length > 0 && (
                <FleetPips fleets={s.fleets} color={empireColor(state, s.fleets[0]!.ownerId)} r={r} />
              )}
              <text
                x={r + 6}
                y={3}
                textAnchor="start"
                fill={isSel ? "#e8e6df" : "#8b9099"}
                fontSize="10"
                fontFamily="Outfit, sans-serif"
                style={{ pointerEvents: "none" }}
              >
                {s.name}
              </text>
              {!fog && (s.base.metals > 0 || s.base.chon > 0 || s.alienArtifact) && (
                <text
                  x={r + 6}
                  y={15}
                  textAnchor="start"
                  fill="#5c616a"
                  fontSize="9"
                  fontFamily="Outfit, sans-serif"
                  style={{ pointerEvents: "none" }}
                >
                  {s.alienArtifact ? "T+ " : ""}
                  {s.base.tech ? `${s.base.tech}T ` : ""}
                  {s.base.metals ? `${s.base.metals}M ` : ""}
                  {s.base.chon ? `${s.base.chon}C` : ""}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="pointer-events-none absolute left-3 top-2 flex flex-col gap-1">
        {state.players
          .filter((p) => !p.collapsed)
          .map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-[11px] text-muted">
              <span
                className="size-2.5 rounded-full"
                style={{ background: p.civ.flag.colors[0] }}
              />
              <span className={p.id === viewerId ? "text-fg" : ""}>
                {p.civ.name}
              </span>
              <span className="text-faint">
                {state.systems.filter((s) => s.ownerId === p.id).length}
              </span>
            </div>
          ))}
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <span
            className="size-2.5 rounded-full"
            style={{ background: UNOWNED_INK, opacity: 0.7 }}
          />
          <span>Unclaimed</span>
        </div>
        <div className="mt-1 text-[11px] tracking-wide text-faint">
          Drag to pan · pinch or scroll to zoom
          {orderMode ? ` · ${orderMode}` : ""}
        </div>
        <div className="pointer-events-auto mt-2 flex gap-1">
          <button
            type="button"
            className="grid size-11 place-items-center rounded-md bg-surface/90 text-lg text-fg hairline"
            aria-label="Zoom in"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              const el = wrapRef.current;
              if (!el) return;
              const r = el.getBoundingClientRect();
              zoomToward(r.left + r.width / 2, r.top + r.height / 2, 0.82);
            }}
          >
            +
          </button>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-md bg-surface/90 text-lg text-fg hairline"
            aria-label="Zoom out"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              const el = wrapRef.current;
              if (!el) return;
              const r = el.getBoundingClientRect();
              zoomToward(r.left + r.width / 2, r.top + r.height / 2, 1.22);
            }}
          >
            −
          </button>
        </div>
      </div>
    </div>
  );
}

function FleetPips({
  fleets,
  color,
  r,
}: {
  fleets: Fleet[];
  color: string;
  r: number;
}) {
  const n = Math.min(fleets.length, 8);
  const ring = r + 7;
  return (
    <g>
      {Array.from({ length: n }).map((_, i) => {
        const a = (Math.PI * 2 * i) / n - Math.PI / 2;
        return (
          <circle
            key={i}
            cx={Math.cos(a) * ring}
            cy={Math.sin(a) * ring}
            r={2.1}
            fill={color}
          />
        );
      })}
    </g>
  );
}

function OrderArrow({
  from,
  to,
  color,
  dashed,
}: {
  from: StarSystem;
  to: StarSystem;
  color: string;
  dashed?: boolean;
}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const x1 = from.x + ux * 16;
  const y1 = from.y + uy * 16;
  const x2 = to.x - ux * 16;
  const y2 = to.y - uy * 16;
  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth="2.4"
        strokeOpacity="0.9"
        strokeDasharray={dashed ? "6 4" : undefined}
      />
      <polygon
        points={`${x2},${y2} ${x2 - ux * 9 - uy * 4.5},${y2 - uy * 9 + ux * 4.5} ${x2 - ux * 9 + uy * 4.5},${y2 - uy * 9 - ux * 4.5}`}
        fill={color}
      />
    </g>
  );
}

export function ResChip({
  label,
  value,
  hint,
  delta,
}: {
  label: string;
  value: number;
  hint?: string;
  delta?: number;
}) {
  return (
    <div
      className={cn(
        "flex min-w-[4.5rem] flex-col rounded-md bg-raised px-3 py-2 hairline",
      )}
      title={hint}
    >
      <span className="text-[10px] uppercase tracking-[0.16em] text-faint">
        {label}
      </span>
      <span className="font-display text-xl tabular-nums leading-none text-fg">
        {value}
        {delta !== undefined && (
          <span
            className={cn(
              "ml-1 text-xs",
              delta < 0 ? "text-ember" : "text-ok",
            )}
          >
            {delta >= 0 ? "+" : ""}
            {delta}
          </span>
        )}
      </span>
    </div>
  );
}
