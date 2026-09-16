import React from 'react';

// Galaxy map. Extracted from App.js::renderGalaxyMap for Grok's App.js split.
// Kernel v4. Receives every piece of state it needs as props — no App-local
// closures. Kernel field names are preserved verbatim (systems / owner /
// starfleet_details / visibility / has_owner / has_upgrades / rally_point /
// order_type / support_target).

export default function MapCanvas({
  gameState,
  currentPlayer,
  starfleetOrders,
  pendingRally,
  mapPan,
  mapZoom,
  selectedStarfleet,
  selectedSystem,
  getPlayerColor,
  handleMapMouseDown,
  handleMapMouseMove,
  handleMapMouseUp,
  handleMapWheel,
  handleSystemClick,
  handleSystemDoubleClick,
  handleStarfleetClick,
}) {
    if (!gameState || !gameState.systems) return null;

    const systems = Object.values(gameState.systems);

    // Build a lookup: starfleet_id → source system, and a list of current
    // player's pending orders with resolved source/target coordinates so we
    // can overlay Move / Support arrows on the map.
    const starfleetSystemLookup = {};
    systems.forEach(sys => {
      (sys.starfleet_details || []).forEach(sf => {
        starfleetSystemLookup[sf.id] = sys;
      });
    });
    const pendingOrderArrows = Object.values(starfleetOrders || {}).map(order => {
      const src = starfleetSystemLookup[order.starfleet_id];
      const targetId = order.order_type === 'support' ? order.support_target : order.target_system;
      const dst = targetId ? gameState.systems[targetId] : null;
      if (!src || !dst) return null;
      return { order, src, dst };
    }).filter(Boolean);

    // Rally-point overlays. Only draw for the current player's own
    // fleets — even though the API only returns rally_point on FULL
    // visibility, we scope by owner defensively so a shared-sight /
    // spectator view can never leak someone else's retreat plan.
    // Each entry: { fleet, src (fleet's system), dst (rally system) }.
    // We also compute a parallel "ghost" list from `pendingRally` so
    // the player sees where they'll rally BEFORE they click Set.
    const rallyLinks = [];
    const ghostRallyLinks = [];
    systems.forEach(sys => {
      (sys.starfleet_details || []).forEach(sf => {
        if (sf.owner !== currentPlayer) return;
        // Committed rally
        if (sf.rally_point) {
          const dst = gameState.systems[sf.rally_point];
          if (dst && dst.id !== sys.id) {
            rallyLinks.push({ fleet: sf, src: sys, dst });
          }
        }
        // Pending rally (may differ from committed)
        const raw = pendingRally[sf.id];
        if (raw !== undefined) {
          const pendingTarget = raw === 'CLEAR' ? '' : raw;
          const currentTarget = sf.rally_point || '';
          if (pendingTarget !== currentTarget && pendingTarget) {
            const dst = gameState.systems[pendingTarget];
            if (dst && dst.id !== sys.id) {
              ghostRallyLinks.push({ fleet: sf, src: sys, dst });
            }
          }
        }
      });
    });
    // De-duplicate the "R" marker: if a player has multiple fleets
    // rallying to the same system we still only draw one flag on it.
    const rallySystemIds = new Set(rallyLinks.map(l => l.dst.id));
    const ghostRallySystemIds = new Set(ghostRallyLinks.map(l => l.dst.id));
    
    return (
      <div className="galaxy-container">
        <svg 
          className="galaxy-map" 
          viewBox="0 0 800 600"
          preserveAspectRatio="xMidYMid meet"
          onWheel={handleMapWheel}
          onMouseDown={handleMapMouseDown}
          onMouseMove={handleMapMouseMove}
          onMouseUp={handleMapMouseUp}
          onMouseLeave={handleMapMouseUp}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          {/* Background */}
          <defs>
            <radialGradient id="spaceGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1a202c" />
              <stop offset="100%" stopColor="#0f0f23" />
            </radialGradient>
            <marker id="arrow-move" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#fbbf24" />
            </marker>
            <marker id="arrow-support" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
            </marker>
          </defs>
          <rect width="800" height="600" fill="url(#spaceGradient)" />
          
          {/* Main map group with zoom and pan transforms */}
          <g transform={`translate(${mapPan.x}, ${mapPan.y}) scale(${mapZoom})`}>
            {/* Draw connections first. Key is normalized to the
                sorted pair so mutual connections (A→B and B→A) don't
                trigger React's duplicate-key warning. */}
            {systems.map(system => 
              system.connections.map(connId => {
                const connSystem = gameState.systems[connId];
                if (!connSystem) return null;
                const [a, b] = [system.id, connId].sort();
                
                return (
                  <line
                    key={`conn-${a}-${b}`}
                    x1={system.x}
                    y1={system.y}
                    x2={connSystem.x}
                    y2={connSystem.y}
                    stroke="#4a5568"
                    strokeWidth="1"
                    opacity="0.6"
                  />
                );
              })
            )}
            
            {/* Rally-point overlay: thin dashed line from each of the
                current player's fleets to its rally system, plus a
                small "R" flag on the rally system. Rendered under the
                move/support arrows and under the system nodes so it
                never intercepts clicks. */}
            {rallyLinks.map(({ fleet, src, dst }, idx) => {
              const color = getPlayerColor(currentPlayer);
              const dx = dst.x - src.x;
              const dy = dst.y - src.y;
              const len = Math.max(1, Math.sqrt(dx*dx + dy*dy));
              const shrink = 10;
              const tx = dst.x - (dx / len) * shrink;
              const ty = dst.y - (dy / len) * shrink;
              const sx = src.x + (dx / len) * shrink;
              const sy = src.y + (dy / len) * shrink;
              return (
                <line
                  key={`rally-line-${fleet.id}-${idx}`}
                  x1={sx}
                  y1={sy}
                  x2={tx}
                  y2={ty}
                  stroke={color}
                  strokeWidth="1"
                  strokeDasharray="2 4"
                  opacity="0.55"
                  pointerEvents="none"
                />
              );
            })}
            {Array.from(rallySystemIds).map(sid => {
              const sys = gameState.systems[sid];
              if (!sys) return null;
              const color = getPlayerColor(currentPlayer);
              // Offset the flag up-and-right so it doesn't collide
              // with the resource label (below) or system name (above).
              const fx = sys.x + 14;
              const fy = sys.y - 4;
              return (
                <g key={`rally-flag-${sid}`} pointerEvents="none" data-testid={`rally-flag-${sid}`}>
                  {/* Flag pole */}
                  <line x1={fx} y1={fy + 8} x2={fx} y2={fy - 8} stroke={color} strokeWidth="1" />
                  {/* Flag banner */}
                  <polygon
                    points={`${fx},${fy - 8} ${fx + 8},${fy - 5} ${fx},${fy - 2}`}
                    fill={color}
                    stroke="#0f0f23"
                    strokeWidth="0.5"
                  />
                  <text
                    x={fx + 3}
                    y={fy - 4}
                    fontSize="6"
                    fontWeight="bold"
                    fill="#0f0f23"
                  >
                    R
                  </text>
                </g>
              );
            })}

            {/* Ghost rally overlay — pending selections not yet
                committed. Rendered translucent + with a dashed banner
                outline so it's clearly distinguishable from a real
                (committed) rally flag on the same map. */}
            {ghostRallyLinks.map(({ fleet, src, dst }, idx) => {
              const color = getPlayerColor(currentPlayer);
              const dx = dst.x - src.x;
              const dy = dst.y - src.y;
              const len = Math.max(1, Math.sqrt(dx*dx + dy*dy));
              const shrink = 10;
              const tx = dst.x - (dx / len) * shrink;
              const ty = dst.y - (dy / len) * shrink;
              const sx = src.x + (dx / len) * shrink;
              const sy = src.y + (dy / len) * shrink;
              return (
                <line
                  key={`ghost-rally-line-${fleet.id}-${idx}`}
                  x1={sx}
                  y1={sy}
                  x2={tx}
                  y2={ty}
                  stroke={color}
                  strokeWidth="1"
                  strokeDasharray="1 3"
                  opacity="0.3"
                  pointerEvents="none"
                />
              );
            })}
            {Array.from(ghostRallySystemIds).map(sid => {
              const sys = gameState.systems[sid];
              if (!sys) return null;
              const color = getPlayerColor(currentPlayer);
              const fx = sys.x + 14;
              const fy = sys.y - 4;
              return (
                <g key={`ghost-rally-flag-${sid}`} pointerEvents="none" opacity="0.45" data-testid={`ghost-rally-flag-${sid}`}>
                  <line x1={fx} y1={fy + 8} x2={fx} y2={fy - 8} stroke={color} strokeWidth="1" strokeDasharray="2 2" />
                  <polygon
                    points={`${fx},${fy - 8} ${fx + 8},${fy - 5} ${fx},${fy - 2}`}
                    fill="none"
                    stroke={color}
                    strokeWidth="1"
                    strokeDasharray="1.5 1"
                  />
                  <text
                    x={fx + 3}
                    y={fy - 4}
                    fontSize="6"
                    fontWeight="bold"
                    fill={color}
                  >
                    R
                  </text>
                </g>
              );
            })}

            {/* Pending order overlay (movement/support arrows for current player) */}
            {pendingOrderArrows.map(({ order, src, dst }, idx) => {
              const isSupport = order.order_type === 'support';
              const stroke = isSupport ? '#38bdf8' : '#fbbf24';
              const marker = isSupport ? 'url(#arrow-support)' : 'url(#arrow-move)';
              const label = isSupport ? 'S' : 'M';
              // Shorten the arrow so it doesn't sit under the target node
              const dx = dst.x - src.x;
              const dy = dst.y - src.y;
              const len = Math.max(1, Math.sqrt(dx*dx + dy*dy));
              const shrink = 10; // pixels from target center
              const tx = dst.x - (dx / len) * shrink;
              const ty = dst.y - (dy / len) * shrink;
              const midx = (src.x + tx) / 2;
              const midy = (src.y + ty) / 2;
              return (
                <g key={`ord-${order.starfleet_id}-${idx}`} pointerEvents="none">
                  <line
                    x1={src.x}
                    y1={src.y}
                    x2={tx}
                    y2={ty}
                    stroke={stroke}
                    strokeWidth="1.5"
                    strokeDasharray={isSupport ? '4 3' : '0'}
                    opacity="0.9"
                    markerEnd={marker}
                  />
                  <circle cx={midx} cy={midy} r="7" fill="#0f0f23" stroke={stroke} strokeWidth="1" />
                  <text x={midx} y={midy + 3} fontSize="9" fontWeight="bold" fill={stroke} textAnchor="middle">
                    {label}
                  </text>
                </g>
              );
            })}

            {/* Draw systems */}
            {systems.map(system => {
              const vis = system.visibility || 'full';
              const isHidden = vis === 'hidden';
              const isPartial = vis === 'partial';
              const radius = isHidden ? 6 : (system.is_home_system ? 12 : 8);
              // Owner color: HIDDEN → dark grey; PARTIAL → neutral grey
              // (owner identity is redacted); FULL → real owner color
              const fillColor = isHidden
                ? '#2a2f3a'
                : isPartial
                  ? (system.has_owner ? '#64748b' : '#334155')
                  : getPlayerColor(system.owner);
              const strokeColor = selectedSystem === system.id
                ? '#ffd700'
                : (isHidden ? '#475569' : '#ffffff');
              return (
                <g key={system.id} opacity={isHidden ? 0.7 : 1}>
                  <circle
                    cx={system.x}
                    cy={system.y}
                    r={radius}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={selectedSystem === system.id ? "3" : system.is_home_system ? "2" : "1"}
                    strokeDasharray={isHidden ? '3 2' : (isPartial ? '5 3' : '0')}
                    className="system-node"
                    onClick={() => handleSystemClick(system.id)}
                    onDoubleClick={() => handleSystemDoubleClick(system.id)}
                    style={{ cursor: 'pointer' }}
                  />

                  {/* System name (or ??? when hidden) */}
                  <text
                    x={system.x}
                    y={system.y - 18}
                    fill={isHidden ? '#64748b' : '#ffffff'}
                    fontSize="10"
                    textAnchor="middle"
                    className="system-label"
                    style={{ fontStyle: isHidden ? 'italic' : 'normal' }}
                  >
                    {isHidden ? '???' : system.name}
                    {isPartial && system.has_owner ? ' ★' : ''}
                    {isPartial && system.has_upgrades ? ' +' : ''}
                  </text>

                  {/* Resource indicators — only for FULL visibility */}
                  {vis === 'full' && system.resources && (
                    <text
                      x={system.x}
                      y={system.y + 25}
                      fill="#a0aec0"
                      fontSize="8"
                      textAnchor="middle"
                      className="resource-label"
                    >
                      T:{system.resources.tech} M:{system.resources.metals} C:{system.resources.chon}
                    </text>
                  )}

                  {/* Starfleet indicators — only FULL exposes fleets */}
                  {vis === 'full' && system.starfleet_details && system.starfleet_details.map((starfleet, index) => (
                    <circle
                      key={starfleet.id}
                      cx={system.x + 10 + (index * 8)}
                      cy={system.y - 10}
                      r="4"
                      fill={getPlayerColor(starfleet.owner)}
                      stroke={selectedStarfleet === starfleet.id ? "#ffd700" : "#ffffff"}
                      strokeWidth={selectedStarfleet === starfleet.id ? "2" : "1"}
                      className="starfleet-node"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStarfleetClick(starfleet.id, system.id);
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                  ))}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    );
}
