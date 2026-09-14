import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  MessageSquare,
  Orbit,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlagMark } from "@/components/flag";
import { GalaxyMap, ResChip } from "@/components/galaxy-map";
import { DiplomacyModal } from "@/components/diplomacy-modal";
import { ReplayViewer } from "@/components/replay-viewer";
import { useApp } from "@/lib/game/store";
import type {
  EspionageKind,
  Fleet,
  GameState,
  Player,
  StarSystem,
  Upgrade,
} from "@/lib/game/types";
import { BUILD_COST, UPGRADE_BLURB, UPGRADE_LABEL } from "@/lib/game/constants";
import {
  cancelBuild,
  cancelEspionage,
  cancelTrade,
  scheduleBuild,
  scheduleEspionage,
  scheduleTrade,
  setFleetOrder,
  toggleDestroyFleet,
  toggleDestroyUpgrade,
  isUpgradePendingDestroy,
} from "@/lib/game/engine";
import { canUseWormhole, incomePreview, legalMoveDestinations, legalRallyDestinations, legalSupportDestinations } from "@/lib/game/resolve";
import { playerKnown, systemInk, visionOf } from "@/lib/game/vision";
import { unreadCount, legalTradeDestinations, respondToIncident, schedulePactDelivery } from "@/lib/game/diplomacy";
import {
  alliesOf,
  areAllied,
  currentAllyConflicts,
  formatGoods,
  goodsNonzero,
  hostileOrderWarning,
  openIncidentsFor,
  pactHalf,
  unsentPactsFor,
} from "@/lib/game/alliance";
import { civTheName } from "@/lib/game/civs";
import { uid } from "@/lib/game/civs";
import { scoreCard } from "@/lib/game/victory";
import { cn } from "@/lib/utils";

const UPGRADES: Upgrade[] = ["starport", "shipyard", "colony", "mining", "wormhole"];

