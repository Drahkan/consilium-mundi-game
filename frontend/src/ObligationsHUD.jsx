import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

// Ported from ui-reference/play-screen.tsx (IncidentDialog + unsent-pact banner)
// per ui-reference/OBLIGATIONS.md.
//
// Pull-based: after each state fetch we poll the kernel inbox for the current
// player. `inbox.owedDeliveries` is the source of truth for the unsent-pact
// banner — the kernel already resolved which half of the pact this viewer
// owes (`{ pactId, resources, systemId, otherId }`). If there is an open
// incident we surface a modal (answerIncident).
//
// We also emit `onInbox(inbox)` so App.js can render the shared-sight chip
// from `inbox.allyIds` per ui-reference/SHARED_SIGHT.md.

const RES_LABEL = { tech: 'Tech', metals: 'Metals', chon: 'CHON' };

function formatRes(r) {
  if (!r) return 'nothing';
  const parts = ['tech', 'metals', 'chon']
    .filter((k) => (r[k] || 0) > 0)
    .map((k) => `${r[k]} ${RES_LABEL[k]}`);
  return parts.length ? parts.join(', ') : 'nothing';
}

function nonEmptyResources(r) {
  return !!r && (['tech', 'metals', 'chon'].some((k) => (r[k] || 0) > 0));
}

export default function ObligationsHUD({ apiBase, gameId, me, gameState, reload, onInbox, pollMs = 8000 }) {
  const [inbox, setInbox] = useState({
    pending: [],
    incidents: [],
    unsentPacts: [],
    owedDeliveries: [],
    allyIds: [],
  });
  const [openIncidentId, setOpenIncidentId] = useState(null);
  const [deferred, setDeferred] = useState([]);
  const [busy, setBusy] = useState(false);
  const [unless, setUnless] = useState('withdraw from the contested system');

  const systems = gameState?.systems || {};
  const kplayers = gameState?.kernel?.players || [];
  const nameOf = (pid) => kplayers.find((p) => p.id === pid)?.civ?.name || pid;

  const refresh = useCallback(async () => {
    if (!apiBase || !gameId || !me) return;
    try {
      const r = await fetch(`${apiBase}/api/game/${gameId}/diplomacy/inbox/${encodeURIComponent(me)}`);
      if (!r.ok) return;
      const d = await r.json();
      const normalized = {
        pending: d.pending || [],
        incidents: d.incidents || [],
        unsentPacts: d.unsentPacts || [],
        owedDeliveries: d.owedDeliveries || [],
        allyIds: d.allyIds || [],
      };
      setInbox(normalized);
      if (onInbox) onInbox(normalized);
    } catch (_) {
      /* transient */
    }
  }, [apiBase, gameId, me, onInbox]);

  useEffect(() => { refresh(); }, [refresh, gameState?.turn, gameState?.phase]);
  useEffect(() => {
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs]);

  // Auto-surface the first non-deferred incident.
  useEffect(() => {
    if (openIncidentId) return;
    const next = (inbox.incidents || []).find((i) => !deferred.includes(i.id) && (i.status ?? 'open') === 'open');
    if (next) setOpenIncidentId(next.id);
  }, [inbox.incidents, openIncidentId, deferred]);

  const post = async (action, body) => {
    setBusy(true);
    try {
      const r = await fetch(`${apiBase}/api/game/${gameId}/diplomacy/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: me, ...body }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        const detail = err?.detail || err?.error || `Diplomacy op failed (${r.status})`;
        toast.error(String(detail));
      }
      await refresh();
      if (reload) await reload();
    } finally {
      setBusy(false);
    }
  };

  const answerIncident = (action, extra = {}) =>
    post('answer-incident', { incident_id: openIncidentId, action, ...extra }).then(() => {
      setOpenIncidentId(null);
    });

  const openInc = (inbox.incidents || []).find((i) => i.id === openIncidentId);
  // Kernel v3: `owedDeliveries` already contains only what this viewer owes.
  // Each item is { pactId, resources, systemId, otherId }.
  const owed = (inbox.owedDeliveries || []).filter((d) => nonEmptyResources(d.resources));

  return (
    <>
      {owed.length > 0 && (
        <div className="obligations-banner-wrap" data-testid="unsent-pact-banner">
          {owed.map((d) => {
            const dest = systems[d.systemId]?.name || 'the named system';
            return (
              <div key={d.pactId} className="obligations-pact-row" data-testid={`unsent-pact-row-${d.pactId}`}>
                <span>
                  You promised {formatRes(d.resources)} to <b>{dest}</b>. Accepting did not send it.
                </span>
                <button
                  data-testid={`unsent-pact-deliver-${d.pactId}`}
                  disabled={busy}
                  onClick={() => post('deliver-pact', { pact_id: d.pactId })}
                >
                  Schedule delivery
                </button>
              </div>
            );
          })}
        </div>
      )}

      {openInc && (
        <div className="obligations-modal-scrim" data-testid="incident-modal">
          <div className="obligations-modal">
            <div className="obligations-modal-eyebrow">Allied incident</div>
            <h2>{nameOf(openInc.actorId) || 'An ally'}</h2>
            <p className="obligations-modal-body">{openInc.text}</p>
            <p className="obligations-modal-note">
              This does not break the alliance on its own. Ignore it, send a message dissolving the
              compact, or threaten to dissolve it unless they do something specific.
            </p>
            <div className="obligations-modal-actions">
              <button
                data-testid="incident-ignore"
                disabled={busy}
                onClick={() => answerIncident('ignored')}
              >
                Ignore — keep the alliance
              </button>
              <button
                data-testid="incident-break"
                disabled={busy}
                onClick={() => answerIncident('broke')}
              >
                Send a message breaking the alliance
              </button>
              <label className="obligations-modal-unless">
                Threaten unless they…
                <input
                  data-testid="incident-unless-input"
                  value={unless}
                  onChange={(e) => setUnless(e.target.value)}
                  maxLength={80}
                  placeholder="send 2 CHON to my border"
                />
              </label>
              <button
                data-testid="incident-threaten"
                disabled={busy}
                onClick={() => answerIncident('threatened', { unless: unless.trim() || 'make amends for this slight' })}
              >
                Threaten to break unless they do that
              </button>
              <button
                data-testid="incident-defer"
                disabled={busy}
                onClick={() => {
                  setDeferred((d) => [...d, openInc.id]);
                  setOpenIncidentId(null);
                }}
              >
                Decide later
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
