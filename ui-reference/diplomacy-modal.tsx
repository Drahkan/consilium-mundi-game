import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlagMark } from "@/components/flag";
import { useApp } from "@/lib/game/store";
import type {
  Attitude,
  DiplomacyMessage,
  DiplomacyTerms,
  EspionageKind,
  GameState,
  MessageTopic,
  Player,
  Resources,
} from "@/lib/game/types";
import { ZERO, cloneRes } from "@/lib/game/types";
import {
  ATTACK_INTENTS,
  SUPPORT_INTENTS,
  TOPICS,
  acceptOffer,
  areAllied,
  counterOffer,
  declineOffer,
  denounceAlliance,
  formatRes,
  legalMessageSystems,
  legalTradeDestinations,
  markThreadRead,
  previewDispatch,
  resNonzero,
  schedulePactDelivery,
  sendThreadMessage,
  viewTerms,
  visibleThreads,
  offerHeadline,
  draftCounter,
} from "@/lib/game/diplomacy";
import { unsentPactsFor } from "@/lib/game/alliance";
import { ATTITUDE_LABEL } from "@/lib/game/constants";
import { playerKnown } from "@/lib/game/vision";
import { cn } from "@/lib/utils";

function preferOwned(state: GameState, ids: string[], ownerId: string): string[] {
  return [...ids].sort((a, b) => {
    const oa = state.systems.find((s) => s.id === a)?.ownerId === ownerId ? 0 : 1;
    const ob = state.systems.find((s) => s.id === b)?.ownerId === ownerId ? 0 : 1;
    return oa - ob;
  });
}