export function PlayScreen() {
  const game = useApp((s) => s.game);
  const selectedId = useApp((s) => s.selectedSystemId);
  const orderMode = useApp((s) => s.orderMode);
  const orderFleetId = useApp((s) => s.orderFleetId);
  const supportFleetId = useApp((s) => s.supportFleetId);
  const briefing = useApp((s) => s.briefing);
  const messageLegalIds = useApp((s) => s.messageLegalIds);
  const selectSystem = useApp((s) => s.selectSystem);
  const setOrderMode = useApp((s) => s.setOrderMode);
  const patchGame = useApp((s) => s.patchGame);
  const commitEndTurn = useApp((s) => s.commitEndTurn);
  const closeReport = useApp((s) => s.closeReport);
  const setScreen = useApp((s) => s.setScreen);
  const [dip, setDip] = useState(false);
  const [intel, setIntel] = useState(false);
  const [hostile, setHostile] = useState<null | { text: string; proceed: () => void }>(null);
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [deferredIncidents, setDeferredIncidents] = useState<string[]>([]);
  const [replay, setReplay] = useState(false);

  const legalDest = useMemo(() => {
    const set = new Set<string>();
    if (!game) return set;
    if (orderMode === "message-sys") {
      for (const id of messageLegalIds) set.add(id);
      return set;
    }
    if (orderMode === "trade") {
      for (const id of legalTradeDestinations(game, game.actingPlayerId)) set.add(id);
      return set;
    }
    if (!orderFleetId) return set;
    const fleet = game.systems.flatMap((s) => s.fleets).find((f) => f.id === orderFleetId);
    if (!fleet) return set;
    if (orderMode === "move") {
      const used = game.systems
        .find((s) => s.id === fleet.systemId)
        ?.fleets.some(
          (f) => f.id !== fleet.id && f.order.kind === "move" && f.order.wormholeJump,
        );
      for (const id of legalMoveDestinations(game, fleet, !!used)) set.add(id);
    } else if (orderMode === "support-from") {
      for (const s of game.systems) {
        if (s.fleets.some((f) => f.id !== fleet.id)) set.add(s.id);
      }
    } else if (orderMode === "support-dest" && supportFleetId) {
      for (const id of legalSupportDestinations(game, fleet, supportFleetId)) set.add(id);
    } else if (orderMode === "rally") {
      for (const id of legalRallyDestinations(game, fleet)) set.add(id);
    }
    return set;
  }, [game, orderFleetId, orderMode, supportFleetId, messageLegalIds]);

  const incidents = useMemo(
    () => (game ? openIncidentsFor(game, game.actingPlayerId) : []),
    [game],
  );

  useEffect(() => {
    if (!game || game.phase !== "activity") return;
    if (incidentId) return;
    const next = incidents.find((i) => !deferredIncidents.includes(i.id));
    if (next) setIncidentId(next.id);
  }, [game, incidents, incidentId, deferredIncidents]);

  if (!game) return null;
  const me = game.players.find((p) => p.id === game.actingPlayerId) ?? game.players[0]!;
  const selected = game.systems.find((s) => s.id === selectedId) ?? null;
  const unread = unreadCount(game, me.id);
  const inc = incomePreview(game, me.id);
  const extraFleets = game.builds.filter(
    (b) => b.playerId === me.id && b.kind === "starfleet",
  ).length;
  const nextFleets = inc.upkeep + extraFleets;
  const overUpkeep =
    inc.prod.tech < nextFleets ||
    inc.prod.metals < nextFleets ||
    inc.prod.chon < nextFleets;
  const allyNames = alliesOf(game, me.id)
    .map((id) => game.players.find((p) => p.id === id)?.civ.name)
    .filter(Boolean);
  const conflicts = currentAllyConflicts(game, me.id);
  const unsent = unsentPactsFor(game, me.id);

  function onSelect(id: string) {
    const g = useApp.getState().game;
    if (!g) return;
    const mode = useApp.getState().orderMode;
    const fid = useApp.getState().orderFleetId;
    const sid = useApp.getState().supportFleetId;

    if (mode === "move" && fid) {
      const fleet = g.systems.flatMap((s) => s.fleets).find((f) => f.id === fid);
      if (fleet) {
        const used = g.systems
          .find((s) => s.id === fleet.systemId)
          ?.fleets.some(
            (f) => f.id !== fleet.id && f.order.kind === "move" && f.order.wormholeJump,
          );
        const legal = new Set(legalMoveDestinations(g, fleet, !!used));
        if (legal.has(id)) {
          const apply = () => {
            patchGame((st) => {
              const f = st.systems.flatMap((s) => s.fleets).find((x) => x.id === fid);
              if (!f) return;
              const here = st.systems.find((s) => s.id === f.systemId)!;
              const jump = !here.neighbors.includes(id);
              setFleetOrder(st, f, { kind: "move", destId: id, wormholeJump: jump });
            });
            setOrderMode(null, null);
            selectSystem(fleet.systemId);
          };
          const warn = hostileOrderWarning(g, g.actingPlayerId, "move", id);
          if (warn) {
            setHostile({ text: warn, proceed: apply });
            return;
          }
          apply();
          return;
        }
      }
      setOrderMode(null, null);
      selectSystem(id);
      return;
    }

    if (mode === "rally" && fid) {
      const fleet = g.systems.flatMap((s) => s.fleets).find((f) => f.id === fid);
      if (fleet && legalRallyDestinations(g, fleet).includes(id)) {
        patchGame((st) => {
          const f = st.systems.flatMap((s) => s.fleets).find((x) => x.id === fid);
          if (f) f.rallySystemId = id;
        });
        setOrderMode(null, null);
        selectSystem(fleet.systemId);
        return;
      }
      setOrderMode(null, null);
      selectSystem(id);
      return;
    }

    if (mode === "support-from" && fid) {
      const sys = g.systems.find((s) => s.id === id);
      const pick =
        sys?.fleets.find((f) => f.id !== fid && f.order.kind === "move") ??
        sys?.fleets.find((f) => f.id !== fid);
      if (pick) {
        useApp.setState({ supportFleetId: pick.id });
        setOrderMode("support-dest", fid);
        return;
      }
      setOrderMode(null, null);
      selectSystem(id);
      return;
    }

    if (mode === "support-dest" && fid && sid) {
      const fleet = g.systems.flatMap((s) => s.fleets).find((f) => f.id === fid);
      if (fleet && legalSupportDestinations(g, fleet, sid).includes(id)) {
        const supported = g.systems.flatMap((s) => s.fleets).find((x) => x.id === sid);
        const apply = () => {
          patchGame((st) => {
            const f = st.systems.flatMap((s) => s.fleets).find((x) => x.id === fid);
            const sup = st.systems.flatMap((s) => s.fleets).find((x) => x.id === sid);
            if (!f || !sup) return;
            setFleetOrder(st, f, {
              kind: "support",
              supportedFleetId: sup.id,
              destId: id,
            });
          });
          setOrderMode(null, null);
          selectSystem(fleet.systemId);
        };
        const warn = hostileOrderWarning(g, g.actingPlayerId, "support", id, {
          supportedOwnerId: supported?.ownerId,
        });
        if (warn) {
          setHostile({ text: warn, proceed: apply });
          return;
        }
        apply();
        return;
      }
      setOrderMode(null, null);
      selectSystem(id);
      return;
    }

    if (mode === "message-sys" || mode === "trade") {
      if (mode === "message-sys") {
        const legal = useApp.getState().messageLegalIds;
        if (legal.length && !legal.includes(id)) return;
      }
      selectSystem(id);
      return;
    }

    selectSystem(id);
  }

  return (
    <div className="relative flex h-dvh flex-col bg-bg text-fg">
      <header className="flex items-center gap-3 border-b border-border px-3 py-2 md:px-5">
        <FlagMark spec={me.civ.flag} className="h-7 w-12 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg leading-none">{me.civ.name}</div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-faint">
            Turn {game.turn}
            {game.options.turnLimit !== "none" ? ` / ${game.options.turnLimit}` : ""} ·{" "}
            {game.systems.filter((s) => s.ownerId === me.id).length} systems
            {allyNames.length ? ` · Allied: ${allyNames.join(", ")}` : ""}
          </div>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <ResChip
            label="Tech"
            value={me.resources.tech}
            hint={`Income ${inc.prod.tech} · Upkeep ${inc.upkeep}`}
            delta={inc.prod.tech - inc.upkeep}
          />
          <ResChip
            label="Metals"
            value={me.resources.metals}
            hint={`Income ${inc.prod.metals}`}
            delta={inc.prod.metals - inc.upkeep}
          />
          <ResChip
            label="CHON"
            value={me.resources.chon}
            hint={`Income ${inc.prod.chon}`}
            delta={inc.prod.chon - inc.upkeep}
          />
        </div>
        <button
          className="relative size-11 rounded-md bg-raised hairline"
          onClick={() => setDip(true)}
          aria-label="Diplomacy"
        >
          <MessageSquare className="mx-auto size-4 text-accent" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-ember px-1 text-[10px] tabular-nums">
              {unread}
            </span>
          )}
        </button>
        <button
          className="size-11 rounded-md bg-raised hairline"
          onClick={() => setIntel(true)}
          aria-label="Situation"
        >
          <BookOpen className="mx-auto size-4" />
        </button>
        <Button
          variant="ember"
          size="md"
          className="hidden sm:inline-flex"
          onClick={commitEndTurn}
          disabled={game.phase !== "activity"}
        >
          End Turn
        </Button>
        <button
          className="size-11 rounded-md bg-raised hairline"
          onClick={() => setScreen("menu")}
          aria-label="Menu"
        >
          <Orbit className="mx-auto size-4" />
        </button>
      </header>

      <div className="flex gap-2 overflow-x-auto px-3 py-2 sm:hidden">
        <ResChip label="Tech" value={me.resources.tech} delta={inc.prod.tech - inc.upkeep} />
        <ResChip label="Metals" value={me.resources.metals} delta={inc.prod.metals - inc.upkeep} />
        <ResChip label="CHON" value={me.resources.chon} delta={inc.prod.chon - inc.upkeep} />
      </div>

      {overUpkeep && (
        <p className="border-b border-ember/30 bg-ember/10 px-3 py-1.5 text-center text-xs text-ember">
          Next upkeep exceeds income — scuttle a fleet or raise production before you starve the navy.
        </p>
      )}
      {conflicts.length > 0 && (
        <p className="border-b border-ember/30 bg-ember/10 px-3 py-1.5 text-center text-xs text-ember">
          You have orders that would wrong an ally: {conflicts[0]} You may still retract them before
          ending the turn.
        </p>
      )}
      {unsent.map((p) => {
        const half = pactHalf(p, me.id);
        if (!half || !goodsNonzero(half.resources)) return null;
        const dest = game.systems.find((s) => s.id === half.systemId)?.name ?? "the named system";
        return (
          <div
            key={p.id}
            className="flex items-center justify-center gap-3 border-b border-accent/30 bg-accent/10 px-3 py-1.5 text-xs text-accent"
          >
            <span>
              You promised {formatGoods(half.resources)} to {dest}. Accepting did not send it.
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                patchGame((g) => {
                  schedulePactDelivery(g, me.id, p.id);
                })
              }
            >
              Schedule delivery
            </Button>
          </div>
        );
      })}
      {incidents.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-center gap-3 border-b border-ember/30 bg-ember/10 px-3 py-1.5 text-xs text-ember"
        >
          <span>Allied power: {item.text}</span>
          <Button size="sm" variant="ember" onClick={() => setIncidentId(item.id)}>
            Respond
          </Button>
        </div>
      ))}

      {orderMode && (
        <div className="flex items-center gap-3 border-b border-accent/30 bg-accent/10 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 text-accent">
            {orderMode === "move" && "Select a highlighted system to move this starfleet."}
            {orderMode === "support-from" &&
              "Select a system whose starfleet you will support."}
            {orderMode === "support-dest" &&
              "Select where that support is applied (highlighted)."}
            {orderMode === "rally" && "Select an adjacent friendly system as a rally point."}
            {orderMode === "message-sys" &&
              "Select a highlighted system — only stars you or they can reach."}
            {orderMode === "trade" &&
              "Select a system you do not own that borders one you do — that is where goods land."}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setOrderMode(null, null)}>
            Cancel
          </Button>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <GalaxyMap
          state={game}
          viewerId={me.id}
          selectedId={selectedId}
          orderMode={orderMode}
          legalDest={legalDest}
          onSelect={onSelect}
        />
        {selected && orderMode !== "message-sys" && orderMode !== "trade" && (
          <SystemDock
            state={game}
            me={me}
            system={selected}
            onClose={() => selectSystem(null)}
            setOrderMode={setOrderMode}
            patchGame={patchGame}
            orderFleetId={orderFleetId}
            onHostile={(text, proceed) => setHostile({ text, proceed })}
          />
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-border px-3 py-2 sm:hidden">
        <Button variant="ember" className="flex-1" onClick={commitEndTurn} disabled={game.phase !== "activity"}>
          End Turn
        </Button>
        <Button variant="secondary" size="icon" onClick={() => setIntel(true)}>
          <BookOpen className="size-4" />
        </Button>
      </div>

      {briefing && game.turn === 1 && <Briefing />}
      {dip && <DiplomacyModal state={game} me={me} onClose={() => setDip(false)} />}
      {intel && <IntelSheet state={game} me={me} onClose={() => setIntel(false)} />}
      {(game.phase === "report" || game.phase === "ended") && !replay && (
        <TurnReport
          state={game}
          me={me}
          onClose={closeReport}
          onReplay={() => setReplay(true)}
          onOpenDiplomacy={
            unread > 0
              ? () => {
                  closeReport();
                  setDip(true);
                }
              : undefined
          }
        />
      )}
      {replay && <ReplayViewer state={game} onClose={() => setReplay(false)} />}
      {hostile && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-bg/70 p-4">
          <div className="max-w-md rounded-xl bg-surface p-5 hairline">
            <h2 className="font-display text-2xl">Allied warning</h2>
            <p className="mt-3 text-sm text-muted">{hostile.text}</p>
            <div className="mt-5 flex gap-2">
              <Button
                variant="ember"
                onClick={() => {
                  const fn = hostile.proceed;
                  setHostile(null);
                  fn();
                }}
              >
                Issue anyway
              </Button>
              <Button variant="ghost" onClick={() => setHostile(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
      {incidentId && (
        <IncidentDialog
          state={game}
          me={me}
          incidentId={incidentId}
          onClose={() => {
            setDeferredIncidents((d) =>
              incidentId && !d.includes(incidentId) ? [...d, incidentId] : d,
            );
            setIncidentId(null);
          }}
          patchGame={patchGame}
          onThreaten={() => {
            setIncidentId(null);
            setDip(true);
          }}
        />
      )}
    </div>
  );
}

function SystemDock({
  state,
  me,
  system,
  onClose,
  setOrderMode,
  patchGame,
  orderFleetId,
  onHostile,
}: {
  state: GameState;
  me: Player;
  system: StarSystem;
  onClose: () => void;
  setOrderMode: (m: "move" | "support-from" | "support-dest" | "rally" | null, fleetId?: string | null) => void;
  patchGame: (fn: (g: GameState) => void) => void;
  orderFleetId: string | null;
  onHostile: (text: string, proceed: () => void) => void;
}) {
  const vis = visionOf(state, me.id, system);
  const fog = vis === "fog";
  const mine = system.ownerId === me.id;
  const owner = state.players.find((p) => p.id === system.ownerId);
  const myFleets = system.fleets.filter((f) => f.ownerId === me.id);
  const color = systemInk(state, system);

  return (
    <aside className="absolute inset-x-0 bottom-0 z-10 max-h-[58%] overflow-y-auto rounded-t-xl bg-surface/95 p-4 backdrop-blur-sm hairline md:inset-auto md:right-3 md:top-3 md:bottom-3 md:w-[22rem] md:max-h-none md:rounded-xl">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-faint">
            {system.isHome ? "Home system" : "Solar system"}
          </div>
          <h2 className="font-display text-2xl leading-tight">{system.name}</h2>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted">
            <span className="inline-block size-2 rounded-full" style={{ background: color }} />
            {owner ? civTheName(owner.civ) : "Unclaimed"}
            {owner && areAllied(state, me.id, owner.id) ? " · allied" : ""}
          </div>
        </div>
        <button onClick={onClose} className="size-10 rounded-md hover:bg-raised" aria-label="Close">
          <X className="mx-auto size-4" />
        </button>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <MiniStat k="Tech" v={system.base.tech + (system.alienArtifact ? 1 : 0) + (system.upgrades.includes("colony") ? 1 : 0)} />
        <MiniStat k="Metals" v={system.base.metals + (system.upgrades.includes("mining") ? 1 : 0)} />
        <MiniStat k="CHON" v={system.base.chon + (system.upgrades.includes("mining") ? 1 : 0)} />
      </div>

      {!fog && (
        <>
          <Section title="Upgrades">
            <div className="flex flex-wrap gap-1.5">
              {UPGRADES.map((u) => {
                const has = system.upgrades.includes(u);
                const pending = state.builds.some(
                  (b) => b.systemId === system.id && b.kind === u,
                );
                const wreck = isUpgradePendingDestroy(state, system.id, u);
                return (
                  <span
                    key={u}
                    className={cn(
                      "rounded-sm px-2 py-1 text-[11px] uppercase tracking-wide",
                      has
                        ? wreck
                          ? "bg-ember/20 text-ember"
                          : "bg-accent/15 text-accent"
                        : pending
                          ? "bg-warn/20 text-warn"
                          : "bg-inset text-faint",
                    )}
                    title={UPGRADE_BLURB[u]}
                  >
                    {UPGRADE_LABEL[u]}
                    {pending ? "…" : ""}
                    {wreck ? " wreck" : ""}
                  </span>
                );
              })}
            </div>
            {mine && (
              <>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {UPGRADES.map((u) => {
                    if (system.upgrades.includes(u)) return null;
                    const pending = state.builds.find(
                      (b) => b.systemId === system.id && b.kind === u && b.playerId === me.id,
                    );
                    const cost = BUILD_COST[u];
                    if (pending) {
                      return (
                        <Button
                          key={u}
                          size="sm"
                          variant="ghost"
                          onClick={() => patchGame((g) => cancelBuild(g, pending.id))}
                        >
                          Cancel {UPGRADE_LABEL[u]}
                        </Button>
                      );
                    }
                    return (
                      <Button
                        key={u}
                        size="sm"
                        variant="secondary"
                        title={UPGRADE_BLURB[u]}
                        onClick={() =>
                          patchGame((g) => scheduleBuild(g, me.id, system.id, u))
                        }
                      >
                        {UPGRADE_LABEL[u]} {cost.tech}/{cost.metals}/{cost.chon}
                      </Button>
                    );
                  })}
                </div>
                {system.upgrades.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] uppercase tracking-wide text-faint">
                      Demolish
                    </summary>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {system.upgrades.map((u) => (
                        <Button
                          key={u}
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            patchGame((g) => toggleDestroyUpgrade(g, me.id, system.id, u))
                          }
                        >
                          {isUpgradePendingDestroy(state, system.id, u)
                            ? `Keep ${UPGRADE_LABEL[u]}`
                            : `Wreck ${UPGRADE_LABEL[u]}`}
                        </Button>
                      ))}
                    </div>
                  </details>
                )}
              </>
            )}
          </Section>

          <Section title={`Starfleets (${system.fleets.length})`}>
            {mine && (
              <Button
                size="sm"
                variant="secondary"
                className="mb-2"
                onClick={() =>
                  patchGame((g) => scheduleBuild(g, me.id, system.id, "starfleet"))
                }
              >
                Build starfleet {BUILD_COST.starfleet.tech}/{BUILD_COST.starfleet.metals}/
                {BUILD_COST.starfleet.chon}
              </Button>
            )}
            {myFleets.map((f) => (
              <FleetRow
                key={f.id}
                fleet={f}
                system={system}
                state={state}
                active={orderFleetId === f.id}
                onHold={() =>
                  patchGame((g) => {
                    const fl = g.systems.flatMap((s) => s.fleets).find((x) => x.id === f.id);
                    if (fl) setFleetOrder(g, fl, { kind: "hold" });
                  })
                }
                onMove={() => setOrderMode("move", f.id)}
                onSupport={() => setOrderMode("support-from", f.id)}
                onRally={() => setOrderMode("rally", f.id)}
                onScuttle={() =>
                  patchGame((g) => {
                    const fl = g.systems.flatMap((s) => s.fleets).find((x) => x.id === f.id);
                    if (fl) toggleDestroyFleet(g, fl);
                  })
                }
              />
            ))}
            {!mine && system.fleets.length > 0 && (
              <p className="text-sm text-muted">
                {system.fleets.length}{" "}
                {owner && areAllied(state, me.id, owner.id) ? "allied" : "hostile"} starfleet
                {system.fleets.length === 1 ? "" : "s"}
              </p>
            )}
            {system.fleets.length === 0 && (
              <p className="text-sm text-faint">No starfleets present.</p>
            )}
          </Section>
        </>
      )}

      {fog && (
        <p className="text-sm text-muted">
          Fog of war conceals upgrades and starfleets this far from your space.
        </p>
      )}

      {!mine && system.neighbors.some((n) => state.systems.find((s) => s.id === n)?.ownerId === me.id) && (
        <Section title="Operations">
          <TradeForm
            state={state}
            me={me}
            system={system}
            patchGame={patchGame}
          />
          {system.ownerId && system.ownerId !== me.id && (
            <EspionageForm
              state={state}
              me={me}
              system={system}
              patchGame={patchGame}
              onHostile={onHostile}
            />
          )}
        </Section>
      )}
    </aside>
  );
}

function FleetRow({
  fleet,
  system,
  state,
  active,
  onMove,
  onHold,
  onSupport,
  onRally,
  onScuttle,
}: {
  fleet: Fleet;
  system: StarSystem;
  state: GameState;
  active: boolean;
  onMove: () => void;
  onHold: () => void;
  onSupport: () => void;
  onRally: () => void;
  onScuttle: () => void;
}) {
  const order = fleet.order;
  const destName =
    order.kind === "move" || order.kind === "support"
      ? state.systems.find((s) => s.id === order.destId)?.name
      : null;
  const dest =
    order.kind === "move"
      ? destName
      : order.kind === "support"
        ? `support → ${destName}`
        : "hold";
  const wh = canUseWormhole(state, fleet);
  void system;
  return (
    <div className={cn("mb-2 rounded-md bg-raised p-2 hairline", active && "ring-1 ring-accent")}>
      <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
        <span className="tabular-nums">Fleet {fleet.id.slice(-4)}</span>
        <span className="text-accent">{dest}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        <Tiny onClick={onHold}>Hold</Tiny>
        <Tiny onClick={onMove}>{wh ? "Move / Jump" : "Move"}</Tiny>
        <Tiny onClick={onSupport}>Support</Tiny>
        <Tiny onClick={onRally}>Rally</Tiny>
        <Tiny onClick={onScuttle}>{fleet.scheduledDestroy ? "Keep" : "Scuttle"}</Tiny>
      </div>
    </div>
  );
}

function Tiny(props: { children: string; onClick: () => void }) {
  return (
    <button
      className="h-8 rounded-sm bg-inset px-2 text-[11px] uppercase tracking-wide text-muted hover:text-fg"
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

function MiniStat({ k, v }: { k: string; v: number }) {
  return (
    <div className="rounded-md bg-inset px-2 py-2">
      <div className="text-[10px] uppercase tracking-[0.14em] text-faint">{k}</div>
      <div className="font-display text-lg tabular-nums">{v}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="mb-2 text-[11px] uppercase tracking-[0.18em] text-faint">{title}</h3>
      {children}
    </section>
  );
}

function TradeForm({
  state,
  me,
  system,
  patchGame,
}: {
  state: GameState;
  me: Player;
  system: StarSystem;
  patchGame: (fn: (g: GameState) => void) => void;
}) {
  const [t, setT] = useState(0);
  const [m, setM] = useState(0);
  const [c, setC] = useState(0);
  const existing = state.trades.filter(
    (x) => x.playerId === me.id && x.systemId === system.id,
  );
  return (
    <div className="mb-3 rounded-md bg-inset p-2">
      <div className="mb-1 text-xs text-muted">Deliver resources to whoever holds this system after resolution.</div>
      <div className="mb-2 grid grid-cols-3 gap-1">
        <Num label="T" value={t} max={me.resources.tech} onChange={setT} />
        <Num label="M" value={m} max={me.resources.metals} onChange={setM} />
        <Num label="C" value={c} max={me.resources.chon} onChange={setC} />
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          patchGame((g) => {
            scheduleTrade(g, me.id, system.id, { tech: t, metals: m, chon: c });
          })
        }
      >
        Schedule delivery
      </Button>
      {existing.map((e) => (
        <button
          key={e.id}
          className="mt-1 block text-xs text-accent"
          onClick={() => patchGame((g) => cancelTrade(g, e.id))}
        >
          Cancel {e.resources.tech}/{e.resources.metals}/{e.resources.chon}
        </button>
      ))}
    </div>
  );
}

function EspionageForm({
  state,
  me,
  system,
  patchGame,
  onHostile,
}: {
  state: GameState;
  me: Player;
  system: StarSystem;
  patchGame: (fn: (g: GameState) => void) => void;
  onHostile: (text: string, proceed: () => void) => void;
}) {
  const acts: { kind: EspionageKind; label: string; extra?: Partial<GameState["espionage"][number]> }[] = [
    { kind: "sabotage", label: "Sabotage fleets", extra: { targetUpgrade: "fleets" } },
    { kind: "sabotage", label: "Sabotage starport", extra: { targetUpgrade: "starport" } },
    { kind: "destabilize", label: "Destabilize government" },
    { kind: "counter", label: "Counter-espionage (here if owned)" },
  ];
  return (
    <div className="flex flex-col gap-1">
      {acts.map((a) => (
        <Button
          key={a.label}
          variant="ghost"
          size="sm"
          className="justify-start"
          onClick={() => {
            const run = () =>
              patchGame((g) => {
                scheduleEspionage(g, {
                  id: uid("esp"),
                  playerId: me.id,
                  kind: a.kind,
                  systemId: system.id,
                  ...a.extra,
                });
              });
            const warn =
              a.kind === "sabotage" || a.kind === "destabilize"
                ? hostileOrderWarning(state, me.id, "espionage", system.id)
                : null;
            if (warn) onHostile(warn, run);
            else run();
          }}
        >
          {a.label} · 1 Tech
        </Button>
      ))}
      {state.espionage
        .filter((e) => e.playerId === me.id)
        .map((e) => (
          <button
            key={e.id}
            className="text-left text-xs text-accent"
            onClick={() => patchGame((g) => cancelEspionage(g, e.id))}
          >
            Cancel {e.kind}
            {e.systemId ? ` @ ${state.systems.find((s) => s.id === e.systemId)?.name}` : ""}
          </button>
        ))}
    </div>
  );
}

function Num({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex items-center gap-1 rounded-sm bg-raised px-2 py-1 text-xs">
      {label}
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(max, Number(e.target.value) || 0)))}
        className="w-full bg-transparent tabular-nums outline-none"
      />
    </label>
  );
}

