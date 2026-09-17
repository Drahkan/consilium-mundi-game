import React from 'react';

// System details / selected-system dock. Extracted from App.js for the
// kernel v5 hosting slim-down. Kernel field names preserved verbatim
// (systems / visibility / owner / has_owner / has_upgrades /
// starfleet_details / rally_point / is_home_system).
//
// All state is App-local — every helper is passed as a prop.

export default function SystemDetailsPanel({
  gameState,
  currentPlayer,
  selectedSystem,
  selectedStarfleet,
  setSelectedStarfleet,
  starfleetOrders,
  pendingRally,
  setPendingRally,
  getPlayerName,
  setStarfleetRally,
  showBuildPanel,
  setShowBuildPanel,
}) {
    if (!selectedSystem || !gameState) return null;

    const system = gameState.systems[selectedSystem];
    if (!system) return null;

    const vis = system.visibility || 'full';

    if (vis === 'hidden') {
      return (
        <div className="system-details" data-testid="system-details">
          <h3 style={{ fontStyle: 'italic', color: '#94a3b8' }}>Unknown Space</h3>
          <div className="system-info">
            <p style={{ color: '#94a3b8' }}>
              Your scanners cannot penetrate this region of the galaxy. Move a starfleet or capture a neighbouring system to reveal what lies here.
            </p>
            <p style={{ fontSize: 12, color: '#64748b' }}>Connections: {system.connections?.length || 0}</p>
          </div>
        </div>
      );
    }

    if (vis === 'partial') {
      return (
        <div className="system-details" data-testid="system-details">
          <h3>{system.name} <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>(long-range scan)</span></h3>
          <div className="system-info">
            <p><strong>Owner:</strong> {system.has_owner ? 'Claimed by a rival' : 'Uncontrolled'}</p>
            <p><strong>Upgrades:</strong> {system.has_upgrades ? 'One or more (details unknown)' : 'None detected'}</p>
            <p style={{ color: '#94a3b8', fontStyle: 'italic', marginTop: 8 }}>
              Fleet strength, resources and specific upgrades cannot be resolved at this range.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="system-details" data-testid="system-details">
        <h3>{system.name}</h3>
        <div className="system-info">
          <p><strong>Owner:</strong> {
            system.owner
              ? getPlayerName(system.owner)
              : 'Uncontrolled'
          }</p>
          <p><strong>Resources per turn:</strong></p>
          <ul>
            <li>Tech: {system.resources?.tech ?? 0}</li>
            <li>Metals: {system.resources?.metals ?? 0}</li>
            <li>CHON: {system.resources?.chon ?? 0}</li>
          </ul>
          <p><strong>Starfleets:</strong> {system.starfleets}</p>
          <p><strong>Upgrades:</strong> {system.upgrades.join(', ') || 'None'}</p>
          {system.is_home_system && <p className="home-system-badge">Home System</p>}
          
          {/* Show starfleet details */}
          {system.starfleet_details && system.starfleet_details.length > 0 && (
            <div className="starfleet-section">
              <h4>Starfleets:</h4>
              {system.starfleet_details.map(starfleet => {
                const ownedByMe = starfleet.owner === currentPlayer;
                // Options for rally point: all systems the current player owns
                const ownedSystems = ownedByMe
                  ? Object.values(gameState.systems).filter(s => s.owner === currentPlayer)
                  : [];
                return (
                  <div
                    key={starfleet.id}
                    className={`starfleet-item ${selectedStarfleet === starfleet.id ? 'selected' : ''}`}
                    onClick={() => setSelectedStarfleet(starfleet.id)}
                  >
                    {starfleet.orders && (
                      <p><strong>Orders:</strong> {starfleet.orders.type}</p>
                    )}
                    {starfleetOrders[starfleet.id] && (
                      <p className="pending-order">
                        <strong>Pending:</strong> {starfleetOrders[starfleet.id].order_type}
                      </p>
                    )}
                    {ownedByMe && (() => {
                      // Staged rally selection. Matches the movement
                      // UX tone: pick a target, see a ghost preview
                      // on the map, commit with a Set button (or
                      // reset back to the currently-saved value).
                      const committed = starfleet.rally_point || '';
                      const raw = pendingRally[starfleet.id];
                      // Normalize 'CLEAR' -> '' so both dropdown value
                      // and diff-check share the same domain.
                      const staged = raw === undefined ? committed : (raw === 'CLEAR' ? '' : raw);
                      const isDirty = staged !== committed;
                      const commit = () => {
                        const next = staged === '' ? null : staged;
                        setPendingRally(prev => {
                          const copy = { ...prev };
                          delete copy[starfleet.id];
                          return copy;
                        });
                        setStarfleetRally(starfleet.id, next);
                      };
                      const reset = () => {
                        setPendingRally(prev => {
                          const copy = { ...prev };
                          delete copy[starfleet.id];
                          return copy;
                        });
                      };
                      return (
                        <div
                          style={{ marginTop: 8 }}
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`rally-row-${starfleet.id}`}
                        >
                          <label style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
                            Rally point (on retreat)
                          </label>
                          <select
                            value={staged}
                            onChange={(e) => setPendingRally(prev => ({
                              ...prev,
                              [starfleet.id]: e.target.value === '' ? 'CLEAR' : e.target.value,
                            }))}
                            className="player-name-input"
                            style={{ marginTop: 4, fontSize: 12 }}
                            data-testid={`rally-select-${starfleet.id}`}
                          >
                            <option value="">— None (stay put) —</option>
                            {ownedSystems.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                          {isDirty && (
                            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                              <button
                                onClick={commit}
                                className="rally-set-btn"
                                data-testid={`rally-set-${starfleet.id}`}
                              >
                                Set Rally
                              </button>
                              <button
                                onClick={reset}
                                className="rally-reset-btn"
                                data-testid={`rally-reset-${starfleet.id}`}
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Build controls for owned systems */}
          {system.owner === currentPlayer && (
            <div className="build-controls">
              <button 
                onClick={() => setShowBuildPanel(!showBuildPanel)}
                className="build-toggle-btn"
              >
                {showBuildPanel ? 'Hide Building' : 'Show Building'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
}