export function DiplomacyModal({
  state,
  me,
  onClose,
}: {
  state: GameState;
  me: Player;
  onClose: () => void;
}) {
  const patchGame = useApp((s) => s.patchGame);
  const setOrderMode = useApp((s) => s.setOrderMode);
  const selectSystem = useApp((s) => s.selectSystem);
  const [picking, setPicking] = useState(false);
  const others = state.players.filter(
    (p) => p.id !== me.id && !p.collapsed && playerKnown(state, me.id, p.id),
  );
  const threads = visibleThreads(state, me.id);
  const unreadPeer =
    others.find((p) =>
      threads.some(
        (t) =>
          t.participants.includes(p.id) &&
          t.messages.some((m) => m.toPlayerId === me.id && !m.read),
      ),
    )?.id ??
    others[0]?.id ??
    "";
  const [peer, setPeer] = useState(unreadPeer);
  const [compose, setCompose] = useState(false);
  const [open, setOpen] = useState<string | null>(() => {
    const forPeer = threads.filter((t) => t.participants.includes(unreadPeer));
    return (
      forPeer.find((t) => t.messages.some((m) => m.toPlayerId === me.id && !m.read))?.id ??
      forPeer[0]?.id ??
      null
    );
  });

  useEffect(() => {
    return () => {
      const s = useApp.getState();
      if (s.orderMode === "message-sys" || s.orderMode === "trade") s.setOrderMode(null);
    };
  }, []);

  if (state.options.disableCommunications) {
    return (
      <Overlay onClose={onClose} title="Diplomacy">
        <p className="text-sm text-muted">Communications are disabled in this game.</p>
      </Overlay>
    );
  }

  const peerThreads = threads.filter((t) =>
    t.participants.includes(peer) ||
    t.messages.some((m) => m.apparentFromId === peer || m.toPlayerId === peer),
  );

  return (
    <Overlay onClose={onClose} title="Diplomacy" compact={picking}>
      {picking ? (
        <div>
          <p className="text-sm text-fg">Select a solar system on the map for this dispatch.</p>
          <p className="mt-1 text-xs text-muted">
            Highlighted stars are systems you or they can actually reach. Support also needs an adjacent origin from the dropdown.
          </p>
          <Button
            className="mt-3"
            variant="secondary"
            onClick={() => {
              setPicking(false);
              setOrderMode(null);
            }}
          >
            Back to draft
          </Button>
        </div>
      ) : null}
      <div className={picking ? "hidden" : undefined}>
      <div className="grid gap-4 lg:grid-cols-[14rem_1fr]">
        <aside className="space-y-1">
          {others.map((p) => {
            const list = threads.filter((t) => t.participants.includes(p.id));
            const unread = list.reduce(
              (n, t) => n + t.messages.filter((m) => m.toPlayerId === me.id && !m.read).length,
              0,
            );
            const allied = areAllied(state, me.id, p.id);
            return (
              <button
                key={p.id}
                onClick={() => {
                  setPeer(p.id);
                  setCompose(false);
                  setOpen(list[0]?.id ?? null);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hairline",
                  peer === p.id ? "bg-raised" : "bg-transparent hover:bg-raised/60",
                )}
              >
                <FlagMark spec={p.civ.flag} className="h-5 w-8 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-sm">{p.civ.name}</div>
                    {allied && (
                      <span className="shrink-0 rounded-sm bg-ok/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ok">
                        Allied
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-faint">
                    {list.length} thread{list.length === 1 ? "" : "s"}
                    {unread ? ` · ${unread} unread` : ""}
                  </div>
                </div>
              </button>
            );
          })}
          <Button
            className="mt-3 w-full"
            size="sm"
            disabled={!peer}
            onClick={() => setCompose(true)}
          >
            New dispatch
          </Button>
          {peer && areAllied(state, me.id, peer) && (
            <Button
              className="mt-2 w-full"
              size="sm"
              variant="ghost"
              onClick={() => {
                patchGame((g) => {
                  denounceAlliance(g, me.id, peer);
                });
              }}
            >
              Send a message ending the alliance
            </Button>
          )}
        </aside>

        <div className="min-w-0">
          {compose ? (
            <ComposeForm
              state={state}
              me={me}
              toId={peer}
              picking={picking}
              onPickMap={() => {
                selectSystem(null);
                setOrderMode("message-sys");
                setPicking(true);
              }}
              onPicked={() => {
                setPicking(false);
                setOrderMode(null);
              }}
              onSent={(id) => {
                setCompose(false);
                setOpen(id);
              }}
              onCancel={() => setCompose(false)}
            />
          ) : (
            <ThreadList
              state={state}
              me={me}
              threads={peerThreads}
              open={open}
              onOpen={(id) => {
                setOpen(id);
                patchGame((g) => markThreadRead(g, id, me.id));
              }}
            />
          )}
        </div>
      </div>
      </div>
    </Overlay>
  );
}

function ThreadList({
  state,
  me,
  threads,
  open,
  onOpen,
}: {
  state: GameState;
  me: Player;
  threads: ReturnType<typeof visibleThreads>;
  open: string | null;
  onOpen: (id: string) => void;
}) {
  if (threads.length === 0) {
    return <p className="text-sm text-muted">No correspondence with this power yet.</p>;
  }
  return (
    <div className="space-y-2">
      {threads.map((t) => {
        const last = t.messages[t.messages.length - 1]!;
        const unread = t.messages.some((m) => m.toPlayerId === me.id && !m.read);
        return (
          <div key={t.id} className="rounded-md bg-raised p-3 hairline">
            <button className="flex w-full items-center gap-2 text-left" onClick={() => onOpen(t.id)}>
              <span className="text-[10px] uppercase tracking-wide text-faint">{t.topic}</span>
              <span className="ml-auto text-[10px] text-faint">
                Turn {last.turn} · {t.messages.length} message{t.messages.length === 1 ? "" : "s"}
              </span>
              {unread && (
                <span className="rounded-sm bg-ember/20 px-1.5 text-[10px] uppercase text-ember">
                  Unread
                </span>
              )}
            </button>
            {open !== t.id && (
              <p className="mt-1 text-xs leading-snug text-muted">
                {offerHeadline(state, last, me.id)}
              </p>
            )}
            {open === t.id && (
              <div className="mt-3 space-y-3">
                {t.messages.map((m, i) => (
                  <MessageCard
                    key={m.id}
                    state={state}
                    me={me}
                    msg={m}
                    actionable={i === t.messages.length - 1 && m.toPlayerId === me.id}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MessageCard({
  state,
  me,
  msg,
  actionable,
}: {
  state: GameState;
  me: Player;
  msg: DiplomacyMessage;
  actionable: boolean;
}) {
  const patchGame = useApp((s) => s.patchGame);
  const [err, setErr] = useState<string | null>(null);
  const [countering, setCountering] = useState(false);
  const author = state.players.find((p) => p.id === msg.apparentFromId);
  const view = viewTerms(state, msg, me.id);
  const mine = msg.fromPlayerId === me.id;
  const closed =
    msg.status === "accepted" || msg.status === "declined" || msg.status === "countered";
  const awaiting = actionable && !mine && !closed;

  return (
    <article className="rounded-md bg-inset p-3">
      <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-faint">
        <span className="text-accent normal-case tracking-normal">
          {author?.civ.name ?? "Unknown"}
        </span>
        <span>· {ATTITUDE_LABEL[msg.attitude]}</span>
        <span>· Turn {msg.turn}</span>
        {msg.status && (
          <span
            className={cn(
              "ml-auto normal-case",
              msg.status === "accepted" && "text-ok",
              msg.status === "declined" && "text-ember",
              msg.status === "countered" && "text-warn",
              msg.status === "open" && "text-accent",
            )}
          >
            {msg.status}
          </span>
        )}
      </div>
      <p className="text-sm leading-relaxed text-muted">{msg.text}</p>
      {(view.incoming || view.outgoing || view.intent || awaiting) && (
        <div className="mt-3 space-y-2 rounded-md bg-raised p-3 hairline">
          <div className="text-[10px] uppercase tracking-[0.16em] text-faint">
            {closed
              ? `Offer ${msg.status}`
              : mine
                ? "Terms you proposed"
                : "If you accept this offer"}
          </div>
          {view.incoming && (
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-ok">You receive</span>
              <span className="text-right font-medium text-fg">{view.incoming}</span>
            </div>
          )}
          {view.outgoing && (
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-ember">You give</span>
              <span className="text-right font-medium text-fg">{view.outgoing}</span>
            </div>
          )}
          {!view.incoming && !view.outgoing && view.intent && (
            <p className="text-sm text-fg">{view.intent}</p>
          )}
          {view.intent && (view.incoming || view.outgoing) && (
            <p className="text-xs text-muted">{view.intent}</p>
          )}
          {awaiting && (
            <p className="text-xs text-muted">{view.blockedReason ?? view.acceptHint}</p>
          )}
        </div>
      )}
      {awaiting && !countering && (
        <div className="mt-3 space-y-2">
          {err && <p className="text-xs text-ember">{err}</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              size="md"
              disabled={!view.canAccept}
              onClick={() => {
                patchGame((g) => {
                  const r = acceptOffer(g, me.id, msg.id);
                  setErr(r);
                });
              }}
            >
              {msg.terms?.allianceClause === "form" || msg.topic === "alliance"
                ? "Accept these terms"
                : msg.topic === "trade"
                  ? "Accept this bargain"
                  : "Accept"}
            </Button>
            <Button
              size="md"
              variant="secondary"
              onClick={() => {
                patchGame((g) => {
                  declineOffer(g, me.id, msg.id, "polite");
                });
              }}
            >
              Decline
            </Button>
            {awaiting && (
              <Button size="md" variant="ghost" onClick={() => setCountering(true)}>
                Counter-offer
              </Button>
            )}
            <Button
              size="md"
              variant="ghost"
              onClick={() => {
                patchGame((g) => {
                  declineOffer(g, me.id, msg.id, "belligerent");
                });
              }}
            >
              Rebuke
            </Button>
          </div>
        </div>
      )}
      {msg.status === "accepted" && (() => {
        const pact = (state.pacts ?? []).find((p) => p.messageId === msg.id);
        if (!pact) return null;
        const mine = unsentPactsFor(state, me.id).some((p) => p.id === pact.id);
        if (!mine) return null;
        return (
          <Button
            className="mt-2"
            size="sm"
            variant="secondary"
            onClick={() => {
              patchGame((g) => {
                const r = schedulePactDelivery(g, me.id, pact.id);
                setErr(r);
              });
            }}
          >
            Schedule my promised delivery
          </Button>
        );
      })()}
      {countering ? (
        <CounterForm
          state={state}
          me={me}
          original={msg}
          onCancel={() => setCountering(false)}
          onSend={(terms) => {
            patchGame((g) => {
              const r = counterOffer(g, me.id, msg.id, terms);
              setErr(r);
            });
            setCountering(false);
          }}
        />
      ) : null}
    </article>
  );
}

function pickLegal(ids: string[], preferred?: string): string {
  if (preferred && ids.includes(preferred)) return preferred;
  return ids[0] ?? "";
}

function CounterForm({
  state,
  me,
  original,
  onCancel,
  onSend,
}: {
  state: GameState;
  me: Player;
  original: DiplomacyMessage;
  onCancel: () => void;
  onSend: (t: DiplomacyTerms) => void;
}) {
  const them = original.fromPlayerId;
  const theirDests = preferOwned(state, legalTradeDestinations(state, me.id), them);
  const myDests = preferOwned(state, legalTradeDestinations(state, them), me.id);
  const draft = draftCounter(original.terms, theirDests, myDests);
  const [give, setGive] = useState<Resources>(cloneRes(draft.give ?? ZERO));
  const [request, setRequest] = useState<Resources>(cloneRes(draft.request ?? ZERO));
  const [giveSystemId, setGiveSystemId] = useState(draft.giveSystemId ?? "");
  const [requestSystemId, setRequestSystemId] = useState(draft.requestSystemId ?? "");
  const allied = areAllied(state, me.id, them);
  const [allianceClause, setAllianceClause] = useState<"form" | "break" | "">(() => {
    if (allied) return original.terms?.allianceClause === "break" ? "break" : "";
    return (
      original.terms?.allianceClause ??
      (original.topic === "alliance" && original.terms?.intent !== "with-third" ? "form" : "")
    );
  });
  const originalView = viewTerms(state, original, me.id);

  function swapSides() {
    const nextGive = cloneRes(request);
    const nextRequest = cloneRes(give);
    const nextGiveSys = pickLegal(theirDests, requestSystemId);
    const nextRequestSys = pickLegal(myDests, giveSystemId);
    setGive(nextGive);
    setRequest(nextRequest);
    setGiveSystemId(nextGiveSys);
    setRequestSystemId(nextRequestSys);
  }

  return (
    <div className="mt-3 space-y-2 rounded-sm bg-raised p-2 hairline">
      <div className="text-[10px] uppercase tracking-wide text-faint">Your counter</div>
      {(originalView.incoming || originalView.outgoing || originalView.intent) && (
        <p className="text-xs text-muted">
          They proposed
          {originalView.outgoing ? ` you send ${originalView.outgoing}` : ""}
          {originalView.incoming ? ` they send ${originalView.incoming}` : ""}
          {originalView.intent ? ` · ${originalView.intent}` : ""}. Rewrite any clause.
        </p>
      )}
      <TradeFields
        state={state}
        give={give}
        request={request}
        giveSystemId={giveSystemId}
        requestSystemId={requestSystemId}
        giveDests={theirDests}
        requestDests={myDests}
        giveLabel="You send (lands at)"
        requestLabel="You ask them to send (lands at)"
        onGive={setGive}
        onRequest={setRequest}
        onGiveSys={setGiveSystemId}
        onRequestSys={setRequestSystemId}
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" type="button" onClick={swapSides}>
          Swap who sends what
        </Button>
      </div>
      <label className="flex items-start gap-2 text-xs text-muted">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={allianceClause === "form" || allianceClause === "break"}
          onChange={(e) =>
            setAllianceClause(e.target.checked ? (allied ? "break" : "form") : "")
          }
        />
        <span>
          {allied
            ? "Bundle: dissolve the alliance if they accept this counter."
            : "Bundle: form a mutual alliance if they accept this counter (in force immediately)."}
        </span>
      </label>
      <p className="text-xs text-muted">
        You send {formatRes(give)}
        {resNonzero(give)
          ? ` to ${state.systems.find((s) => s.id === giveSystemId)?.name ?? "—"}`
          : ""}
        . You ask {formatRes(request)}
        {resNonzero(request)
          ? ` at ${state.systems.find((s) => s.id === requestSystemId)?.name ?? "—"}`
          : ""}
        .
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() =>
            onSend({
              give,
              request,
              giveSystemId: resNonzero(give) ? giveSystemId : undefined,
              requestSystemId: resNonzero(request) ? requestSystemId : undefined,
              allianceClause: allianceClause || undefined,
              intent: allianceClause === "form" ? "with-you" : original.terms?.intent,
            })
          }
        >
          Send counter
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ComposeForm({
  state,
  me,
  toId,
  picking,
  onPickMap,
  onPicked,
  onSent,
  onCancel,
}: {
  state: GameState;
  me: Player;
  toId: string;
  picking: boolean;
  onPickMap: () => void;
  onPicked: () => void;
  onSent: (threadId: string) => void;
  onCancel: () => void;
}) {
  const patchGame = useApp((s) => s.patchGame);
  const setMessageLegalIds = useApp((s) => s.setMessageLegalIds);
  const to = state.players.find((p) => p.id === toId);
  const [topic, setTopic] = useState<MessageTopic>("trade");
  const [attitude, setAttitude] = useState<Attitude>(me.civ.attitude);
  const [systemId, setSystemId] = useState("");
  const [neighborId, setNeighborId] = useState("");
  const [aboutPlayerId, setAboutPlayerId] = useState(toId);

  const [intent, setIntent] = useState<string>("i-attack");
  const [espionageKind, setEspionageKind] = useState<EspionageKind>("sabotage");
  const [unless, setUnless] = useState("");
  const theirDests = preferOwned(state, legalTradeDestinations(state, me.id), toId);
  const myDests = preferOwned(state, legalTradeDestinations(state, toId), me.id);
  const [give, setGive] = useState<Resources>(cloneRes(ZERO));
  const [request, setRequest] = useState<Resources>({ tech: 0, metals: 0, chon: 1 });
  const [giveSystemId, setGiveSystemId] = useState(theirDests[0] ?? "");
  const [requestSystemId, setRequestSystemId] = useState(myDests[0] ?? "");
  const selectedId = useApp((s) => s.selectedSystemId);
  const allied = areAllied(state, me.id, toId);
  const [attachAlliance, setAttachAlliance] = useState(false);
  const [attachTrade, setAttachTrade] = useState(topic === "trade");

  const legalSys = useMemo(
    () => legalMessageSystems(state, topic, me.id, toId, espionageKind),
    [state, topic, me.id, toId, espionageKind],
  );

  useEffect(() => {
    if (legalSys.length && !legalSys.includes(systemId)) {
      setSystemId(legalSys[0]!);
      const s = state.systems.find((x) => x.id === legalSys[0]);
      setNeighborId(s?.neighbors[0] ?? "");
    }
  }, [legalSys, systemId, state.systems]);

  useEffect(() => {
    setAttachTrade(topic === "trade");
  }, [topic]);

  useEffect(() => {
    if (topic === "alliance") setAboutPlayerId(toId);
    if (topic === "intelligence") {
      const third = state.players.find((p) => p.id !== me.id && p.id !== toId && !p.collapsed);
      setAboutPlayerId(third?.id ?? toId);
    }
  }, [topic, toId, me.id, state.players]);

  useEffect(() => {
    if (!picking || !selectedId) return;
    if (!legalSys.includes(selectedId)) return;
    setSystemId(selectedId);
    const s = state.systems.find((x) => x.id === selectedId);
    if (s?.neighbors[0]) setNeighborId(s.neighbors[0]);
    onPicked();
  }, [picking, selectedId, state.systems, onPicked, legalSys]);

  const neighbors = useMemo(() => {
    const s = state.systems.find((x) => x.id === systemId);
    return (s?.neighbors ?? [])
      .map((id) => state.systems.find((x) => x.id === id)!)
      .filter(Boolean);
  }, [state.systems, systemId]);

  const terms: DiplomacyTerms = useMemo(() => {
    const bundled: DiplomacyTerms = {};
    if (topic === "alliance") {
      if (aboutPlayerId !== toId) {
        bundled.intent = "with-third";
        bundled.aboutPlayerId = aboutPlayerId;
      } else {
        bundled.allianceClause = allied ? "break" : "form";
        bundled.intent = "with-you";
        bundled.aboutPlayerId = toId;
      }
    } else if (attachAlliance) {
      bundled.allianceClause = allied ? "break" : "form";
      bundled.intent = "with-you";
    }
    const wantTrade = topic === "trade" || attachTrade;
    if (wantTrade) {
      bundled.give = give;
      bundled.request = request;
      bundled.giveSystemId = giveSystemId;
      bundled.requestSystemId = requestSystemId;
    }
    if (topic === "attack") {
      bundled.intent = intent;
      bundled.unless = unless.trim() || undefined;
    }
    if (topic === "support") {
      bundled.intent = intent;
      bundled.unless = unless.trim() || undefined;
    }
    if (topic === "espionage") {
      bundled.espionageKind = espionageKind;
      bundled.intent = espionageKind;
      bundled.unless = unless.trim() || undefined;
    }
    if (topic === "intelligence") {
      bundled.aboutPlayerId = aboutPlayerId;
      bundled.unless = unless.trim() || undefined;
    }
    if (unless.trim() && (attitude === "belligerent" || attitude === "aggressive")) {
      bundled.unless = unless.trim();
    }
    return bundled;
  }, [
    topic,
    attachAlliance,
    attachTrade,
    allied,
    give,
    request,
    giveSystemId,
    requestSystemId,
    intent,
    unless,
    espionageKind,
    aboutPlayerId,
    toId,
    attitude,
  ]);

  const preview = to
    ? previewDispatch({
        state,
        from: me,
        to,
        topic,
        attitude,
        systemId,
        neighborId: neighborId || undefined,
        aboutPlayerId,
        terms,
      })
    : "";

  const tradeBlocked =
    (topic === "trade" || attachTrade) &&
    ((!resNonzero(give) && !resNonzero(request)) ||
      (resNonzero(give) && !giveSystemId) ||
      (resNonzero(request) && !requestSystemId));
  const supportBlocked = topic === "support" && (!systemId || !neighborId);
  const attackBlocked = topic === "attack" && !systemId;
  const espBlocked =
    topic === "espionage" &&
    (espionageKind === "sabotage" || espionageKind === "destabilize") &&
    !systemId;

  return (
    <div>
      <h3 className="mb-2 text-[11px] uppercase tracking-[0.18em] text-faint">
        New dispatch to {to?.civ.name}
      </h3>
      <Field label="Topic">
        <select
          className="w-full rounded-sm bg-inset px-2 py-2"
          value={topic}
          onChange={(e) => setTopic(e.target.value as MessageTopic)}
        >
          {TOPICS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Attitude">
        <select
          className="w-full rounded-sm bg-inset px-2 py-2"
          value={attitude}
          onChange={(e) => setAttitude(e.target.value as Attitude)}
        >
          {Object.entries(ATTITUDE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </Field>

      {topic !== "alliance" && (
        <label className="mb-2 flex items-start gap-2 text-sm text-muted">
          <input
            type="checkbox"
            className="mt-1"
            checked={attachAlliance}
            onChange={(e) => setAttachAlliance(e.target.checked)}
          />
          <span>
            {allied
              ? "Bundle: dissolve our alliance if they accept."
              : "Bundle: form a mutual alliance if they accept (in force immediately)."}
          </span>
        </label>
      )}
      {topic !== "trade" && (
        <label className="mb-2 flex items-start gap-2 text-sm text-muted">
          <input
            type="checkbox"
            className="mt-1"
            checked={attachTrade}
            onChange={(e) => setAttachTrade(e.target.checked)}
          />
          <span>Bundle a resource exchange. Each side still has to schedule its own delivery.</span>
        </label>
      )}

      {topic === "trade" || attachTrade ? (
        <TradeFields
          state={state}
          give={give}
          request={request}
          giveSystemId={giveSystemId}
          requestSystemId={requestSystemId}
          giveDests={theirDests}
          requestDests={myDests}
          giveLabel="You send them (lands at)"
          requestLabel="You ask in return (lands at)"
          onGive={setGive}
          onRequest={setRequest}
          onGiveSys={setGiveSystemId}
          onRequestSys={setRequestSystemId}
        />
      ) : null}

      {(topic === "attack" || topic === "support" || topic === "espionage") && (
        <>
          <Field label="System">
            <div className="flex gap-2">
              <select
                className="min-w-0 flex-1 rounded-sm bg-inset px-2 py-2"
                value={systemId}
                onChange={(e) => setSystemId(e.target.value)}
              >
                {legalSys.length === 0 && <option value="">No reachable system</option>}
                {legalSys.map((id) => {
                  const s = state.systems.find((x) => x.id === id);
                  if (!s) return null;
                  return (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.ownerId
                        ? ` — ${state.players.find((p) => p.id === s.ownerId)?.civ.name}`
                        : " — unclaimed"}
                    </option>
                  );
                })}
              </select>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={legalSys.length === 0}
                onClick={() => {
                  setMessageLegalIds(legalSys);
                  onPickMap();
                }}
              >
                Map
              </Button>
            </div>
            <p className="mt-1 text-[11px] normal-case tracking-normal text-faint">
              {topic === "support"
                ? "The destination of the supported action. Must be a system you or they can reach."
                : topic === "espionage"
                  ? "A legal espionage target for you or for them."
                  : "A system you own, they own, or either of you can currently reach."}
            </p>
          </Field>
          <Field label={topic === "support" ? "Supporting fleet would fire from (adjacent)" : "From / via (adjacent)"}>
            <select
              className="w-full rounded-sm bg-inset px-2 py-2"
              value={neighborId}
              onChange={(e) => setNeighborId(e.target.value)}
            >
              {topic !== "support" && <option value="">Unspecified</option>}
              {neighbors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </>
      )}

      {topic === "attack" && (
        <Field label="What you are proposing">
          <select
            className="w-full rounded-sm bg-inset px-2 py-2"
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
          >
            {ATTACK_INTENTS.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      {topic === "support" && (
        <Field label="What you are proposing">
          <select
            className="w-full rounded-sm bg-inset px-2 py-2"
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
          >
            {SUPPORT_INTENTS.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      {topic === "espionage" && (
        <Field label="Operation">
          <select
            className="w-full rounded-sm bg-inset px-2 py-2"
            value={espionageKind}
            onChange={(e) => setEspionageKind(e.target.value as EspionageKind)}
          >
            <option value="sabotage">Sabotage</option>
            <option value="destabilize">Destabilize government</option>
            <option value="fake">Fake a dispatch</option>
            <option value="intercept">Intercept correspondence</option>
          </select>
        </Field>
      )}
      {(topic === "intelligence" || topic === "alliance") && (
        <Field label={topic === "alliance" ? "Alliance with" : "Concerning"}>
          <select
            className="w-full rounded-sm bg-inset px-2 py-2"
            value={aboutPlayerId}
            onChange={(e) => setAboutPlayerId(e.target.value)}
          >
            {state.players
              .filter((p) => !p.collapsed)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id === toId
                    ? `${p.civ.name} (this admiralty)`
                    : p.id === me.id
                      ? `${p.civ.name} (you)`
                      : p.civ.name}
                </option>
              ))}
          </select>
        </Field>
      )}

      {(attitude === "belligerent" || attitude === "aggressive") && (
        <Field label='Condition ("unless you…") — optional'>
          <input
            className="h-10 w-full rounded-sm bg-inset px-3"
            value={unless}
            onChange={(e) => setUnless(e.target.value)}
            placeholder="withdraw from the named system"
            maxLength={80}
          />
        </Field>
      )}

      <div className="mt-3 rounded-md bg-inset p-3">
        <div className="text-[10px] uppercase tracking-wide text-faint">Diplomat’s draft</div>
        <p className="mt-1 text-sm leading-relaxed text-muted">{preview}</p>
        {topic === "trade" || attachTrade ? (
          <p className="mt-2 text-xs text-faint">
            {resNonzero(give)
              ? `You would send ${formatRes(give)} — only if you later schedule that delivery.`
              : "You send nothing unless you set an amount."}{" "}
            {resNonzero(request) ? `They would owe ${formatRes(request)}, same rule.` : ""}
            {resNonzero(give) && !giveSystemId
              ? " You need a bordering landing system to send goods."
              : ""}
            {resNonzero(request) && !requestSystemId
              ? " They need a bordering landing system to pay you."
              : ""}
          </p>
        ) : null}
        {(topic === "alliance" || attachAlliance) && (
          <p className="mt-2 text-xs text-faint">
            {allied
              ? "Accepting dissolves the alliance immediately."
              : "Accepting seals the alliance immediately — both of you must actively accept. You can still take hostile actions, but you will be warned."}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          disabled={!toId || tradeBlocked || supportBlocked || attackBlocked || espBlocked}
          onClick={() => {
            patchGame((g) => {
              const thr = sendThreadMessage(g, {
                fromId: me.id,
                toId,
                topic,
                attitude,
                systemId:
                  topic === "trade"
                    ? giveSystemId || requestSystemId
                    : systemId,
                neighborId: neighborId || undefined,
                aboutPlayerId,
                terms,
              });
              onSent(thr.id);
            });
          }}
        >
          Send via diplomat
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function TradeFields({
  state,
  give,
  request,
  giveSystemId,
  requestSystemId,
  giveDests,
  requestDests,
  giveLabel,
  requestLabel,
  onGive,
  onRequest,
  onGiveSys,
  onRequestSys,
}: {
  state: GameState;
  give: Resources;
  request: Resources;
  giveSystemId: string;
  requestSystemId: string;
  giveDests: string[];
  requestDests: string[];
  giveLabel: string;
  requestLabel: string;
  onGive: (r: Resources) => void;
  onRequest: (r: Resources) => void;
  onGiveSys: (id: string) => void;
  onRequestSys: (id: string) => void;
}) {
  return (
    <div className="mb-3 grid gap-3 sm:grid-cols-2">
      <div className="rounded-md bg-raised p-2 hairline">
        <div className="mb-1 text-[10px] uppercase tracking-wide text-faint">{giveLabel}</div>
        <ResRow value={give} onChange={onGive} />
        <select
          className="mt-2 w-full rounded-sm bg-inset px-2 py-2 text-sm"
          value={giveSystemId}
          onChange={(e) => onGiveSys(e.target.value)}
        >
          {giveDests.length === 0 && <option value="">No bordering destination</option>}
          {giveDests.map((id) => {
            const s = state.systems.find((x) => x.id === id);
            const owner = state.players.find((p) => p.id === s?.ownerId);
            return (
              <option key={id} value={id}>
                {s?.name}
                {owner ? ` (${owner.civ.name})` : " (unclaimed)"}
              </option>
            );
          })}
        </select>
      </div>
      <div className="rounded-md bg-raised p-2 hairline">
        <div className="mb-1 text-[10px] uppercase tracking-wide text-faint">{requestLabel}</div>
        <ResRow value={request} onChange={onRequest} />
        <select
          className="mt-2 w-full rounded-sm bg-inset px-2 py-2 text-sm"
          value={requestSystemId}
          onChange={(e) => onRequestSys(e.target.value)}
        >
          {requestDests.length === 0 && <option value="">No bordering destination</option>}
          {requestDests.map((id) => {
            const s = state.systems.find((x) => x.id === id);
            const owner = state.players.find((p) => p.id === s?.ownerId);
            return (
              <option key={id} value={id}>
                {s?.name}
                {owner ? ` (${owner.civ.name})` : " (unclaimed)"}
              </option>
            );
          })}
        </select>
      </div>
      <p className="text-[11px] leading-snug text-faint sm:col-span-2">
        Landings must be systems you do not own that border one you do — their world, or unclaimed
        space you both border. Unclaimed landings do not confer ownership; fleets may still contest
        the star.
      </p>
    </div>
  );
}

function ResRow({
  value,
  onChange,
}: {
  value: Resources;
  onChange: (r: Resources) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {(["tech", "metals", "chon"] as const).map((k) => (
        <label key={k} className="text-[10px] uppercase text-faint">
          {k}
          <input
            type="number"
            min={0}
            max={20}
            value={value[k]}
            onChange={(e) =>
              onChange({ ...value, [k]: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })
            }
            className="mt-0.5 h-9 w-full rounded-sm bg-inset px-2 text-sm tabular-nums text-fg"
          />
        </label>
      ))}
    </div>
  );
}

function Overlay({
  title,
  onClose,
  children,
  compact,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="pointer-events-none absolute inset-0 z-30 flex items-end p-3">
        <div className="pointer-events-auto w-full max-w-xl rounded-xl bg-surface p-4 hairline md:mx-auto">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl">{title}</h2>
            <button onClick={onClose} className="size-10 rounded-md hover:bg-raised" aria-label="Close">
              <X className="mx-auto size-4" />
            </button>
          </div>
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 z-30 grid place-items-end bg-bg/60 p-3 backdrop-blur-[2px] md:place-items-center">
      <div className="max-h-[92%] w-full max-w-4xl overflow-y-auto rounded-xl bg-surface p-5 hairline">
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-faint">
      {label}
      <div className="mt-1 text-sm font-normal normal-case tracking-normal text-fg">{children}</div>
    </label>
  );
}
