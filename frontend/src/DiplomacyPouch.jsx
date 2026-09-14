import React, { useMemo, useState } from 'react';

// Templated diplomacy pouch — ported from ui-reference/diplomacy-modal.tsx.
// No free-text chat: every dispatch is a structured, templated offer. Trade
// offers always show goods GIVEN and RECEIVED with Accept / Decline / Counter.
// The sealed TypeScript kernel remains the authority on legality; this UI only
// proposes candidate systems and the server validates every op.

const TOPICS = [
  { id: 'trade', label: 'Trade resources' },
  { id: 'alliance', label: 'Providing alliance' },
  { id: 'attack', label: 'Attacking a solar system' },
  { id: 'support', label: 'Providing support' },
  { id: 'espionage', label: 'Providing espionage' },
  { id: 'intelligence', label: 'Providing intelligence' },
];

const ATTITUDES = [
  { id: 'neutral', label: 'Neutral' },
  { id: 'polite', label: 'Polite' },
  { id: 'apologetic', label: 'Apologetic' },
  { id: 'aggressive', label: 'Aggressive' },
  { id: 'belligerent', label: 'Belligerent' },
];

const ATTACK_INTENTS = [
  { id: 'i-attack', label: 'I will attack this system' },
  { id: 'vacate', label: 'Withdraw from this system' },
  { id: 'you-attack', label: 'You attack this system' },
  { id: 'you-take', label: 'I leave; you may take it' },
];

const SUPPORT_INTENTS = [
  { id: 'support-me', label: 'Support my movement into this system' },
  { id: 'i-support-you', label: 'I will support your movement' },
];

const ESPIONAGE_KINDS = [
  { id: 'sabotage', label: 'Sabotage' },
  { id: 'destabilize', label: 'Destabilize government' },
  { id: 'fake', label: 'Fake a dispatch' },
  { id: 'intercept', label: 'Intercept correspondence' },
];

const RES_KEYS = ['tech', 'metals', 'chon'];
const ZERO = { tech: 0, metals: 0, chon: 0 };

function resNonzero(r) {
  return !!r && RES_KEYS.some((k) => (r[k] || 0) > 0);
}

function formatRes(r) {
  if (!resNonzero(r)) return 'nothing';
  return RES_KEYS.filter((k) => (r[k] || 0) > 0)
    .map((k) => `${r[k]} ${k === 'chon' ? 'CHON' : k === 'tech' ? 'Tech' : 'Metals'}`)
    .join(', ');
}

