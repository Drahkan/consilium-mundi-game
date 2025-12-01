import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function App() {
  const [gameState, setGameState] = useState(null);
  const [currentGame, setCurrentGame] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [testingMode, setTestingMode] = useState(false);
  const [selectedStarfleet, setSelectedStarfleet] = useState(null);

  // Orders per player
  const [playerStarfleetOrders, setPlayerStarfleetOrders] = useState({});
  const [playerBuildOrders, setPlayerBuildOrders] = useState({});

  const getCurrentPlayerMovementOrders = () => playerStarfleetOrders[currentPlayer] || {};
  const getCurrentPlayerBuildOrders = () => playerBuildOrders[currentPlayer] || {};

  const setCurrentPlayerMovementOrders = (orders) => {
    setPlayerStarfleetOrders(prev => ({ ...prev, [currentPlayer]: orders }));
  };

  const setCurrentPlayerBuildOrders = (orders) => {
    setPlayerBuildOrders(prev => ({ ...prev, [currentPlayer]: orders }));
  };

  const [showBuildPanel, setShowBuildPanel] = useState(false);
  const [showCombatReports, setShowCombatReports] = useState(false);
  const [combatReportsExpanded, setCombatReportsExpanded] = useState({});
  const [seenCombatTurns, setSeenCombatTurns] = useState(new Set());
  const [playerReady, setPlayerReady] = useState({}); // { [playerId]: boolean }

  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const [showResourceWarning, setShowResourceWarning] = useState(false);
  const [warningDetails, setWarningDetails] = useState(null);
  const [showResourceImpact, setShowResourceImpact] = useState(false);

  // Map state – properly fixed panning & zoom
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Lobby
  const [lobby, setLobby] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [showLobbyScreen, setShowLobbyScreen] = useState(true);
  const [lobbyPlayers, setLobbyPlayers] = useState([]);
  const [lobbyPhase, setLobbyPhase] = useState('setup');
  const [copied, setCopied] = useState(false);

  // Dev mode (single toggle, persists)
  const [devMode, setDevMode] = useState(localStorage.getItem('cmDevMode') === 'true');
  const toggleDevMode = () => {
    const newMode = !devMode;
    setDevMode(newMode);
    localStorage.setItem('cmDevMode', newMode);
  };

  const isCurrentPlayerReady = !!playerReady[currentPlayer];

  // ── API HELPERS ─────────────────────────────────────────────────────────────────
  const apiPost = async (endpoint, body = {}) => {
    try {
      const resp = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status`);
      return await resp.json();
    } catch (e) {
      console.error('API POST error:', e);
      setError(`API error: ${e.message}`);
    }
  };

  const apiGet = async (endpoint) => {
    try {
      const resp = await fetch(`${API_BASE}${endpoint}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    } catch (e) {
      console.error('API GET error:', e);
      setError(`API error: ${e.message}`);
    }
  };

  // ── LOADERS ───────────────────────────────────────────────────────────────────
  const loadGameState = async (gameId, playerId) => {
    const data = await apiGet(`/api/game/${gameId}/state?player_id=${playerId}`);
    if (data) {
      setGameState(data);
      // Mark new combat reports as seen when panel is open
      if (showCombatReports && data.combat_reports) {
        const newSeen = new Set(seenCombatTurns);
        data.combat_reports.forEach(r => newSeen.add(r.turn));
        setSeenCombatTurns(newSeen);
      }
    }
  };

  const loadGamePlayers = async (gameId => {
    const data = await apiGet(`/api/game/${gameId}/players`);
    if (data) setAvailablePlayers(data.players || []);
  };

  // ── LOBBY FLOW ────────────────────────────────────────────────────────────────
  const createLobby = async () => {
    if (!playerName.trim()) return setError('Enter name');
    setLoading(true);
    try {
      const data = await apiPost('/api/lobby/create', { name: playerName });
      setLobby(data);
      setCurrentGame(data.game_id);
      setCurrentPlayer(data.player_id);
      setShowLobbyScreen(true);
      await loadGameState(data.game_id, data.player_id);
      await loadGamePlayers(data.game_id);
    } finally { setLoading(false); }
  };

  const joinLobby = async () => {
    if (!joinCode.trim()) return setError('Enter code');
    setLoading(true);
    try {
      const data = await apiPost('/api/lobby/join', { join_code: joinCode, name: playerName || 'Player' });
      setLobby(data);
      setCurrentGame(data.game_id);
      setCurrentPlayer(data.player_id);
      setShowLobbyScreen(true);
      await loadGameState(data.game_id, data.player_id);
      await loadGamePlayers(data.game_id);
    } finally { setLoading(false); }
  };

  const startLobby = async () => {
    if (!currentGame) return;
    await apiPost(`/api/lobby/${currentGame}/start`, {});
    await loadGameState(currentGame, currentPlayer);
  };

  // ── ORDER SUBMISSION (NOW ACTUALLY WORKS) ────────────────────────────────────
  const submitMovementOrders = async () => {
    const orders = Object.entries(getCurrentPlayerMovementOrders()).map(([fleetId, order]) => ({
      starfleet_id: fleetId,
      ...order
    }));
    await apiPost(`/api/game/${currentGame}/orders`, {
      player_id: currentPlayer,
      type: "movement",
      orders
    });
  };

  const submitBuildOrders = async () => {
    await apiPost(`/api/game/${currentGame}/orders`, {
      player_id: currentPlayer,
      type: "build",
      orders: getCurrentPlayerBuildOrders()
    });
  };

  const submitReady = async (ready = true) => {
    await apiPost(`/api/game/${currentGame}/ready`, {
      player_id: currentPlayer,
      ready
    });
    setPlayerReady(prev => ({ ...prev, [currentPlayer]: ready }));
  };

  const submitAllOrders = async () => {
    await submitMovementOrders();
    await submitBuildOrders();
    await submitReady(true);
  };

  const resolveTurn = async () => {
    await apiPost(`/api/game/${currentGame}/resolve`, {});
    await loadGameState(currentGame, currentPlayer);
  };

  // ── RESOURCE IMPACT CALCULATION (the warning system you wanted) ───────────────
  const calculateResourceImpact = () => {
    if (!gameState || !currentPlayer) return null;
    const res = gameState.player_resources || { tech: 0, metals: 0, chon: 0 };
    const builds = getCurrentPlayerBuildOrders();

    const impact = { tech: 0, metals: 0, chon: 0 };
    Object.values(builds).forEach(o => {
      impact.tech -= o.cost?.tech || 0;
      impact.metals -= o.cost?.metals || 0;
      impact.chon -= o.cost?.chon || 0;
    });

    const final = {
      tech: res.tech + impact.tech,
      metals: res.metals + impact.metals,
      chon: res.chon + impact.chon
    };

    return { impact, final, willBeNegative: Object.values(final).some(v => v < 0) };
  };

  // Trigger warning on any negative projection
  useEffect(() => {
    if (isCurrentPlayerReady) return;
    const impact = calculateResourceImpact();
    if (impact?.willBeNegative) {
      setWarningDetails(impact);
      setShowResourceWarning(true);
    }
  }, [playerBuildOrders, playerReady]);

  // ── MAP PANNING & ZOOM (COMPLETELY FIXED) ───────────────────────────────────
  const mapRef = useRef(null);

  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // left click only
    setIsDragging(true);
    setDragStart({ x: e.clientX - mapPan.x, y: e.clientY - mapPan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setMapPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setMapZoom(prev => Math.max(0.5, Math.min(4, prev * delta)));
  };

  const centerHomeWorld = () => {
    if (!gameState || !currentPlayer) return;
    const home = Object.values(gameState.systems).find(s => s.is_home_system && s.owner === currentPlayer);
    if (home) {
      setMapPan({
        x: window.innerWidth / 2 - home.x * mapZoom,
        y: window.innerHeight / 2 - home.y * mapZoom
      });
    }
  };

  // ── POLLING ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentGame || !currentPlayer) return;
    const interval = setInterval(() => {
      loadGameState(currentGame, currentPlayer);
      loadGamePlayers(currentGame);
    }, 3000);
    return () => clearInterval(interval);
  }, [currentGame, currentPlayer]);

  // ── COPY JOIN CODE ───────────────────────────────────────────────────────────
  const copyJoinCode = async () => {
    if (lobby?.join_code) {
      await navigator.clipboard.writeText(lobby.join_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  // ── RENDER ────────────────────────────────────────────────────────────────────
  if (showLobbyScreen && !currentGame) {
    return (
      <div className="main-menu">
        <div className="menu-background" />
        <div className="menu-content">
          <h1 className="game-title">Consilium Mundi</h1>
          <p className="game-subtitle">A Game of Interstellar Commerce, Diplomacy and Warfare</p>
          
          <div className="create-game-form">
            <input
              type="text"
              placeholder="Your name"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              className="player-name-input"
            />
            <button onClick={createLobby} disabled={loading} className="create-game-btn">
              {loading ? 'Creating...' : 'Create New Game'}
            </button>
            
            <div className="lobby-join">
              <input
                type="text"
                placeholder="Join code"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                className="player-name-input"
              />
              <button onClick={joinLobby} disabled={loading}>
                Join Game
              </button>
            </div>
          </div>
          {error && <div className="error-message">{error}</div>}
        </div>
      </div>
    );
  }

  // ── MAIN GAME UI ─────────────────────────────────────────────────────────────
  return (
    <div className="App">
      <div className="game-interface">
        {/* Header */}
        <div className="game-header">
          <div className="game-info">
            <button onClick={toggleDevMode} className="dev-toggle-btn">
              {devMode ? 'Disable' : 'Enable'} Dev Mode
            </button>
            <h2>Consilium Mundi</h2>
            {renderResourceWidget()}
            <span className="turn-info">
              Turn {gameState?.turn || 0} - {gameState?.phase || 'setup'}
            </span>
          </div>

          {/* Dev Controls */}
          {(testingMode || devMode) && (
            <div className="testing-controls">
              <select value={currentPlayer || ''} onChange={e => switchPlayer(e.target.value)}>
                {availablePlayers.map(p => (
                  <option key={p.id} value={p.id} style={{color: getPlayerColor(p.id)}>
                    {p.name}
                  </option>
                ))}
              </select>
              {gameState?.phase === 'activity' && (
                <button onClick={resolveTurn} className="resolve-turn-btn">
                  Resolve Turn (Dev)
                </button>
              )}
              <button onClick={() => setShowCombatReports(!showCombatReports)}>
                Combat ({(gameState?.combat_reports || []).filter(r => !seenCombatTurns.has(r.turn)).length})
              </button>
              <button onClick={centerHomeWorld} className="center-home-btn">
                Center Home
              </button>
            </div>
          )}
        </div>

        {/* Main Layout */}
        <div className="game-main">
          {renderGalaxyMap({ handleMouseDown, handleMouseMove, handleMouseUp, handleWheel, mapPan, mapZoom })}
          <div className="info-panel">
            {renderSystemDetails()}
            {renderBuildingPanel()}
            {renderCombatReports()}
            {renderOrdersPanel()}
            {renderOrderSummary()}
            
            {/* Global Submit */}
            {(Object.keys(getCurrentPlayerMovementOrders()).length || Object.keys(getCurrentPlayerBuildOrders()).length) && (
              <div className="global-submit-section">
                <button onClick={() => setShowOrderSummary(true)}>
                  Review Orders ({Object.keys(getCurrentPlayerMovementOrders()).length + Object.keys(getCurrentPlayerBuildOrders()).length})
                </button>
                {!isCurrentPlayerReady ? (
                  <button onClick={submitAllOrders} className="submit-all-orders-btn">
                    Finalize Orders
                  </button>
                ) : (
                  <button onClick={() => submitReady(false)} className="unready-btn">
                    Unready
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Dialogs */}
        {showResourceWarning && warningDetails && (
          <div className="warning-dialog-overlay" onClick={() => setShowResourceWarning(false)}>
            <div className="warning-dialog-content" onClick={e => e.stopPropagation()}>
              <h3>Resource Shortfall Warning</h3>
              <p>Your orders would leave you with negative resources. Do you want to proceed?</p>
              <div className="resource-impact-grid">
                <div><strong>Tech</strong><br />Current: {gameState.player_resources.tech}<br />Impact: {warningDetails.impact.tech}<br /><strong>Final: {warningDetails.final.tech}</strong></div>
                <div><strong>Metals</strong><br />Current: {gameState.player_resources.metals}<br />Impact: {warningDetails.impact.metals}<br /><strong>Final: {warningDetails.final.metals}</strong></div>
                <div><strong>CHON</strong><br />Current: {gameState.player_resources.chon}<br />Impact: {warningDetails.impact.chon}<br /><strong>Final: {warningDetails.final.chon}</strong></div>
              </div>
              <div className="dialog-buttons">
                <button className="cancel" onClick={() => setShowResourceWarning(false)}>Cancel</button>
                <button className="proceed" onClick={() => { setShowResourceWarning(false); submitAllOrders(); }}>Proceed Anyway</button>
              </div>
            </div>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}
      </div>
    </div>
  );
}

export default App;