function Briefing() {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-bg/70 p-4 backdrop-blur-[2px]">
      <div className="max-w-md rounded-xl bg-surface p-6 hairline">
        <p className="text-[11px] uppercase tracking-[0.22em] text-accent">First briefing</p>
        <h2 className="mt-1 font-display text-3xl">The survey is complete</h2>
        <p className="mt-3 text-sm text-muted">
          You control the highlighted home systems. Each starfleet may hold, move through a wormhole,
          or support another fleet. Spend Tech, Metals and CHON on upgrades and new fleets — then
          End Turn. All civilizations issue orders at once. Dispatches can bundle a trade with an
          alliance; accepting seals the alliance immediately, but goods still have to be scheduled.
        </p>
        <Button className="mt-5 w-full" onClick={() => useApp.setState({ briefing: false })}>
          Assume command
        </Button>
      </div>
    </div>
  );
}

function TurnReport({
  state,
  me,
  onClose,
  onOpenDiplomacy,
  onReplay,
}: {
  state: GameState;
  me: Player;
  onClose: () => void;
  onOpenDiplomacy?: () => void;
  onReplay: () => void;
}) {
  const ended = state.phase === "ended";
  const won = state.winnerIds?.includes(me.id);
  const unread = unreadCount(state, me.id);
  const theirs = (state.promiseReports ?? []).filter(
    (r) => r.otherId === me.id || (r.kind === "alliance" && (r.actorId === me.id || r.otherId === me.id)),
  );
  const mine = (state.promiseReports ?? []).filter(
    (r) => r.actorId === me.id && r.kind !== "alliance",
  );
  const seen = new Set<string>();
  const theirUnique = theirs.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
  return (
    <div className="absolute inset-0 z-30 grid place-items-end bg-bg/60 p-3 backdrop-blur-[2px] md:place-items-center">
      <div className="max-h-[80%] w-full max-w-lg overflow-y-auto rounded-xl bg-surface p-5 hairline">
        <p className="text-[11px] uppercase tracking-[0.22em] text-accent">
          {ended ? "Final dispatch" : `Turn ${state.turn - 1} resolved`}
        </p>
        <h2 className="font-display text-3xl">
          {ended
            ? won && state.result === "win"
              ? "The galaxy is yours"
              : state.result === "tie"
                ? "A divided sky"
                : "Your government has fallen"
            : "After-action"}
        </h2>
        {theirUnique.length > 0 && (
          <div className="mt-4">
            <h3 className="text-[11px] uppercase tracking-[0.18em] text-faint">Their word</h3>
            <ul className="mt-2 space-y-3">
              {theirUnique.map((r) => {
                const actor = state.players.find((p) => p.id === r.actorId);
                const other = state.players.find((p) => p.id === (r.actorId === me.id ? r.otherId : r.actorId));
                const name = (r.kind === "alliance" ? other : actor)?.civ.name ?? "Unknown";
                return (
                  <li key={r.id} className="rounded-md bg-raised p-3 hairline">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm text-fg">{name}</span>
                      <span
                        className={cn(
                          "text-[10px] uppercase tracking-wider",
                          r.result === "kept" && "text-ok",
                          r.result === "partial" && "text-warn",
                          r.result === "broken" && "text-ember",
                        )}
                      >
                        {r.result === "kept"
                          ? "Performed"
                          : r.result === "partial"
                            ? "Performed differently"
                            : "Not performed"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted">{r.detail}</p>
                    {(r.extras ?? []).map((x) => (
                      <p key={x} className="mt-1 text-xs text-ember">
                        Also: {x}
                      </p>
                    ))}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {mine.length > 0 && (
          <div className="mt-4">
            <h3 className="text-[11px] uppercase tracking-[0.18em] text-faint">Your word</h3>
            <ul className="mt-2 space-y-2">
              {mine.map((r) => (
                <li key={r.id} className="text-sm text-muted">
                  <span
                    className={cn(
                      "mr-2 text-[10px] uppercase tracking-wider",
                      r.result === "kept" && "text-ok",
                      r.result === "partial" && "text-warn",
                      r.result === "broken" && "text-ember",
                    )}
                  >
                    {r.result === "kept"
                      ? "Performed"
                      : r.result === "partial"
                        ? "Performed differently"
                        : "Not performed"}
                  </span>
                  {r.detail}
                </li>
              ))}
            </ul>
          </div>
        )}
        <ul className="mt-4 space-y-2">
          {state.log.length === 0 && theirUnique.length === 0 && mine.length === 0 && (
            <li className="text-sm text-muted">The sector was quiet.</li>
          )}
          {state.log.map((e) => (
            <li key={e.id} className="border-l-2 border-border pl-3 text-sm text-muted">
              <span
                className={cn(
                  "mr-2 text-[10px] uppercase tracking-wider",
                  e.severity === "combat" && "text-ember",
                  e.severity === "intel" && "text-accent",
                  e.severity === "alert" && "text-warn",
                  e.severity === "econ" && "text-ok",
                )}
              >
                {e.severity}
              </span>
              {e.text}
            </li>
          ))}
        </ul>
        {ended ? (
          <>
            <ScoreCard state={state} />
            <div className="mt-5 space-y-2">
              <Button className="w-full" onClick={onReplay}>
                View full replay
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => useApp.getState().setScreen("menu")}>
                Return to admiralty
              </Button>
            </div>
          </>
        ) : (
          <div className="mt-5 space-y-2">
            {unread > 0 && onOpenDiplomacy && (
              <Button variant="secondary" className="w-full" onClick={onOpenDiplomacy}>
                Read {unread} diplomatic dispatch{unread === 1 ? "" : "es"}
              </Button>
            )}
            <Button className="w-full" onClick={onClose}>
              Continue
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreCard({ state }: { state: GameState }) {
  const rows = scoreCard(state).sort((a, b) => {
    if (a.winner !== b.winner) return a.winner ? -1 : 1;
    return b.systems - a.systems;
  });
  return (
    <div className="mt-4 overflow-hidden rounded-md hairline">
      <div className="grid grid-cols-[1fr_repeat(3,2.4rem)_auto] gap-x-2 bg-raised px-3 py-2 text-[10px] uppercase tracking-wider text-faint">
        <span>Admiralty</span>
        <span className="text-right">Sys</span>
        <span className="text-right">Flt</span>
        <span className="text-right">Upg</span>
        <span className="text-right">T·M·C</span>
      </div>
      {rows.map((r) => (
        <div
          key={r.playerId}
          className={cn(
            "grid grid-cols-[1fr_repeat(3,2.4rem)_auto] gap-x-2 px-3 py-2 text-sm",
            r.winner && "bg-raised/60",
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <span className="size-2 shrink-0 rounded-full" style={{ background: r.color }} />
            {r.name}
          </span>
          <span className="text-right tabular-nums">{r.systems}</span>
          <span className="text-right tabular-nums">{r.fleets}</span>
          <span className="text-right tabular-nums">{r.upgrades}</span>
          <span className="text-right tabular-nums text-muted">
            {r.resources.tech}·{r.resources.metals}·{r.resources.chon}
          </span>
        </div>
      ))}
    </div>
  );
}

function Overlay({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-end bg-bg/60 p-3 backdrop-blur-[2px] md:place-items-center">
      <div className="max-h-[88%] w-full max-w-3xl overflow-y-auto rounded-xl bg-surface p-5 hairline">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl">{title}</h2>
          <button onClick={onClose} className="size-10 rounded-md hover:bg-raised" aria-label="Close">
            <X className="mx-auto size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function IntelSheet({
  state,
  me,
  onClose,
}: {
  state: GameState;
  me: Player;
  onClose: () => void;
}) {
  return (
    <Overlay title="Situation" onClose={onClose}>
      <ul className="space-y-2">
        {state.players
          .filter((p) => playerKnown(state, me.id, p.id))
          .map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-md bg-raised p-2 hairline">
              <FlagMark spec={p.civ.flag} className="h-6 w-10" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{p.civ.name}</div>
                <div className="text-[11px] text-faint">
                  {state.systems.filter((s) => s.ownerId === p.id).length} systems ·{" "}
                  {state.systems.reduce(
                    (n, s) => n + s.fleets.filter((f) => f.ownerId === p.id).length,
                    0,
                  )}{" "}
                  fleets
                  {p.kind === "ai" ? " · automated admiralty" : ""}
                  {p.collapsed ? " · collapsed" : ""}
                  {p.id !== me.id && areAllied(state, me.id, p.id) ? " · allied" : ""}
                </div>
              </div>
            </li>
          ))}
      </ul>
    </Overlay>
  );
}

function IncidentDialog({
  state,
  me,
  incidentId,
  onClose,
  patchGame,
  onThreaten,
}: {
  state: GameState;
  me: Player;
  incidentId: string;
  onClose: () => void;
  patchGame: (fn: (g: GameState) => void) => void;
  onThreaten: () => void;
}) {
  const inc = (state.allyIncidents ?? []).find((i) => i.id === incidentId);
  const [unless, setUnless] = useState("withdraw from the contested system");
  if (!inc) return null;
  const actor = state.players.find((p) => p.id === inc.actorId);
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-bg/70 p-4">
      <div className="max-w-md rounded-xl bg-surface p-5 hairline">
        <p className="text-[11px] uppercase tracking-[0.22em] text-ember">Allied incident</p>
        <h2 className="mt-1 font-display text-2xl">{actor?.civ.name ?? "An ally"}</h2>
        <p className="mt-3 text-sm text-muted">{inc.text}</p>
        <p className="mt-2 text-xs text-faint">
          This does not break the alliance on its own. You choose whether to ignore it, send a
          message dissolving the compact, or threaten to dissolve it unless they do something
          specific.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              patchGame((g) => {
                respondToIncident(g, me.id, inc.id, "ignored");
              });
              onClose();
            }}
          >
            Ignore — keep the alliance, send nothing
          </Button>
          <Button
            variant="ember"
            onClick={() => {
              patchGame((g) => {
                respondToIncident(g, me.id, inc.id, "broke");
              });
              onClose();
            }}
          >
            Send a message breaking the alliance
          </Button>
          <label className="text-[11px] uppercase tracking-wide text-faint">
            Threaten unless they…
            <input
              className="mt-1 h-10 w-full rounded-sm bg-inset px-3 text-sm font-normal normal-case tracking-normal text-fg"
              value={unless}
              onChange={(e) => setUnless(e.target.value)}
              placeholder="send 2 CHON to my border"
              maxLength={80}
            />
          </label>
          <Button
            onClick={() => {
              patchGame((g) => {
                respondToIncident(
                  g,
                  me.id,
                  inc.id,
                  "threatened",
                  unless.trim() || "make amends for this slight",
                );
              });
              onThreaten();
            }}
          >
            Threaten to break unless they do that
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Decide later
          </Button>
        </div>
      </div>
    </div>
  );
}