export default function DiplomacyPouch({ apiBase, gameId, me, gameState, playersMeta, onClose, reload }) {
  const kernel = gameState?.kernel || {};
  const systems = gameState?.systems || {};
  const kplayers = kernel.players || [];
  const alliances = kernel.alliances || [];
  const threads = kernel.threads || [];

  const nameOf = (pid) => {
    const kp = kplayers.find((p) => p.id === pid);
    if (kp) return kp.civ?.name || kp.name || pid;
    const meta = (playersMeta || []).find((p) => p.id === pid);
    return meta?.name || pid;
  };

  const areAllied = (a, b) =>
    alliances.some((al) => (al.a === a && al.b === b) || (al.a === b && al.b === a));

  const others = kplayers.filter((p) => p.id !== me && !p.collapsed);

  const unreadForPeer = (pid) =>
    threads
      .filter((t) => t.participants.includes(pid))
      .reduce(
        (n, t) => n + t.messages.filter((m) => m.toPlayerId === me && !m.read).length,
        0,
      );

  const firstUnread = others.find((p) => unreadForPeer(p.id) > 0)?.id;
  const [peer, setPeer] = useState(firstUnread || others[0]?.id || '');
  const [compose, setCompose] = useState(false);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const post = async (path, body) => {
    setErr(null);
    setBusy(true);
    try {
      const resp = await fetch(`${apiBase}/api/game/${gameId}/diplomacy/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: me, ...body }),
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e.detail || 'Diplomatic action failed');
      }
      await reload();
      return true;
    } catch (e) {
      setErr(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const peerThreads = threads.filter((t) => t.participants.includes(peer));

  return (
    <div className="diplo-overlay" data-testid="diplomacy-overlay" role="dialog" aria-modal="true">
      <div className="diplo-modal">
        <div className="diplo-header">
          <h2>Diplomatic Pouch</h2>
          <button className="diplo-close" data-testid="diplomacy-close-btn" onClick={onClose}>✕</button>
        </div>
        {err && <div className="diplo-error" data-testid="diplomacy-error">{err}</div>}
        <div className="diplo-body">
          <aside className="diplo-peers">
            {others.length === 0 && <p className="diplo-muted">No known powers to treat with yet.</p>}
            {others.map((p) => {
              const unread = unreadForPeer(p.id);
              const allied = areAllied(me, p.id);
              const n = threads.filter((t) => t.participants.includes(p.id)).length;
              return (
                <button
                  key={p.id}
                  data-testid={`diplomacy-peer-${p.id}`}
                  className={`diplo-peer ${peer === p.id ? 'active' : ''}`}
                  onClick={() => { setPeer(p.id); setCompose(false); }}
                >
                  <div className="diplo-peer-name">
                    {nameOf(p.id)}
                    {allied && <span className="diplo-badge-allied">Allied</span>}
                  </div>
                  <div className="diplo-peer-meta">
                    {n} thread{n === 1 ? '' : 's'}{unread ? ` · ${unread} unread` : ''}
                  </div>
                </button>
              );
            })}
            <button
              className="diplo-new-btn"
              data-testid="diplomacy-new-dispatch-btn"
              disabled={!peer}
              onClick={() => setCompose(true)}
            >
              + New dispatch
            </button>
            {peer && areAllied(me, peer) && (
              <button
                className="diplo-denounce-btn"
                data-testid="diplomacy-denounce-btn"
                disabled={busy}
                onClick={() => post('denounce', { to_id: peer })}
              >
                End the alliance
              </button>
            )}
          </aside>

          <div className="diplo-main">
            {!peer ? (
              <p className="diplo-muted">Select a power on the left.</p>
            ) : compose ? (
              <ComposeForm
                me={me}
                peer={peer}
                systems={systems}
                nameOf={nameOf}
                allied={areAllied(me, peer)}
                busy={busy}
                onCancel={() => setCompose(false)}
                onSend={async (payload) => {
                  const ok = await post('send', { to_id: peer, ...payload });
                  if (ok) setCompose(false);
                }}
              />
            ) : (
              <ThreadList
                me={me}
                peerName={nameOf(peer)}
                threads={peerThreads}
                systems={systems}
                busy={busy}
                onAccept={(mid) => post('accept', { message_id: mid })}
                onDecline={(mid) => post('decline', { message_id: mid })}
                onCounter={(mid, terms) => post('counter', { message_id: mid, terms })}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TermsView({ msg, me, systems }) {
  const terms = msg.terms || {};
  const mine = msg.fromPlayerId === me;
  // give = the offerer promises this; request = the offerer asks recipient for it.
  const youReceive = mine ? terms.request : terms.give;
  const youGive = mine ? terms.give : terms.request;
  const sysName = (id) => (id && systems[id] ? systems[id].name : null);
  const landReceive = mine ? terms.requestSystemId : terms.giveSystemId;
  const landGive = mine ? terms.giveSystemId : terms.requestSystemId;
  const hasTrade = resNonzero(youReceive) || resNonzero(youGive);
  const closed = ['accepted', 'declined', 'countered'].includes(msg.status);
  const intentLine = terms.intent || terms.espionageKind || terms.allianceClause
    ? [
        terms.allianceClause === 'form' ? 'Form a mutual alliance on accept' : null,
        terms.allianceClause === 'break' ? 'Dissolve the alliance on accept' : null,
        terms.espionageKind ? `Espionage: ${terms.espionageKind}` : null,
        terms.intent && !terms.espionageKind ? `Intent: ${terms.intent}` : null,
        terms.unless ? `Unless: ${terms.unless}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : null;

  if (!hasTrade && !intentLine) return null;

  return (
    <div className="diplo-terms" data-testid="diplomacy-terms">
      <div className="diplo-terms-title">
        {closed ? `Offer ${msg.status}` : mine ? 'Terms you proposed' : 'If you accept this offer'}
      </div>
      {resNonzero(youReceive) && (
        <div className="diplo-terms-row">
          <span className="diplo-recv" data-testid="diplomacy-you-receive">You receive</span>
          <span className="diplo-terms-val">
            {formatRes(youReceive)}{sysName(landReceive) ? ` — lands at ${sysName(landReceive)}` : ''}
          </span>
        </div>
      )}
      {resNonzero(youGive) && (
        <div className="diplo-terms-row">
          <span className="diplo-give" data-testid="diplomacy-you-give">You give</span>
          <span className="diplo-terms-val">
            {formatRes(youGive)}{sysName(landGive) ? ` — lands at ${sysName(landGive)}` : ''}
          </span>
        </div>
      )}
      {intentLine && <div className="diplo-terms-intent">{intentLine}</div>}
    </div>
  );
}

function ThreadList({ me, peerName, threads, systems, busy, onAccept, onDecline, onCounter }) {
  const [openId, setOpenId] = useState(threads[0]?.id || null);
  const [counterFor, setCounterFor] = useState(null);

  if (threads.length === 0) {
    return <p className="diplo-muted">No correspondence with {peerName} yet. Send a new dispatch.</p>;
  }
  return (
    <div className="diplo-threads">
      {threads.map((t) => {
        const last = t.messages[t.messages.length - 1];
        const unread = t.messages.some((m) => m.toPlayerId === me && !m.read);
        const isOpen = openId === t.id;
        return (
          <div key={t.id} className="diplo-thread" data-testid={`diplomacy-thread-${t.id}`}>
            <button className="diplo-thread-head" onClick={() => setOpenId(isOpen ? null : t.id)}>
              <span className="diplo-topic">{t.topic}</span>
              <span className="diplo-thread-meta">
                Turn {last.turn} · {t.messages.length} msg{t.messages.length === 1 ? '' : 's'}
              </span>
              {unread && <span className="diplo-badge-unread">Unread</span>}
            </button>
            {isOpen && (
              <div className="diplo-messages">
                {t.messages.map((m, i) => {
                  const actionable =
                    i === t.messages.length - 1 && m.toPlayerId === me && m.status === 'open';
                  return (
                    <article key={m.id} className="diplo-msg">
                      <div className="diplo-msg-status">
                        {m.status && <span className={`diplo-status-${m.status}`}>{m.status}</span>}
                      </div>
                      <p className="diplo-msg-text">{m.text}</p>
                      <TermsView msg={m} me={me} systems={systems} />
                      {actionable && counterFor !== m.id && (
                        <div className="diplo-actions">
                          <button
                            className="diplo-accept"
                            data-testid={`diplomacy-accept-${m.id}`}
                            disabled={busy}
                            onClick={() => onAccept(m.id)}
                          >
                            Accept
                          </button>
                          <button
                            className="diplo-decline"
                            data-testid={`diplomacy-decline-${m.id}`}
                            disabled={busy}
                            onClick={() => onDecline(m.id)}
                          >
                            Decline
                          </button>
                          <button
                            className="diplo-counter"
                            data-testid={`diplomacy-counter-${m.id}`}
                            disabled={busy}
                            onClick={() => setCounterFor(m.id)}
                          >
                            Counter-offer
                          </button>
                        </div>
                      )}
                      {actionable && counterFor === m.id && (
                        <CounterForm
                          original={m}
                          systems={systems}
                          busy={busy}
                          onCancel={() => setCounterFor(null)}
                          onSend={(terms) => {
                            onCounter(m.id, terms);
                            setCounterFor(null);
                          }}
                        />
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ResRow({ value, onChange, testid }) {
  return (
    <div className="diplo-resrow">
      {RES_KEYS.map((k) => (
        <label key={k} className="diplo-reslabel">
          {k}
          <input
            type="number"
            min={0}
            max={20}
            value={value[k]}
            data-testid={`${testid}-${k}`}
            onChange={(e) =>
              onChange({ ...value, [k]: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })
            }
          />
        </label>
      ))}
    </div>
  );
}

function landingCandidates(systems, ownerId) {
  // Systems the owner does NOT own that border a system the owner DOES own,
  // and are visible to the viewer. Kernel validates the final legality.
  const owned = Object.values(systems).filter((s) => s.owner === ownerId);
  const ownedIds = new Set(owned.map((s) => s.id));
  const out = new Set();
  owned.forEach((s) => (s.connections || []).forEach((n) => {
    const ns = systems[n];
    if (ns && !ownedIds.has(n) && ns.visibility === 'full') out.add(n);
  }));
  return [...out].map((id) => systems[id]).filter(Boolean);
}

function visibleSystems(systems) {
  return Object.values(systems).filter((s) => s.visibility === 'full');
}

function CounterForm({ original, systems, busy, onCancel, onSend }) {
  const t = original.terms || {};
  // Counter mirrors the offer: what they asked becomes what you give, etc.
  const [give, setGive] = useState({ ...ZERO, ...(t.request || {}) });
  const [request, setRequest] = useState({ ...ZERO, ...(t.give || {}) });
  const [giveSystemId, setGiveSystemId] = useState(t.requestSystemId || '');
  const [requestSystemId, setRequestSystemId] = useState(t.giveSystemId || '');
  const allSys = visibleSystems(systems);

  return (
    <div className="diplo-counter-form" data-testid="diplomacy-counter-form">
      <div className="diplo-terms-title">Your counter</div>
      <div className="diplo-trade-grid">
        <div className="diplo-trade-col">
          <div className="diplo-terms-title">You send (lands at)</div>
          <ResRow value={give} onChange={setGive} testid="diplomacy-counter-give" />
          <select value={giveSystemId} onChange={(e) => setGiveSystemId(e.target.value)} data-testid="diplomacy-counter-give-sys">
            <option value="">— landing system —</option>
            {allSys.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="diplo-trade-col">
          <div className="diplo-terms-title">You ask in return (lands at)</div>
          <ResRow value={request} onChange={setRequest} testid="diplomacy-counter-request" />
          <select value={requestSystemId} onChange={(e) => setRequestSystemId(e.target.value)} data-testid="diplomacy-counter-request-sys">
            <option value="">— landing system —</option>
            {allSys.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <div className="diplo-actions">
        <button
          className="diplo-accept"
          data-testid="diplomacy-counter-send-btn"
          disabled={busy}
          onClick={() =>
            onSend({
              give,
              request,
              giveSystemId: resNonzero(give) ? giveSystemId : undefined,
              requestSystemId: resNonzero(request) ? requestSystemId : undefined,
              intent: original.terms?.intent,
            })
          }
        >
          Send counter
        </button>
        <button className="diplo-decline" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </div>
  );
}

function ComposeForm({ me, peer, systems, nameOf, allied, busy, onCancel, onSend }) {
  const [topic, setTopic] = useState('trade');
  const [attitude, setAttitude] = useState('neutral');
  const [give, setGive] = useState({ ...ZERO });
  const [request, setRequest] = useState({ tech: 0, metals: 0, chon: 1 });
  const myDests = useMemo(() => landingCandidates(systems, me), [systems, me]);
  const theirDests = useMemo(() => landingCandidates(systems, peer), [systems, peer]);
  const allSys = useMemo(() => visibleSystems(systems), [systems]);
  const [giveSystemId, setGiveSystemId] = useState('');
  const [requestSystemId, setRequestSystemId] = useState('');
  const [systemId, setSystemId] = useState('');
  const [neighborId, setNeighborId] = useState('');
  const [intent, setIntent] = useState('i-attack');
  const [espionageKind, setEspionageKind] = useState('sabotage');
  const [unless, setUnless] = useState('');
  const [attachTrade, setAttachTrade] = useState(false);
  const [attachAlliance, setAttachAlliance] = useState(false);

  const neighbors = useMemo(() => {
    const s = systems[systemId];
    return (s?.connections || []).map((id) => systems[id]).filter(Boolean);
  }, [systems, systemId]);

  const buildTerms = () => {
    const terms = {};
    if (topic === 'alliance') {
      terms.allianceClause = allied ? 'break' : 'form';
      terms.intent = 'with-you';
      terms.aboutPlayerId = peer;
    } else if (attachAlliance) {
      terms.allianceClause = allied ? 'break' : 'form';
      terms.intent = 'with-you';
    }
    const wantTrade = topic === 'trade' || attachTrade;
    if (wantTrade) {
      terms.give = give;
      terms.request = request;
      if (resNonzero(give) && giveSystemId) terms.giveSystemId = giveSystemId;
      if (resNonzero(request) && requestSystemId) terms.requestSystemId = requestSystemId;
    }
    if (topic === 'attack' || topic === 'support') {
      terms.intent = intent;
      if (unless.trim()) terms.unless = unless.trim();
    }
    if (topic === 'espionage') {
      terms.espionageKind = espionageKind;
      terms.intent = espionageKind;
      if (unless.trim()) terms.unless = unless.trim();
    }
    if (topic === 'intelligence') {
      terms.aboutPlayerId = peer;
      if (unless.trim()) terms.unless = unless.trim();
    }
    return terms;
  };

  const submit = () => {
    const payload = {
      topic,
      attitude,
      terms: buildTerms(),
    };
    if (topic === 'trade') {
      payload.system_id = giveSystemId || requestSystemId || undefined;
    } else if (systemId) {
      payload.system_id = systemId;
    }
    if (neighborId) payload.neighbor_id = neighborId;
    if (topic === 'intelligence' || topic === 'alliance') payload.about_player_id = peer;
    onSend(payload);
  };

  const showTrade = topic === 'trade' || attachTrade;
  const showSystem = topic === 'attack' || topic === 'support' || topic === 'espionage';
  const tradeInvalid =
    showTrade &&
    ((resNonzero(give) && !giveSystemId) ||
      (resNonzero(request) && !requestSystemId) ||
      (topic === 'trade' && !resNonzero(give) && !resNonzero(request)));

  return (
    <div className="diplo-compose" data-testid="diplomacy-compose-form">
      <h3>New dispatch to {nameOf(peer)}</h3>
      <label className="diplo-field">
        Topic
        <select value={topic} onChange={(e) => setTopic(e.target.value)} data-testid="diplomacy-compose-topic">
          {TOPICS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </label>
      <label className="diplo-field">
        Attitude
        <select value={attitude} onChange={(e) => setAttitude(e.target.value)} data-testid="diplomacy-compose-attitude">
          {ATTITUDES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      </label>

      {topic !== 'alliance' && (
        <label className="diplo-check">
          <input type="checkbox" checked={attachAlliance} data-testid="diplomacy-compose-attach-alliance"
            onChange={(e) => setAttachAlliance(e.target.checked)} />
          <span>{allied ? 'Bundle: dissolve our alliance if accepted.' : 'Bundle: form a mutual alliance if accepted.'}</span>
        </label>
      )}
      {topic !== 'trade' && (
        <label className="diplo-check">
          <input type="checkbox" checked={attachTrade} data-testid="diplomacy-compose-attach-trade"
            onChange={(e) => setAttachTrade(e.target.checked)} />
          <span>Bundle a resource exchange.</span>
        </label>
      )}

      {showTrade && (
        <div className="diplo-trade-grid">
          <div className="diplo-trade-col">
            <div className="diplo-terms-title">You send them (lands at)</div>
            <ResRow value={give} onChange={setGive} testid="diplomacy-compose-give" />
            <select value={giveSystemId} onChange={(e) => setGiveSystemId(e.target.value)} data-testid="diplomacy-compose-give-sys">
              <option value="">— landing system —</option>
              {myDests.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {myDests.length === 0 && (
              <div className="diplo-land-hint">No system of yours borders open space in sensor range — you cannot land goods here.</div>
            )}
          </div>
          <div className="diplo-trade-col">
            <div className="diplo-terms-title">You ask in return (lands at)</div>
            <ResRow value={request} onChange={setRequest} testid="diplomacy-compose-request" />
            <select value={requestSystemId} onChange={(e) => setRequestSystemId(e.target.value)} data-testid="diplomacy-compose-request-sys">
              <option value="">— landing system —</option>
              {theirDests.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {theirDests.length === 0 && (
              <div className="diplo-land-hint">You cannot see a landing bordering this power — you may only offer to give, not to request, until you scout their borders.</div>
            )}
          </div>
        </div>
      )}

      {showSystem && (
        <>
          <label className="diplo-field">
            System
            <select value={systemId} onChange={(e) => setSystemId(e.target.value)} data-testid="diplomacy-compose-system">
              <option value="">— select a system —</option>
              {allSys.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="diplo-field">
            {topic === 'support' ? 'Support fires from (adjacent)' : 'From / via (adjacent)'}
            <select value={neighborId} onChange={(e) => setNeighborId(e.target.value)} data-testid="diplomacy-compose-neighbor">
              <option value="">Unspecified</option>
              {neighbors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        </>
      )}

      {topic === 'attack' && (
        <label className="diplo-field">
          What you are proposing
          <select value={intent} onChange={(e) => setIntent(e.target.value)} data-testid="diplomacy-compose-intent">
            {ATTACK_INTENTS.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
          </select>
        </label>
      )}
      {topic === 'support' && (
        <label className="diplo-field">
          What you are proposing
          <select value={intent} onChange={(e) => setIntent(e.target.value)} data-testid="diplomacy-compose-intent">
            {SUPPORT_INTENTS.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
          </select>
        </label>
      )}
      {topic === 'espionage' && (
        <label className="diplo-field">
          Operation
          <select value={espionageKind} onChange={(e) => setEspionageKind(e.target.value)} data-testid="diplomacy-compose-espionage">
            {ESPIONAGE_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </label>
      )}

      {(attitude === 'belligerent' || attitude === 'aggressive') && (
        <label className="diplo-field">
          Condition ("unless you…") — optional
          <input value={unless} maxLength={80} onChange={(e) => setUnless(e.target.value)}
            placeholder="withdraw from the named system" data-testid="diplomacy-compose-unless" />
        </label>
      )}

      <div className="diplo-actions">
        <button className="diplo-accept" data-testid="diplomacy-compose-send-btn" disabled={busy || tradeInvalid} onClick={submit}>
          Send via diplomat
        </button>
        <button className="diplo-decline" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </div>
  );
}
