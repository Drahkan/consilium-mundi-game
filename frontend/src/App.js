import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import DiplomacyPouch from './DiplomacyPouch';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

// Read ?game=<id> and ?name=<n> from URL for shareable joins
function readUrlParams() {
  try {
    const p = new URLSearchParams(window.location.search);
    return { game: p.get('game') || '', name: p.get('name') || '' };
  } catch (e) { return { game: '', name: '' }; }
}

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
  const [starfleetOrders, setStarfleetOrders] = useState({});
  const [buildOrders, setBuildOrders] = useState({});
  const [playerBuildOrders, setPlayerBuildOrders] = useState({}); // Per-player build orders
  const [showBuildPanel, setShowBuildPanel] = useState(false);
  const [showCombatReports, setShowCombatReports] = useState(false);
  const [showDiplomacy, setShowDiplomacy] = useState(false);
  const [combatReportsExpanded, setCombatReportsExpanded] = useState({});
  const [seenCombatTurns, setSeenCombatTurns] = useState(new Set());
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const [showResourceWarning, setShowResourceWarning] = useState(false);
  const [warningDetails, setWarningDetails] = useState(null);
  const [showResourceImpact, setShowResourceImpact] = useState(false);

  // Multi-player lobby state
  const [landingMode, setLandingMode] = useState('create'); // 'create' | 'join'
  const [joinGameId, setJoinGameId] = useState('');
  const [numPlayersConfig, setNumPlayersConfig] = useState(2);
  const [turnSecondsConfig, setTurnSecondsConfig] = useState(300); // 5 min default
  const [fowModeConfig, setFowModeConfig] = useState('basic'); // 'off' | 'basic'
  const [copiedFlag, setCopiedFlag] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(null);
  const lobbyPollRef = useRef(null);
  const timerTickRef = useRef(null);
  const autoResolveFiredRef = useRef({}); // { turnNumber: true }
  
  // Map navigation state
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Rally-point staging. Mirrors the movement-order tone: pick a
  // target → preview a ghost marker on the map → commit with a Set
  // button. Keyed by starfleet id; value is the pending system id
  // (or the sentinel string 'CLEAR' for "no rally").
  const [pendingRally, setPendingRally] = useState({}); // { sf_id: sys_id | 'CLEAR' }

  // Full Replay viewer state. Fetched on demand from /api/game/{id}/replay
  // when the player clicks "View Full Replay" on the game-over screen.
  const [replayData, setReplayData] = useState(null);
  const [replayTurnIdx, setReplayTurnIdx] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const replayTimerRef = useRef(null);

  // Combat report navigator state: which turn is the player scrubbed to.
  // Defaults to "latest" (all turns collapsed) but flips to a single-turn
  // focus once the player uses the ⏮ ⏯ ⏭ controls.
  const [combatFocusTurn, setCombatFocusTurn] = useState(null); // null = all turns

  // Auto-fill join form from URL params on first mount
  useEffect(() => {
    const { game, name } = readUrlParams();
    if (game) {
      setJoinGameId(game);
      setLandingMode('join');
    }
    if (name) setPlayerName(name);
  }, []);

  // Poll game state:
  //   - Every 2s while in the lobby (phase !== 'activity') so joins appear quickly
  //   - Every 5s during active play so the other player's turn resolutions show
  useEffect(() => {
    if (!currentGame) return undefined;
    const phase = gameState?.phase;
    const interval = phase === 'activity' ? 5000 : 2000;

    if (lobbyPollRef.current) clearInterval(lobbyPollRef.current);
    lobbyPollRef.current = setInterval(() => {
      loadGameState(currentGame, currentPlayer);
      loadGamePlayers(currentGame);
    }, interval);
    return () => {
      if (lobbyPollRef.current) {
        clearInterval(lobbyPollRef.current);
        lobbyPollRef.current = null;
      }
    };
  }, [currentGame, currentPlayer, gameState?.phase]);

  // Turn countdown: ticks once per second, computes remaining seconds from the
  // server-authoritative deadline (accounts for clock drift and page refreshes).
  // When it hits zero, the "host" (first player in the roster) auto-fires the
  // resolve-turn endpoint. Ref guard ensures we only fire once per turn.
  useEffect(() => {
    if (timerTickRef.current) clearInterval(timerTickRef.current);
    if (!gameState || gameState.phase !== 'activity' || gameState.game_over) {
      setSecondsRemaining(null);
      return undefined;
    }
    // Paused: show the frozen "remaining" value; no auto-resolve.
    if (gameState.turn_paused) {
      setSecondsRemaining(gameState.turn_paused_remaining || 0);
      return undefined;
    }
    if (!gameState.turn_deadline) {
      setSecondsRemaining(null);
      return undefined;
    }
    const deadlineMs = new Date(gameState.turn_deadline).getTime();
    const tick = () => {
      const remaining = Math.max(0, Math.round((deadlineMs - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        // Only the host issues resolve to avoid duplicate calls from N browsers
        const isHost = availablePlayers.length > 0 && availablePlayers[0].id === currentPlayer;
        const turnKey = String(gameState.turn);
        if (isHost && !autoResolveFiredRef.current[turnKey]) {
          autoResolveFiredRef.current[turnKey] = true;
          resolveTurn();
        }
      }
    };
    tick();
    timerTickRef.current = setInterval(tick, 1000);
    return () => {
      if (timerTickRef.current) {
        clearInterval(timerTickRef.current);
        timerTickRef.current = null;
      }
    };
  }, [gameState?.turn_deadline, gameState?.phase, gameState?.turn, gameState?.turn_paused, gameState?.turn_paused_remaining, availablePlayers, currentPlayer]);

  // Replay auto-play tick. Advances one snapshot every 1.6s while
  // replayPlaying is true; stops (and auto-pauses) at the last frame.
  useEffect(() => {
    if (replayTimerRef.current) {
      clearInterval(replayTimerRef.current);
      replayTimerRef.current = null;
    }
    if (!replayData || !replayPlaying) return undefined;
    replayTimerRef.current = setInterval(() => {
      setReplayTurnIdx(prev => {
        const last = (replayData.snapshots?.length || 1) - 1;
        if (prev >= last) {
          setReplayPlaying(false);
          return last;
        }
        return prev + 1;
      });
    }, 1600);
    return () => {
      if (replayTimerRef.current) {
        clearInterval(replayTimerRef.current);
        replayTimerRef.current = null;
      }
    };
  }, [replayData, replayPlaying]);

  // Create a new game
  const createGame = async () => {
    if (!playerName.trim()) {
      setError('Please enter a player name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/create-game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_name: playerName,
          config: {
            num_players: numPlayersConfig,
            galaxy_size: "standard",
            turn_time_limit: 24,
            turn_time_seconds: turnSecondsConfig,
            fow_mode: fowModeConfig
          }
        })
      });

      if (!response.ok) throw new Error('Failed to create game');

      const data = await response.json();
      setCurrentGame(data.game_id);
      setCurrentPlayer(data.player_id);
      // Testing mode stays OFF for real multi-player games; enable via header toggle if needed
      setTestingMode(false);

      // Load initial game state WITH player_id to get resources
      await loadGameState(data.game_id, data.player_id);
      await loadGamePlayers(data.game_id);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Join an existing game via shared code
  const joinGame = async () => {
    if (!playerName.trim()) { setError('Please enter a player name'); return; }
    if (!joinGameId.trim()) { setError('Please enter a game code'); return; }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/join-game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_name: playerName, game_id: joinGameId.trim() })
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.detail || 'Failed to join game');
      }
      const data = await response.json();
      setCurrentGame(data.game_id);
      setCurrentPlayer(data.player_id);
      setTestingMode(false);
      await loadGameState(data.game_id, data.player_id);
      await loadGamePlayers(data.game_id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Force-start current game (host action in lobby); fills empty slots with AI
  const startGame = async (fillWithAi = true) => {
    if (!currentGame) return;
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/game/${currentGame}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fill_with_ai: fillWithAi })
      });
      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        throw new Error(errBody.detail || 'Failed to start game');
      }
      await loadGameState(currentGame, currentPlayer);
      await loadGamePlayers(currentGame);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Host timer controls: pause / resume / extend the current turn's countdown.
  const controlTimer = async (action, seconds) => {
    if (!currentGame) return;
    try {
      const body = { action };
      if (typeof seconds === 'number') body.seconds = seconds;
      const resp = await fetch(`${API_BASE}/api/game/${currentGame}/timer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        throw new Error(errBody.detail || 'Timer action failed');
      }
      // Refresh state right away so the chip reflects the new deadline
      await loadGameState(currentGame, currentPlayer);
    } catch (err) {
      setError(err.message);
    }
  };

  // Ready-up: mark (or unmark) the current player as ready. When every
  // player in the roster is ready the backend auto-resolves the turn.
  const setReady = async (ready) => {
    if (!currentGame || !currentPlayer) return;
    try {
      const resp = await fetch(`${API_BASE}/api/game/${currentGame}/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: currentPlayer, ready })
      });
      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        throw new Error(errBody.detail || 'Ready failed');
      }
      await loadGameState(currentGame, currentPlayer);
      await loadGamePlayers(currentGame);
    } catch (err) {
      setError(err.message);
    }
  };

  // Rally point: designate a friendly system where this fleet should
  // fall back to on retreat. Pass null to clear.
  const setStarfleetRally = async (starfleetId, rallySystemId) => {
    if (!currentGame || !currentPlayer) return;
    try {
      const resp = await fetch(`${API_BASE}/api/game/${currentGame}/starfleets/${starfleetId}/rally`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: currentPlayer, rally_system_id: rallySystemId })
      });
      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        throw new Error(errBody.detail || 'Rally point update failed');
      }
      await loadGameState(currentGame, currentPlayer);
    } catch (err) {
      setError(err.message);
    }
  };

  // Reset everything back to the landing (create/join) screen. Used by
  // the game-over screen so a player can start or join a fresh game
  // without a full browser refresh. Also strips ?game=<id> from the
  // URL so the old lobby link doesn't re-hydrate on mount.
  const returnToHome = () => {
    try {
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch (e) { /* ignore */ }
    setGameState(null);
    setCurrentGame(null);
    setCurrentPlayer(null);
    setAvailablePlayers([]);
    setSelectedSystem(null);
    setSelectedStarfleet(null);
    setStarfleetOrders({});
    setBuildOrders({});
    setPlayerBuildOrders({});
    setShowBuildPanel(false);
    setShowCombatReports(false);
    setCombatReportsExpanded({});
    setSeenCombatTurns(new Set());
    setShowOrderSummary(false);
    setShowResourceWarning(false);
    setWarningDetails(null);
    setShowResourceImpact(false);
    setJoinGameId('');
    setLandingMode('create');
    setError(null);
    autoResolveFiredRef.current = {};
    setPendingRally({});
    setReplayData(null);
    setReplayTurnIdx(0);
    setReplayPlaying(false);
    if (replayTimerRef.current) {
      clearInterval(replayTimerRef.current);
      replayTimerRef.current = null;
    }
    setCombatFocusTurn(null);
  };

  // Fetch the full replay (turn-by-turn snapshots) from the backend
  // and open the viewer. Called from the game-over screen. Snapshots
  // are FoW-off by design — the game is over, so nothing to hide.
  const openReplay = async () => {
    if (!currentGame) return;
    try {
      const resp = await fetch(`${API_BASE}/api/game/${currentGame}/replay`);
      if (!resp.ok) throw new Error('Failed to load replay');
      const data = await resp.json();
      setReplayData(data);
      setReplayTurnIdx(0);
      setReplayPlaying(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const closeReplay = () => {
    setReplayData(null);
    setReplayPlaying(false);
    if (replayTimerRef.current) {
      clearInterval(replayTimerRef.current);
      replayTimerRef.current = null;
    }
  };

  // Load game state with player-specific data
  const loadGameState = async (gameId, playerId = null) => {
    try {
      const playerParam = playerId || currentPlayer;
      const url = playerParam 
        ? `${API_BASE}/api/game/${gameId}/state?player_id=${playerParam}`
        : `${API_BASE}/api/game/${gameId}/state`;
        
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to load game state');
      
      const data = await response.json();
      setGameState(data);
      
      // Debug logging to check resources
      if (data.player_resources) {
        console.log('Player resources loaded:', data.player_resources);
      } else {
        console.warn('No player resources in game state');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Load available players for testing
  const loadGamePlayers = async (gameId) => {
    try {
      const response = await fetch(`${API_BASE}/api/game/${gameId}/players`);
      if (!response.ok) throw new Error('Failed to load players');
      
      const data = await response.json();
      setAvailablePlayers(data.players);
    } catch (err) {
      setError(err.message);
    }
  };

  // Add AI players for testing
  const addAIPlayers = async () => {
    if (!currentGame) return;

    const aiNames = ['Admiral Zara', 'Commander Vex', 'Captain Nova'];
    
    for (let i = 0; i < 3; i++) {
      try {
        await fetch(`${API_BASE}/api/join-game`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            player_name: aiNames[i],
            game_id: currentGame
          })
        });
      } catch (err) {
        console.error('Failed to add AI player:', err);
      }
    }

    // Reload game state and players
    await loadGameState(currentGame);
    await loadGamePlayers(currentGame);
  };

  // Switch between players (for testing)
  const switchPlayer = (playerId) => {
    setCurrentPlayer(playerId);
    setSelectedSystem(null);
    setSelectedStarfleet(null);
    // Reload game state for new player
    if (currentGame) {
      loadGameState(currentGame);
    }
  };

  // Handle system click
  const handleSystemClick = (systemId) => {
    setSelectedSystem(systemId);
    setSelectedStarfleet(null);
  };

  // Handle starfleet click
  const handleStarfleetClick = (starfleetId, systemId) => {
    const system = gameState.systems[systemId];
    const starfleet = system.starfleet_details.find(sf => sf.id === starfleetId);
    
    if (starfleet && starfleet.owner === currentPlayer) {
      setSelectedStarfleet(starfleetId);
      setSelectedSystem(systemId);
    }
  };

  // Issue starfleet order with proper highlighting and no stacking
  const issueStarfleetOrder = (orderType, targetSystem = null, supportTarget = null) => {
    if (!selectedStarfleet) return;

    const newOrders = { ...starfleetOrders };
    
    // Create the order
    const order = {
      starfleet_id: selectedStarfleet,
      order_type: orderType,
      target_system: targetSystem,
      support_target: supportTarget
    };

    // Use starfleet ID as key to ensure only one order per starfleet
    const orderKey = selectedStarfleet;
    
    if (orderType === 'defend') {
      // If defending (default), remove any existing order
      delete newOrders[orderKey];
    } else {
      // Set the new order, replacing any existing order for this starfleet
      newOrders[orderKey] = order;
    }

    setStarfleetOrders(newOrders);
  };

  // Submit starfleet orders
  const submitOrders = async () => {
    if (!currentGame || !currentPlayer) return;

    try {
      const orders = Object.values(starfleetOrders);
      
      const response = await fetch(`${API_BASE}/api/game/${currentGame}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: currentPlayer,
          orders: orders
        })
      });

      if (!response.ok) throw new Error('Failed to submit orders');

      setStarfleetOrders({});
      alert('Orders submitted successfully!');
      
    } catch (err) {
      setError(err.message);
    }
  };

  // Get current player's build orders
  const getCurrentPlayerBuildOrders = () => {
    return playerBuildOrders[currentPlayer] || {};
  };
  
  // Update current player's build orders
  const updateCurrentPlayerBuildOrders = (orders) => {
    setPlayerBuildOrders(prev => ({
      ...prev,
      [currentPlayer]: orders
    }));
    // Also update legacy buildOrders for compatibility
    setBuildOrders(orders);
  };

  // Get build cost for a specific build type
  const getBuildCost = (buildType) => {
    const buildCosts = {
      'starfleet': { tech: 1, metals: 1, chon: 1 },
      'starport': { tech: 2, metals: 2, chon: 2 },
      'shipyard': { tech: 3, metals: 3, chon: 1 },
      'colony': { tech: 0, metals: 2, chon: 2 },
      'mining_facilities': { tech: 2, metals: 2, chon: 1 },
      'wormhole_generator': { tech: 6, metals: 2, chon: 0 }
    };
    return buildCosts[buildType] || { tech: 0, metals: 0, chon: 0 };
  };

  // Calculate available resources after pending build orders
  const calculateAvailableResources = () => {
    if (!gameState || !gameState.player_resources) {
      return { tech: 0, metals: 0, chon: 0 };
    }
    
    const currentPlayerOrders = getCurrentPlayerBuildOrders();
    const currentResources = { ...gameState.player_resources };
    
    // Subtract resources from pending build orders
    Object.values(currentPlayerOrders).forEach(order => {
      const costs = getBuildCost(order.build_type);
      currentResources.tech -= costs.tech;
      currentResources.metals -= costs.metals;
      currentResources.chon -= costs.chon;
    });
    
    return {
      tech: Math.max(0, currentResources.tech),
      metals: Math.max(0, currentResources.metals),
      chon: Math.max(0, currentResources.chon)
    };
  };

  // Calculate resource impact after turn resolution
  const calculateResourceImpact = () => {
    if (!gameState || !gameState.systems || !gameState.player_resources) {
      return null;
    }

    const currentPlayerOrders = getCurrentPlayerBuildOrders();
    let resourcesAfterBuilding = { ...gameState.player_resources };
    
    // Subtract build costs
    Object.values(currentPlayerOrders).forEach(order => {
      const costs = getBuildCost(order.build_type);
      resourcesAfterBuilding.tech -= costs.tech;
      resourcesAfterBuilding.metals -= costs.metals;
      resourcesAfterBuilding.chon -= costs.chon;
    });

    // Calculate income from owned systems (next turn's resource phase)
    let income = { tech: 0, metals: 0, chon: 0 };
    Object.values(gameState.systems).forEach(system => {
      if (system.owner === currentPlayer) {
        income.tech += system.resources.tech;
        income.metals += system.resources.metals;
        income.chon += system.resources.chon;
        
        // Add bonus from upgrades
        if (system.upgrades.includes('colony')) {
          income.tech += 1;
        }
        if (system.upgrades.includes('mining_facilities')) {
          income.metals += 1;
          income.chon += 1;
        }
      }
    });

    // Calculate current starfleets count + new starfleets from build orders
    let currentStarfleetCount = 0;
    Object.values(gameState.systems).forEach(system => {
      if (system.starfleet_details) {
        currentStarfleetCount += system.starfleet_details.filter(sf => sf.owner === currentPlayer).length;
      }
    });

    // Add starfleets being built
    const newStarfleets = Object.values(currentPlayerOrders).filter(order => order.build_type === 'starfleet').length;
    const totalStarfleetCount = currentStarfleetCount + newStarfleets;
    
    // Calculate upkeep (1 of each resource per starfleet)
    const upkeep = { 
      tech: totalStarfleetCount, 
      metals: totalStarfleetCount, 
      chon: totalStarfleetCount 
    };

    // Calculate net change
    const netChange = {
      tech: income.tech - upkeep.tech,
      metals: income.metals - upkeep.metals,
      chon: income.chon - upkeep.chon
    };

    // Calculate resources after full turn resolution
    const resourcesAfterTurn = {
      tech: resourcesAfterBuilding.tech + netChange.tech,
      metals: resourcesAfterBuilding.metals + netChange.metals,
      chon: resourcesAfterBuilding.chon + netChange.chon
    };

    // Check for potential starfleet destruction
    const minResource = Math.min(resourcesAfterTurn.tech, resourcesAfterTurn.metals, resourcesAfterTurn.chon);
    const starfleetDestructionCount = minResource < 0 ? Math.abs(minResource) : 0;
    const survivingStarfleets = Math.max(0, totalStarfleetCount - starfleetDestructionCount);

    return {
      currentResources: { ...gameState.player_resources },
      buildCosts: Object.values(currentPlayerOrders).reduce((total, order) => {
        const costs = getBuildCost(order.build_type);
        return {
          tech: total.tech + costs.tech,
          metals: total.metals + costs.metals,
          chon: total.chon + costs.chon
        };
      }, { tech: 0, metals: 0, chon: 0 }),
      resourcesAfterBuilding,
      income,
      upkeep,
      netChange,
      resourcesAfterTurn,
      currentStarfleetCount,
      newStarfleets,
      totalStarfleetCount,
      starfleetDestructionCount,
      survivingStarfleets,
      hasWarning: starfleetDestructionCount > 0
    };
  };

  const handleOrderClick = (orderType, systemId, starfleetId = null) => {
    // Close order summary
    setShowOrderSummary(false);
    
    // Navigate to the system
    if (systemId && gameState.systems[systemId]) {
      const system = gameState.systems[systemId];
      
      // Center on the system
      const viewportCenterX = 400;
      const viewportCenterY = 300;
      setMapPan({ 
        x: viewportCenterX - system.x * mapZoom, 
        y: viewportCenterY - system.y * mapZoom 
      });
      
      // Select the system
      setSelectedSystem(systemId);
      
      if (orderType === 'build') {
        // Open build panel
        setShowBuildPanel(true);
        setSelectedStarfleet(null);
      } else if (orderType === 'move' && starfleetId) {
        // Select the starfleet
        setSelectedStarfleet(starfleetId);
        setShowBuildPanel(false);
      }
    }
  };
  const renderOrderSummary = () => {
    if (!showOrderSummary || !gameState) return null;
    
    const movementOrders = Object.values(starfleetOrders);
    const currentBuildOrders = getCurrentPlayerBuildOrders();
    const pendingBuildOrders = Object.values(currentBuildOrders);
    const availableResources = calculateAvailableResources();
    
    // Calculate post-turn resources (current resources + income - upkeep - build costs)
    const currentResources = gameState.player_resources || { tech: 0, metals: 0, chon: 0 };
    let projectedIncome = { tech: 0, metals: 0, chon: 0 };
    let upkeepCost = { tech: 0, metals: 0, chon: 0 };
    
    // Calculate income from owned systems
    Object.values(gameState.systems || {}).forEach(system => {
      if (system.owner === currentPlayer) {
        projectedIncome.tech += system.resources.tech;
        projectedIncome.metals += system.resources.metals;
        projectedIncome.chon += system.resources.chon;
        
        // Add upgrade bonuses
        if (system.upgrades.includes('colony')) projectedIncome.tech += 1;
        if (system.upgrades.includes('mining_facilities')) {
          projectedIncome.metals += 1;
          projectedIncome.chon += 1;
        }
      }
    });
    
    // Calculate upkeep (1 of each resource per starfleet)
    let totalStarfleets = 0;
    Object.values(gameState.systems || {}).forEach(system => {
      if (system.starfleet_details) {
        totalStarfleets += system.starfleet_details.filter(sf => sf.owner === currentPlayer).length;
      }
    });
    
    upkeepCost = { tech: totalStarfleets, metals: totalStarfleets, chon: totalStarfleets };
    
    const postTurnResources = {
      tech: currentResources.tech + projectedIncome.tech - upkeepCost.tech,
      metals: currentResources.metals + projectedIncome.metals - upkeepCost.metals,
      chon: currentResources.chon + projectedIncome.chon - upkeepCost.chon
    };
    
    return (
      <div className="order-summary-panel fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-white">Order Summary</h3>
            <button 
              onClick={() => setShowOrderSummary(false)}
              className="text-gray-400 hover:text-white text-xl"
            >
              ×
            </button>
          </div>
          
          {/* Movement Orders */}
          <div className="mb-4">
            <h4 className="text-lg font-semibold text-yellow-400 mb-2">
              Movement Orders ({movementOrders.length})
            </h4>
            {movementOrders.length > 0 ? (
              <div className="space-y-2">
                {movementOrders.map((order, index) => {
                  const starfleetSystem = Object.values(gameState.systems).find(sys => 
                    sys.starfleet_details?.some(sf => sf.id === order.starfleet_id)
                  );
                  const targetSystem = gameState.systems[order.target_system];
                  
                  return (
                    <div 
                      key={index} 
                      className="text-sm text-gray-300 bg-gray-700 p-2 rounded cursor-pointer hover:bg-gray-600 transition-colors"
                      onClick={() => handleOrderClick('move', starfleetSystem?.id, order.starfleet_id)}
                    >
                      Starfleet from {starfleetSystem?.name || 'Unknown'} → {order.order_type} → {targetSystem?.name || order.target_system}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">No movement orders</p>
            )}
          </div>
          
          {/* Build Orders */}
          <div className="mb-4">
            <h4 className="text-lg font-semibold text-blue-400 mb-2">
              Build Orders ({pendingBuildOrders.length})
            </h4>
            {pendingBuildOrders.length > 0 ? (
              <div className="space-y-2">
                {pendingBuildOrders.map((order, index) => {
                  const system = gameState.systems[order.system_id];
                  return (
                    <div 
                      key={index} 
                      className="text-sm text-gray-300 bg-gray-700 p-2 rounded cursor-pointer hover:bg-gray-600 transition-colors"
                      onClick={() => handleOrderClick('build', order.system_id)}
                    >
                      Building {order.build_type.replace('_', ' ')} in {system?.name || 'Unknown System'}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">No build orders</p>
            )}
          </div>
          
          {/* Resource Summary */}
          <div className="mb-4">
            <h4 className="text-lg font-semibold text-green-400 mb-2">Resource Summary</h4>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="font-semibold text-gray-300">Resource</div>
                <div className="text-white">Current</div>
                <div className="text-green-400">Income</div>
                <div className="text-red-400">Upkeep</div>
                <div className="text-yellow-400">Available</div>
                <div className="text-blue-400">Post-Turn</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-blue-400">Tech</div>
                <div>{currentResources.tech}</div>
                <div>+{projectedIncome.tech}</div>
                <div>-{upkeepCost.tech}</div>
                <div>{availableResources.tech}</div>
                <div>{postTurnResources.tech}</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-gray-400">Metals</div>
                <div>{currentResources.metals}</div>
                <div>+{projectedIncome.metals}</div>
                <div>-{upkeepCost.metals}</div>
                <div>{availableResources.metals}</div>
                <div>{postTurnResources.metals}</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-green-400">CHON</div>
                <div>{currentResources.chon}</div>
                <div>+{projectedIncome.chon}</div>
                <div>-{upkeepCost.chon}</div>
                <div>{availableResources.chon}</div>
                <div>{postTurnResources.chon}</div>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <button 
              onClick={() => setShowOrderSummary(false)}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500"
            >
              Close
            </button>
            {(movementOrders.length > 0 || pendingBuildOrders.length > 0) && (
              <button 
                onClick={() => {
                  setShowOrderSummary(false);
                  submitAllOrders();
                }}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-500"
              >
                Finalize Orders
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Calculate if build orders would cause starfleet destruction
  const calculateStarfleetDestructionRisk = () => {
    if (!gameState || !gameState.player_resources || !currentPlayer) {
      return { atRisk: false, details: {} };
    }
    
    // Calculate post-turn resources after all pending orders
    const currentBuildOrders = getCurrentPlayerBuildOrders();
    const buildCosts = { tech: 0, metals: 0, chon: 0 };
    
    // Sum up all build costs
    Object.values(currentBuildOrders).forEach(order => {
      const costs = {
        'starfleet': { tech: 1, metals: 1, chon: 1 },
        'starport': { tech: 2, metals: 2, chon: 2 },
        'shipyard': { tech: 3, metals: 3, chon: 1 },
        'colony': { tech: 0, metals: 2, chon: 2 },
        'mining_facilities': { tech: 2, metals: 2, chon: 1 },
        'wormhole_generator': { tech: 6, metals: 2, chon: 0 }
      };
      
      const cost = costs[order.build_type];
      if (cost) {
        buildCosts.tech += cost.tech;
        buildCosts.metals += cost.metals;
        buildCosts.chon += cost.chon;
      }
    });
    
    // Calculate income from systems
    let income = { tech: 0, metals: 0, chon: 0 };
    Object.values(gameState.systems || {}).forEach(system => {
      if (system.owner === currentPlayer) {
        income.tech += system.resources.tech;
        income.metals += system.resources.metals;
        income.chon += system.resources.chon;
        
        // Add upgrade bonuses
        if (system.upgrades.includes('colony')) income.tech += 1;
        if (system.upgrades.includes('mining_facilities')) {
          income.metals += 1;
          income.chon += 1;
        }
      }
    });
    
    // Count current and planned starfleets
    let currentStarfleets = 0;
    let plannedStarfleets = 0;
    
    Object.values(gameState.systems || {}).forEach(system => {
      if (system.starfleet_details) {
        currentStarfleets += system.starfleet_details.filter(sf => sf.owner === currentPlayer).length;
      }
    });
    
    // Count starfleet build orders
    Object.values(currentBuildOrders).forEach(order => {
      if (order.build_type === 'starfleet') {
        plannedStarfleets++;
      }
    });
    
    const totalStarfleets = currentStarfleets + plannedStarfleets;
    
    // Calculate net resources after income - build costs - upkeep
    const netResources = {
      tech: gameState.player_resources.tech + income.tech - buildCosts.tech - totalStarfleets,
      metals: gameState.player_resources.metals + income.metals - buildCosts.metals - totalStarfleets,
      chon: gameState.player_resources.chon + income.chon - buildCosts.chon - totalStarfleets
    };
    
    // Check if any resource would go negative, requiring starfleet destruction
    const wouldDestroyStarfleets = netResources.tech < 0 || netResources.metals < 0 || netResources.chon < 0;
    
    return {
      atRisk: wouldDestroyStarfleets,
      details: {
        currentStarfleets,
        plannedStarfleets,
        totalStarfleets,
        income,
        buildCosts,
        netResources,
        starfleetsAtRisk: wouldDestroyStarfleets ? Math.max(
          Math.abs(Math.min(netResources.tech, 0)),
          Math.abs(Math.min(netResources.metals, 0)),
          Math.abs(Math.min(netResources.chon, 0))
        ) : 0
      }
    };
  };
  // Confirm build order after warning
  const confirmBuildOrder = () => {
    if (!warningDetails) return;
    
    const { buildOrder } = warningDetails;
    const currentBuildOrders = getCurrentPlayerBuildOrders();
    const newOrders = { ...currentBuildOrders };
    const orderId = `${buildOrder.systemId}_${buildOrder.buildType}`;
    
    // Add the build order
    newOrders[orderId] = {
      type: "build",
      build_type: buildOrder.buildType,
      system_id: buildOrder.systemId
    };
    
    updateCurrentPlayerBuildOrders(newOrders);
    setShowResourceWarning(false);
    setWarningDetails(null);
  };

  // Cancel build order from warning
  const cancelBuildOrder = () => {
    setShowResourceWarning(false);
    setWarningDetails(null);
  };

  const issueBuildOrder = (buildType, systemId) => {
    const currentBuildOrders = getCurrentPlayerBuildOrders();
    const newOrders = { ...currentBuildOrders };
    const orderId = `${systemId}_${buildType}`;
    
    // If this build order already exists, remove it (toggle behavior)
    if (newOrders[orderId]) {
      delete newOrders[orderId];
      updateCurrentPlayerBuildOrders(newOrders);
      return;
    }

    // Check if player can afford this build order
    const availableResources = calculateAvailableResources();
    const cost = getBuildCost(buildType);
    
    if (availableResources.tech < cost.tech ||
        availableResources.metals < cost.metals ||
        availableResources.chon < cost.chon
    ) {
      // Can't afford this build order
      return;
    }

    // Add the build order temporarily to check for warnings
    const tempOrders = {
      ...newOrders,
      [orderId]: {
        type: "build",
        build_type: buildType,
        system_id: systemId
      }
    };

    // Update the player build orders temporarily for warning calculation
    const oldPlayerOrders = { ...playerBuildOrders };
    const tempPlayerOrders = { ...playerBuildOrders, [currentPlayer]: tempOrders };
    setPlayerBuildOrders(tempPlayerOrders);

    // Check for warnings with the temporary build order
    const resourceImpact = calculateResourceImpact();
    
    // Restore the original state
    setPlayerBuildOrders(oldPlayerOrders);

    if (resourceImpact && resourceImpact.hasWarning) {
      // Show warning dialog
      setWarningDetails({
        buildOrder: { buildType, systemId },
        resourceImpact: resourceImpact
      });
      setShowResourceWarning(true);
      return;
    }

    // No warnings, proceed with the build order
    updateCurrentPlayerBuildOrders(tempOrders);
  };

  // Submit build orders
  const submitBuildOrders = async () => {
    if (!currentGame || !currentPlayer) {
      console.error('Missing currentGame or currentPlayer:', { currentGame, currentPlayer });
      return;
    }

    try {
      const orders = Object.values(buildOrders);
      console.log('Submitting build orders:', orders);
      
      const response = await fetch(`${API_BASE}/api/game/${currentGame}/build-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: currentPlayer,
          orders: orders
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to submit build orders: ${response.status} - ${errorText}`);
      }

      setBuildOrders({});
      console.log('Build orders submitted successfully');
      
    } catch (err) {
      console.error('Error submitting build orders:', err);
      setError(err.message);
    }
  };

  // Submit all orders (both movement and build)
  const submitAllOrders = async () => {
    console.log('submitAllOrders called:', { currentGame, currentPlayer });
    
    if (!currentGame || !currentPlayer) {
      alert('Game or player not properly initialized!');
      return;
    }
    
    const movementCount = Object.keys(starfleetOrders).length;
    const currentBuildOrders = getCurrentPlayerBuildOrders();
    const buildCount = Object.keys(currentBuildOrders).length;
    
    console.log('Orders to submit:', { movementCount, buildCount, currentBuildOrders });
    
    if (movementCount === 0 && buildCount === 0) {
      alert('No orders to submit!');
      return;
    }
    
    // Calculate resource impact and show detailed confirmation
    const resourceImpact = calculateResourceImpact();
    
    if (resourceImpact && resourceImpact.hasWarning) {
      // Show detailed resource impact with warning
      setWarningDetails({
        buildOrder: null, // This is for finalize orders, not individual build
        resourceImpact: resourceImpact
      });
      setShowResourceImpact(true);
      return;
    }

    // Show regular confirmation
    const confirmationMessage = `Are you sure you want to finalize your turn?\n\n` +
      `${movementCount} movement orders and ${buildCount} build orders will be submitted.\n` +
      `This will end your turn and you cannot make changes until the next turn.`;
    
    if (!window.confirm(confirmationMessage)) {
      return;
    }
    
    await executeOrderSubmission();
  };

  // Execute the actual order submission
  const executeOrderSubmission = async () => {
    try {
      const currentBuildOrders = getCurrentPlayerBuildOrders();
      
      // Submit starfleet orders first
      if (Object.keys(starfleetOrders).length > 0) {
        console.log('Submitting starfleet orders...');
        await submitOrders();
      }
      
      // Submit build orders
      if (Object.keys(currentBuildOrders).length > 0) {
        console.log('Submitting build orders...');
        // Temporarily set buildOrders for submitBuildOrders to work
        setBuildOrders(currentBuildOrders);
        await submitBuildOrders();
      }
      
      // Clear current player's build orders after successful submission
      updateCurrentPlayerBuildOrders({});
      
      alert(`Turn finalized for ${getPlayerName(currentPlayer)}!`);
      
      // Refresh game state
      await loadGameState(currentGame, currentPlayer);
      
    } catch (err) {
      console.error('Error in executeOrderSubmission:', err);
      setError(err.message);
    }
  };

  // Confirm order submission after impact review
  const confirmOrderSubmission = () => {
    setShowResourceImpact(false);
    setWarningDetails(null);
    executeOrderSubmission();
  };

  // Cancel order submission
  const cancelOrderSubmission = () => {
    setShowResourceImpact(false);
    setWarningDetails(null);
  };

  // Render resource warning dialog
  const renderResourceWarningDialog = () => {
    if (!showResourceWarning || !warningDetails || !warningDetails.resourceImpact) return null;
    
    const { resourceImpact } = warningDetails;
    const isIndividualBuild = warningDetails.buildOrder !== null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
          <div className="flex items-center mb-4">
            <div className="text-red-400 mr-3 text-2xl">⚠️</div>
            <h3 className="text-xl font-bold text-red-400">
              {isIndividualBuild ? 'Build Order Warning' : 'Resource Shortage Warning'}
            </h3>
          </div>
          
          <div className="mb-4 text-white">
            <p className="mb-2">
              {isIndividualBuild 
                ? `Building ${warningDetails.buildOrder.buildType.replace('_', ' ')} will cause resource shortages that may result in starfleet destruction.`
                : 'Your current orders will cause resource shortages that may result in starfleet destruction.'
              }
            </p>
            <p className="text-red-300 font-semibold">
              {resourceImpact.starfleetDestructionCount} starfleet(s) may be destroyed due to insufficient upkeep resources.
            </p>
          </div>

          {/* Resource Impact Details */}
          <div className="mb-4">
            <h4 className="text-lg font-semibold text-yellow-400 mb-2">Resource Impact Analysis</h4>
            <div className="grid grid-cols-4 gap-4 text-sm bg-gray-700 p-3 rounded">
              <div className="text-center">
                <div className="font-semibold text-gray-300">Resource</div>
                <div className="text-white">Current</div>
                <div className="text-red-400">Build Costs</div>
                <div className="text-green-400">Income</div>
                <div className="text-red-400">Upkeep</div>
                <div className="text-yellow-400">After Turn</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-blue-400">Tech</div>
                <div>{resourceImpact.currentResources.tech}</div>
                <div>-{resourceImpact.buildCosts.tech}</div>
                <div>+{resourceImpact.income.tech}</div>
                <div>-{resourceImpact.upkeep.tech}</div>
                <div className={resourceImpact.resourcesAfterTurn.tech < 0 ? 'text-red-400' : 'text-green-400'}>
                  {resourceImpact.resourcesAfterTurn.tech}
                </div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-gray-400">Metals</div>
                <div>{resourceImpact.currentResources.metals}</div>
                <div>-{resourceImpact.buildCosts.metals}</div>
                <div>+{resourceImpact.income.metals}</div>
                <div>-{resourceImpact.upkeep.metals}</div>
                <div className={resourceImpact.resourcesAfterTurn.metals < 0 ? 'text-red-400' : 'text-green-400'}>
                  {resourceImpact.resourcesAfterTurn.metals}
                </div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-green-400">CHON</div>
                <div>{resourceImpact.currentResources.chon}</div>
                <div>-{resourceImpact.buildCosts.chon}</div>
                <div>+{resourceImpact.income.chon}</div>
                <div>-{resourceImpact.upkeep.chon}</div>
                <div className={resourceImpact.resourcesAfterTurn.chon < 0 ? 'text-red-400' : 'text-green-400'}>
                  {resourceImpact.resourcesAfterTurn.chon}
                </div>
              </div>
            </div>
          </div>

          {/* Starfleet Impact */}
          <div className="mb-4 bg-red-900 bg-opacity-30 border border-red-700 p-3 rounded">
            <h4 className="text-red-400 font-semibold mb-1">Starfleet Impact</h4>
            <p className="text-sm text-gray-200">
              Current starfleets: {resourceImpact.currentStarfleetCount}
            </p>
            {resourceImpact.newStarfleets > 0 && (
              <p className="text-sm text-blue-300">
                New starfleets from builds: +{resourceImpact.newStarfleets}
              </p>
            )}
            <p className="text-sm text-white">
              Total starfleets: {resourceImpact.totalStarfleetCount}
            </p>
            <p className="text-sm text-red-300 font-semibold">
              Starfleets at risk: {resourceImpact.starfleetDestructionCount}
            </p>
            <p className="text-sm text-yellow-300">
              Surviving starfleets: {resourceImpact.survivingStarfleets}
            </p>
          </div>

          {/* Action Buttons — Cancel is the primary path since
              proceeding risks destroying the player's own fleets;
              "Proceed Anyway" is intentionally subdued and small so
              it can't be muscle-memory-clicked. */}
          <div className="flex justify-between items-center mt-2">
            <button
              onClick={isIndividualBuild ? confirmBuildOrder : confirmOrderSubmission}
              className="proceed-anyway-btn"
              data-testid="warning-proceed-anyway-btn"
            >
              Proceed anyway
            </button>
            <button 
              onClick={isIndividualBuild ? cancelBuildOrder : cancelOrderSubmission}
              className="px-5 py-2 bg-blue-600 text-white rounded font-semibold hover:bg-blue-500"
              data-testid="warning-cancel-btn"
            >
              Cancel — Rebalance Orders
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render resource impact summary (without warnings)
  const renderResourceImpactDialog = () => {
    if (!showResourceImpact || !warningDetails || !warningDetails.resourceImpact) return null;
    
    const { resourceImpact } = warningDetails;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
          <div className="flex items-center mb-4">
            <div className="text-blue-400 mr-3 text-2xl">📊</div>
            <h3 className="text-xl font-bold text-blue-400">Turn Resource Summary</h3>
          </div>
          
          <div className="mb-4 text-white">
            <p>Review the resource impact of your orders before finalizing your turn.</p>
          </div>

          {/* Resource Impact Details */}
          <div className="mb-4">
            <div className="grid grid-cols-4 gap-4 text-sm bg-gray-700 p-3 rounded">
              <div className="text-center">
                <div className="font-semibold text-gray-300">Resource</div>
                <div className="text-white">Current</div>
                <div className="text-red-400">Build Costs</div>
                <div className="text-green-400">Income</div>
                <div className="text-red-400">Upkeep</div>
                <div className="text-yellow-400">Net Change</div>
                <div className="text-blue-400">After Turn</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-blue-400">Tech</div>
                <div>{resourceImpact.currentResources.tech}</div>
                <div>-{resourceImpact.buildCosts.tech}</div>
                <div>+{resourceImpact.income.tech}</div>
                <div>-{resourceImpact.upkeep.tech}</div>
                <div className={resourceImpact.netChange.tech >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {resourceImpact.netChange.tech >= 0 ? '+' : ''}{resourceImpact.netChange.tech}
                </div>
                <div className={resourceImpact.resourcesAfterTurn.tech < 0 ? 'text-red-400' : 'text-green-400'}>
                  {resourceImpact.resourcesAfterTurn.tech}
                </div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-gray-400">Metals</div>
                <div>{resourceImpact.currentResources.metals}</div>
                <div>-{resourceImpact.buildCosts.metals}</div>
                <div>+{resourceImpact.income.metals}</div>
                <div>-{resourceImpact.upkeep.metals}</div>
                <div className={resourceImpact.netChange.metals >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {resourceImpact.netChange.metals >= 0 ? '+' : ''}{resourceImpact.netChange.metals}
                </div>
                <div className={resourceImpact.resourcesAfterTurn.metals < 0 ? 'text-red-400' : 'text-green-400'}>
                  {resourceImpact.resourcesAfterTurn.metals}
                </div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-green-400">CHON</div>
                <div>{resourceImpact.currentResources.chon}</div>
                <div>-{resourceImpact.buildCosts.chon}</div>
                <div>+{resourceImpact.income.chon}</div>
                <div>-{resourceImpact.upkeep.chon}</div>
                <div className={resourceImpact.netChange.chon >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {resourceImpact.netChange.chon >= 0 ? '+' : ''}{resourceImpact.netChange.chon}
                </div>
                <div className={resourceImpact.resourcesAfterTurn.chon < 0 ? 'text-red-400' : 'text-green-400'}>
                  {resourceImpact.resourcesAfterTurn.chon}
                </div>
              </div>
            </div>
          </div>

          {/* Starfleet Status */}
          <div className="mb-4 bg-blue-900 bg-opacity-30 border border-blue-700 p-3 rounded">
            <h4 className="text-blue-400 font-semibold mb-1">Starfleet Status</h4>
            <p className="text-sm text-gray-200">
              Current starfleets: {resourceImpact.currentStarfleetCount}
            </p>
            {resourceImpact.newStarfleets > 0 && (
              <p className="text-sm text-green-300">
                New starfleets from builds: +{resourceImpact.newStarfleets}
              </p>
            )}
            <p className="text-sm text-white">
              Total starfleets after builds: {resourceImpact.totalStarfleetCount}
            </p>
            {resourceImpact.hasWarning && (
              <p className="text-sm text-red-300 font-semibold">
                ⚠️ {resourceImpact.starfleetDestructionCount} starfleet(s) may be destroyed due to upkeep shortfall!
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <button 
              onClick={cancelOrderSubmission}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500"
            >
              Review Orders
            </button>
            <button 
              onClick={confirmOrderSubmission}
              className={`px-4 py-2 rounded text-white ${
                resourceImpact.hasWarning 
                  ? 'bg-red-600 hover:bg-red-500' 
                  : 'bg-green-600 hover:bg-green-500'
              }`}
            >
              {resourceImpact.hasWarning ? 'Finalize Despite Risks' : 'Finalize Orders'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Resolve turn (for testing)
  const resolveTurn = async () => {
    if (!currentGame) return;

    try {
      setLoading(true);
      
      // Auto-submit pending orders for all players before resolving turn
      await autoSubmitAllPendingOrders();
      
      const response = await fetch(`${API_BASE}/api/game/${currentGame}/resolve-turn`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to resolve turn');

      alert('Turn resolved! All pending orders have been automatically submitted.');
      await loadGameState(currentGame, currentPlayer);
      await loadGamePlayers(currentGame);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit pending orders for all players (called during turn resolution)
  const autoSubmitAllPendingOrders = async () => {
    // Submit orders for all players who have pending orders
    for (const player of availablePlayers) {
      const playerId = player.id;
      
      // Check if this player has pending starfleet orders
      const playerStarfleetOrders = Object.keys(starfleetOrders).length > 0 && currentPlayer === playerId ? starfleetOrders : {};
      
      // Check if this player has pending build orders
      const currentPlayerBuildOrders = playerBuildOrders[playerId] || {};
      
      try {
        // Submit starfleet orders if any
        if (Object.keys(playerStarfleetOrders).length > 0) {
          const orders = Object.values(playerStarfleetOrders);
          await fetch(`${API_BASE}/api/game/${currentGame}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              player_id: playerId,
              orders: orders
            })
          });
        }
        
        // Submit build orders if any
        if (Object.keys(currentPlayerBuildOrders).length > 0) {
          const orders = Object.values(currentPlayerBuildOrders);
          await fetch(`${API_BASE}/api/game/${currentGame}/build-orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              player_id: playerId,
              orders: orders
            })
          });
        }
      } catch (err) {
        console.warn(`Failed to auto-submit orders for player ${playerId}:`, err);
      }
    }
    
    // Clear all pending orders after auto-submission
    setStarfleetOrders({});
    setPlayerBuildOrders({});
    setBuildOrders({});
  };

  // Get player color
  const getPlayerColor = (playerId) => {
    if (!playerId) return '#4a5568';
    const colors = ['#3182ce', '#38a169', '#d69e2e', '#e53e3e', '#805ad5', '#dd6b20'];
    const playerIndex = availablePlayers.findIndex(p => p.id === playerId);
    return colors[playerIndex % colors.length];
  };

  // Get player name
  const getPlayerName = (playerId) => {
    const player = availablePlayers.find(p => p.id === playerId);
    return player ? player.name : 'Unknown';
  };

  const getPlayerNameWithColor = (playerId) => {
    const playerName = getPlayerName(playerId);
    const playerColor = getPlayerColor(playerId);
    return { name: playerName, color: playerColor };
  };

  const handleSystemDoubleClick = (systemId) => {
    if (!gameState || !gameState.systems) return;
    
    const system = gameState.systems[systemId];
    if (system) {
      // Center map on the double-clicked system
      const viewportCenterX = 400;
      const viewportCenterY = 300;
      
      setMapPan({ 
        x: viewportCenterX - system.x * mapZoom, 
        y: viewportCenterY - system.y * mapZoom 
      });
      
      // Also select the system
      setSelectedSystem(systemId);
      setSelectedStarfleet(null);
      setShowBuildPanel(false);
    }
  };
  const centerHomeWorld = () => {
    if (!gameState || !gameState.systems || !currentPlayer) return;
    
    // Find current player's home system
    const homeSystem = Object.values(gameState.systems).find(
      system => system.is_home_system && system.owner === currentPlayer
    );
    
    if (homeSystem) {
      // Center map on home system - calculate to put home system in center of viewport
      const viewportCenterX = 400; // Half of 800px viewBox width
      const viewportCenterY = 300; // Half of 600px viewBox height
      
      // Apply zoom first, then calculate pan to center the home system
      const newZoom = 1.5;
      setMapZoom(newZoom);
      
      // Calculate pan with the new zoom applied
      setMapPan({ 
        x: viewportCenterX - homeSystem.x * newZoom, 
        y: viewportCenterY - homeSystem.y * newZoom 
      });
      
      console.log(`Centered map on ${homeSystem.name} at (${homeSystem.x}, ${homeSystem.y}) for player ${currentPlayer}`);
    } else {
      console.log(`No home system found for player ${currentPlayer}`);
    }
  };
  
  const handleMapWheel = (e) => {
    e.preventDefault();
    
    // Get mouse position relative to the SVG
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Calculate zoom factor
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    let newZoom = Math.max(0.8, Math.min(3, mapZoom * zoomFactor));
    
    // Calculate galaxy bounds to determine minimum zoom
    const systems = Object.values(gameState?.systems || {});
    if (systems.length > 0) {
      const minX = Math.min(...systems.map(s => s.x));
      const maxX = Math.max(...systems.map(s => s.x));
      const minY = Math.min(...systems.map(s => s.y));
      const maxY = Math.max(...systems.map(s => s.y));
      
      const galaxyWidth = maxX - minX;
      const galaxyHeight = maxY - minY;
      const viewportWidth = 800;
      const viewportHeight = 600;
      
      // Calculate minimum zoom to show 90% of viewport
      const minZoomX = (viewportWidth * 0.9) / galaxyWidth;
      const minZoomY = (viewportHeight * 0.9) / galaxyHeight;
      const minZoom = Math.min(minZoomX, minZoomY);
      
      // Enforce minimum zoom
      newZoom = Math.max(minZoom, newZoom);
      
      // If at minimum zoom, center the map and disable panning
      if (newZoom <= minZoom + 0.05) {
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        setMapPan({ 
          x: 400 - centerX * newZoom, 
          y: 300 - centerY * newZoom 
        });
      } else {
        // Calculate new pan to keep mouse position fixed during zoom
        const zoomDelta = newZoom / mapZoom;
        const newPanX = mouseX - (mouseX - mapPan.x) * zoomDelta;
        const newPanY = mouseY - (mouseY - mapPan.y) * zoomDelta;
        
        // Apply panning constraints
        const galaxyLeft = minX * newZoom;
        const galaxyRight = maxX * newZoom;
        const galaxyTop = minY * newZoom;
        const galaxyBottom = maxY * newZoom;
        
        const constrainedPanX = Math.max(
          400 - galaxyRight,
          Math.min(400 - galaxyLeft, newPanX)
        );
        const constrainedPanY = Math.max(
          300 - galaxyBottom,
          Math.min(300 - galaxyTop, newPanY)
        );
        
        setMapPan({ x: constrainedPanX, y: constrainedPanY });
      }
    }
    
    setMapZoom(newZoom);
  };
  
  const handleMapMouseDown = (e) => {
    // Only start dragging if not clicking on an interactive element
    if (e.target.classList.contains('system-node') || e.target.classList.contains('starfleet-node')) {
      return;
    }
    
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setPanStart({ x: mapPan.x, y: mapPan.y });
    e.preventDefault();
  };
  
  const handleMapMouseMove = (e) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    const newPanX = panStart.x + deltaX;
    const newPanY = panStart.y + deltaY;
    
    // Get viewport dimensions
    const viewportCenterX = 400; // Half of 800px viewBox width
    const viewportCenterY = 300; // Half of 600px viewBox height
    
    // Constrain panning to keep part of map visible in center
    const systems = Object.values(gameState?.systems || {});
    if (systems.length > 0) {
      const minX = Math.min(...systems.map(s => s.x));
      const maxX = Math.max(...systems.map(s => s.x));
      const minY = Math.min(...systems.map(s => s.y));
      const maxY = Math.max(...systems.map(s => s.y));
      
      // Calculate galaxy bounds in screen coordinates
      const galaxyLeft = minX * mapZoom;
      const galaxyRight = maxX * mapZoom;
      const galaxyTop = minY * mapZoom;
      const galaxyBottom = maxY * mapZoom;
      
      // Constrain so that some part of galaxy is always near center
      const constrainedPanX = Math.max(
        viewportCenterX - galaxyRight,  // Don't pan too far left
        Math.min(viewportCenterX - galaxyLeft, newPanX)  // Don't pan too far right
      );
      const constrainedPanY = Math.max(
        viewportCenterY - galaxyBottom, // Don't pan too far up
        Math.min(viewportCenterY - galaxyTop, newPanY)   // Don't pan too far down
      );
      
      setMapPan({ x: constrainedPanX, y: constrainedPanY });
    } else {
      setMapPan({ x: newPanX, y: newPanY });
    }
  };
  
  const handleMapMouseUp = () => {
    setIsDragging(false);
  };

  // Automatically select current player's home system
  const selectPlayerHomeSystem = () => {
    if (!gameState || !gameState.systems || !currentPlayer) return;
    
    // Find current player's home system
    const homeSystem = Object.values(gameState.systems).find(
      system => system.is_home_system && system.owner === currentPlayer
    );
    
    if (homeSystem) {
      setSelectedSystem(homeSystem.id);
      // Clear selected starfleet when switching systems
      setSelectedStarfleet(null);
      // Hide build panel initially
      setShowBuildPanel(false);
      console.log(`Auto-selected home system: ${homeSystem.name} for player ${currentPlayer}`);
    } else {
      console.log(`No home system found for player ${currentPlayer}`);
    }
  };

  // Auto-center home world and select home system when game loads or player switches
  React.useEffect(() => {
    if (gameState && currentPlayer && gameState.systems) {
      centerHomeWorld();
      selectPlayerHomeSystem();
      
      // Force a re-render to ensure build buttons are properly calculated
      setTimeout(() => {
        if (gameState.player_resources) {
          console.log('Player resources loaded:', gameState.player_resources);
        }
      }, 100);
    }
  }, [gameState, currentPlayer]); // Trigger when gameState or currentPlayer changes

  // Sync combat reports state when switching players
  React.useEffect(() => {
    if (currentPlayer) {
      // Reset combat reports expansion state when switching players
      setCombatReportsExpanded({});
      setSeenCombatTurns(new Set());
    }
  }, [currentPlayer]);
  React.useEffect(() => {
    if (currentPlayer) {
      const currentPlayerOrders = playerBuildOrders[currentPlayer] || {};
      setBuildOrders(currentPlayerOrders);
    }
  }, [currentPlayer, playerBuildOrders]);

  // Render galaxy map
  const renderGalaxyMap = () => {
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
  };

  // Render system details
  const renderSystemDetails = () => {
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
                    <p><strong>Owner:</strong> {getPlayerName(starfleet.owner)}</p>
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
  };

  // Render combat reports (filtered per player)
  const renderCombatReports = () => {
    if (!gameState || !gameState.combat_reports || !showCombatReports) return null;
    
    // Filter combat reports to only show those involving the current player
    const playerReports = gameState.combat_reports.filter(report => {
      // Show if current player was an attacker
      if (report.attackers && Object.keys(report.attackers).includes(currentPlayer)) {
        return true;
      }
      // Show if current player was the defender (owner of the system)
      const system = gameState.systems[report.system];
      if (system && system.owner === currentPlayer) {
        return true;
      }
      return false;
    });
    
    // Always render the turn timeline (placeholders are shown for empty turns
    // below) — this lets the panel feel alive even before any battles happen.

    // Group reports by turn
    const reportsByTurn = {};
    playerReports.forEach((report, index) => {
      const turn = report.turn || 'Unknown';
      if (!reportsByTurn[turn]) {
        reportsByTurn[turn] = [];
      }
      reportsByTurn[turn].push({ ...report, index });
    });

    // Backfill empty turns: show a "No combat this turn" row for every past
    // turn the player has lived through but had no engagements in.
    const currentTurn = gameState.turn;
    for (let t = 1; t <= currentTurn; t++) {
      if (!reportsByTurn[t]) reportsByTurn[t] = [];
    }

    const toggleTurnExpansion = (turn) => {
      setCombatReportsExpanded(prev => ({
        ...prev,
        [turn]: !prev[turn]
      }));
      
      // Mark turn as seen
      setSeenCombatTurns(prev => new Set([...prev, turn]));
    };
    
    const getOutcomeColor = (outcome, attackers, defenders, systemOwner, report) => {
      switch (outcome) {
        case 'attacker_victory':
        case 'automatic_capture':
          const winnerId = report?.winner || Object.keys(attackers)[0];
          return { color: getPlayerColor(winnerId) };
        case 'defender_victory':
          return { color: getPlayerColor(report?.winner || systemOwner) };
        case 'contested':
          return { color: '#f59e0b' }; // Amber for contested
        case 'stalemate':
          return { color: '#9ca3af' };
        default:
          return { color: '#9ca3af' };
      }
    };
    
    // Turn list used by the combat-playback navigator. All turns
    // 1..currentTurn are always available, even if the player had no
    // combats that turn — playing back the timeline should include
    // the quiet turns.
    const allTurns = Object.keys(reportsByTurn).map(Number).sort((a, b) => a - b);
    const focusedTurn = combatFocusTurn && allTurns.includes(combatFocusTurn) ? combatFocusTurn : null;
    const stepFocus = (delta) => {
      const start = focusedTurn ?? currentTurn;
      const idx = allTurns.indexOf(start);
      const nextIdx = Math.max(0, Math.min(allTurns.length - 1, idx + delta));
      const next = allTurns[nextIdx];
      setCombatFocusTurn(next);
      // Ensure the focused turn is expanded and marked seen.
      setCombatReportsExpanded(prev => ({ ...prev, [next]: true }));
      setSeenCombatTurns(prev => new Set([...prev, next]));
    };
    const clearFocus = () => setCombatFocusTurn(null);

    return (
      <div className="combat-reports-panel">
        <h4>Combat Reports</h4>

        {/* Playback navigator — jump one turn at a time so a player
            can re-live the game's fights in order. When "focused"
            on a specific turn, only that turn's reports render below.
            Clicking "All Turns" un-focuses and shows the full list. */}
        <div className="combat-playback" data-testid="combat-playback">
          <button onClick={() => stepFocus(-1)} className="combat-playback-btn"
            data-testid="combat-playback-prev-btn" title="Previous turn">⏮</button>
          <div className="combat-playback-label" data-testid="combat-playback-label">
            {focusedTurn ? `Turn ${focusedTurn}` : 'All Turns'}
          </div>
          <button onClick={() => stepFocus(1)} className="combat-playback-btn"
            data-testid="combat-playback-next-btn" title="Next turn">⏭</button>
          {focusedTurn && (
            <button onClick={clearFocus} className="combat-playback-all-btn"
              data-testid="combat-playback-all-btn" title="Show all turns">All</button>
          )}
        </div>

        {Object.entries(reportsByTurn)
          .filter(([turn]) => !focusedTurn || Number(turn) === focusedTurn)
          .sort(([a], [b]) => Number(b) - Number(a)) // Newest first
          .map(([turn, reports]) => {
            const isCurrentTurn = Number(turn) === currentTurn;
            const isSeen = seenCombatTurns.has(turn);
            const isExpanded = combatReportsExpanded[turn] !== false && (isCurrentTurn || !isSeen || focusedTurn === Number(turn));
            
            return (
              <div key={turn} className="combat-turn-section">
                <div 
                  className="turn-header cursor-pointer flex justify-between items-center p-2 bg-gray-800 rounded"
                  onClick={() => toggleTurnExpansion(turn)}
                >
                  <span className={`font-bold ${isCurrentTurn ? 'text-yellow-400' : 'text-gray-300'}`}>
                    Turn {turn} ({reports.length} battle{reports.length !== 1 ? 's' : ''})
                  </span>
                  <span>{isExpanded ? '▼' : '▶'}</span>
                </div>
                
                {isExpanded && (
                  <div className="turn-reports mt-2">
                    {reports.length === 0 && (
                      <div className="combat-report mb-2 p-3 bg-gray-900 rounded text-sm text-gray-500 italic">
                        No combat this turn.
                      </div>
                    )}
                    {reports.map(report => (
                      <div key={report.index} className="combat-report mb-4 p-3 bg-gray-900 rounded">
                        <div className="report-header">
                          <strong>Battle for {report.system}</strong>
                        </div>
                        <div className="report-details mt-2">
                          <p>
                            Outcome: <span 
                              className="font-bold"
                              style={getOutcomeColor(report.outcome, report.attackers, report.defenders, gameState.systems[report.system]?.owner, report)}
                            >
                              {report.outcome.replace(/_/g, ' ').toUpperCase()}
                            </span>
                          </p>
                          {report.outcome === 'contested' && report.contested_between && (
                            <p className="text-xs text-amber-300 mt-1">
                              Tied between: {report.contested_between.map(pid => (
                                <span key={pid} style={{ color: getPlayerColor(pid) }} className="mr-2">
                                  {getPlayerName(pid)}
                                </span>
                              ))}
                              — system left uncontrolled
                            </p>
                          )}
                          <div className="forces mt-2">
                            <div>
                              Attackers: {Object.entries(report.attackers).map(([playerId, strength]) => {
                                const bd = report.attacker_breakdown?.[playerId];
                                return (
                                  <span key={playerId} style={{ color: getPlayerColor(playerId) }} className="mr-2">
                                    {getPlayerName(playerId)}: {strength}
                                    {bd && (bd.fleets > 0 || bd.support > 0) && (
                                      <span className="text-xs opacity-80"> ({bd.fleets}F+{bd.support}S)</span>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                            <div>
                              <span style={{ color: getPlayerColor(report.defender_owner || gameState.systems[report.system]?.owner || null) }}>
                                Defenders: {report.defenders}
                                {report.defender_breakdown && (
                                  <span className="text-xs opacity-80">
                                    {' '}({report.defender_breakdown.fleets}F
                                    {report.defender_breakdown.support > 0 && `+${report.defender_breakdown.support}S`}
                                    {report.defender_breakdown.starport > 0 && `+${report.defender_breakdown.starport}P`})
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                          {(report.casualties.attackers.length > 0 || report.casualties.defenders.length > 0) && (
                            <div className="casualties mt-2">
                              {report.casualties.attackers.length > 0 && (
                                <p className="text-red-400">Attacker losses: {report.casualties.attackers.length}</p>
                              )}
                              {report.casualties.defenders.length > 0 && (
                                <p className="text-red-400">Defender losses: {report.casualties.defenders.length}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    );
  };

  // Render the game-over screen.
  //
  // Layout per user spec:
  //   1. Header: winner name + win condition label
  //   2. Score card: per-player stats (systems / fleets / upgrades)
  //   3. Action buttons for game-specific info (Full Replay)
  //   4. Subdued "Return to Home Screen" button at the very bottom,
  //      styled small + muted so it can't be accidentally clicked
  //      when reaching for the primary game-info actions above.
  //
  // Also handles the transient pre-lock banner branch (kept for the
  // brief window between check_victory returning a winner and the
  // engine locking in the same resolve_turn).
  const renderVictoryStatus = () => {
    if (!gameState) return null;
    const gameOver = gameState.game_over;
    const victory = gameState.final_victory || gameState.victory_status;
    if (!victory) return null;

    const winnerName = getPlayerName(victory.winner);
    const winnerColor = getPlayerColor(victory.winner);
    const conditionLabel = victory.condition_label ||
      (victory.condition === 'standard' ? 'Standard Victory' : 'Victory');

    if (!gameOver) {
      return (
        <div className="victory-panel" data-testid="victory-banner">
          <div className="victory-header">
            <h2>VICTORY!</h2>
          </div>
          <div className="victory-details">
            <p><strong>{winnerName}</strong> has conquered the galaxy!</p>
            <p>Systems controlled: {victory.systems_controlled}/{victory.total_systems}</p>
            <p>Required for victory: {victory.required_systems}</p>
          </div>
        </div>
      );
    }

    const scoreCard = victory.score_card || [];
    const sortedScore = [...scoreCard].sort((a, b) => {
      if (a.player_id === victory.winner) return -1;
      if (b.player_id === victory.winner) return 1;
      return (b.systems || 0) - (a.systems || 0);
    });

    return (
      <div className="game-over-overlay" data-testid="game-over-overlay" role="dialog" aria-modal="true">
        <div className="game-over-modal">
          {/* 1. Winner header */}
          <div className="game-over-header">
            <div className="game-over-eyebrow">Game Over · Turn {victory.final_turn}</div>
            <h1 style={{ color: winnerColor }} data-testid="game-over-winner-name">
              {winnerName} Wins
            </h1>
            <div className="game-over-condition" data-testid="game-over-condition">
              {conditionLabel}
            </div>
          </div>

          {/* 2. Score card */}
          <div className="game-over-scorecard" data-testid="game-over-scorecard">
            <div className="scorecard-header">
              <span>Player</span>
              <span title="Systems controlled">Systems</span>
              <span title="Starfleets remaining">Fleets</span>
              <span title="System upgrades built">Upgrades</span>
              <span title="Tech · Metals · CHON">Resources</span>
            </div>
            {sortedScore.map(row => {
              const isWinner = row.player_id === victory.winner;
              const name = getPlayerName(row.player_id);
              const color = getPlayerColor(row.player_id);
              const res = row.resources || {};
              return (
                <div
                  key={row.player_id}
                  className={`scorecard-row ${isWinner ? 'scorecard-row-winner' : ''}`}
                  data-testid={`scorecard-row-${row.player_id}`}
                >
                  <span className="scorecard-name" style={{ color }}>
                    {isWinner && <span className="winner-mark" aria-hidden="true">★</span>}
                    {name}
                  </span>
                  <span>{row.systems || 0}</span>
                  <span>{row.starfleets || 0}</span>
                  <span>{row.upgrades || 0}</span>
                  <span className="scorecard-res">
                    <span>T {res.tech ?? 0}</span>
                    <span>M {res.metals ?? 0}</span>
                    <span>C {res.chon ?? 0}</span>
                  </span>
                </div>
              );
            })}
          </div>

          {/* 3. Game-info action buttons */}
          <div className="game-over-actions-primary">
            <button
              onClick={openReplay}
              className="game-over-action-btn"
              data-testid="game-over-view-replay-btn"
            >
              View Full Replay
            </button>
          </div>

          {/* 4. Subdued exit — kept small + muted + separated so it's
              not the button you accidentally reach for while reading
              the score card. */}
          <div className="game-over-exit">
            <button
              onClick={returnToHome}
              className="game-over-exit-btn"
              data-testid="game-over-return-home-btn"
            >
              Return to Home Screen
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Full Replay viewer. Opens over the game-over screen; renders the
  // whole map at the currently-scrubbed turn snapshot (FoW-off), with
  // transport controls: ⏮ / ⏯ (play/pause) / ⏭ / turn slider.
  const renderReplayViewer = () => {
    if (!replayData) return null;
    const snapshots = replayData.snapshots || [];
    if (snapshots.length === 0) {
      return (
        <div className="replay-overlay" data-testid="replay-overlay">
          <div className="replay-shell">
            <div className="replay-empty">No turns recorded yet.</div>
            <button onClick={closeReplay} data-testid="replay-close-btn">Close</button>
          </div>
        </div>
      );
    }
    const idx = Math.min(replayTurnIdx, snapshots.length - 1);
    const frame = snapshots[idx];
    const playerMeta = replayData.players || [];
    const nameFor = pid => (playerMeta.find(p => p.id === pid)?.name) || (pid ? pid.slice(0, 6) : '—');
    const systemsList = Object.values(frame.systems || {});
    // Compute a fleet-count map per system for tiny fleet dots (we
    // stored starfleet_ids on each system in the snapshot).
    const combats = frame.combat_reports || [];

    const step = (delta) => {
      setReplayPlaying(false);
      setReplayTurnIdx(prev => {
        const next = Math.max(0, Math.min(snapshots.length - 1, prev + delta));
        return next;
      });
    };
    const togglePlay = () => {
      if (idx >= snapshots.length - 1) setReplayTurnIdx(0);
      setReplayPlaying(p => !p);
    };

    return (
      <div className="replay-overlay" data-testid="replay-overlay" role="dialog" aria-modal="true">
        <div className="replay-shell">
          <div className="replay-header">
            <div className="replay-title">Full Replay <span className="replay-fow-tag">FoW off</span></div>
            <button onClick={closeReplay} className="replay-close" data-testid="replay-close-btn">✕</button>
          </div>

          <div className="replay-map-wrap">
            <svg viewBox="0 0 800 600" className="replay-map" preserveAspectRatio="xMidYMid meet">
              <defs>
                <radialGradient id="replaySpaceGradient" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#1a202c" />
                  <stop offset="100%" stopColor="#0f0f23" />
                </radialGradient>
              </defs>
              <rect width="800" height="600" fill="url(#replaySpaceGradient)" />
              {/* Connections */}
              {systemsList.map(sys => (sys.connections || []).map(cid => {
                const c = frame.systems[cid];
                if (!c) return null;
                const [a, b] = [sys.id, cid].sort();
                return (
                  <line key={`rc-${a}-${b}`} x1={sys.x} y1={sys.y} x2={c.x} y2={c.y}
                    stroke="#4a5568" strokeWidth="1" opacity="0.6" />
                );
              }))}
              {/* Combat sparks — small red rings on systems that saw combat this turn */}
              {combats.map((cr, i) => {
                const sys = systemsList.find(s => s.name === cr.system);
                if (!sys) return null;
                return (
                  <circle key={`rcs-${i}`} cx={sys.x} cy={sys.y} r="16"
                    fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.7" strokeDasharray="3 2" />
                );
              })}
              {/* Systems */}
              {systemsList.map(sys => {
                const r = sys.is_home_system ? 12 : 8;
                const fill = sys.owner ? getPlayerColor(sys.owner) : '#334155';
                const fleetCount = (sys.starfleet_ids || []).length;
                return (
                  <g key={`rs-${sys.id}`}>
                    <circle cx={sys.x} cy={sys.y} r={r} fill={fill} stroke="#ffffff" strokeWidth={sys.is_home_system ? 2 : 1} />
                    <text x={sys.x} y={sys.y - 18} fill="#ffffff" fontSize="10" textAnchor="middle">{sys.name}</text>
                    {fleetCount > 0 && (
                      <>
                        <circle cx={sys.x + 12} cy={sys.y - 10} r="6" fill="#0f172a" stroke={fill} strokeWidth="1" />
                        <text x={sys.x + 12} y={sys.y - 7} fill="#e2e8f0" fontSize="8" textAnchor="middle" fontWeight="bold">{fleetCount}</text>
                      </>
                    )}
                    {(sys.upgrades || []).length > 0 && (
                      <text x={sys.x} y={sys.y + 22} fill="#94a3b8" fontSize="7" textAnchor="middle">
                        {sys.upgrades.map(u => u[0].toUpperCase()).join('')}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="replay-controls" data-testid="replay-controls">
            <button onClick={() => step(-1)} disabled={idx === 0}
              className="replay-btn" data-testid="replay-prev-btn" aria-label="Previous turn">⏮</button>
            <button onClick={togglePlay} className="replay-btn replay-play"
              data-testid="replay-play-btn" aria-label={replayPlaying ? 'Pause' : 'Play'}>
              {replayPlaying ? '⏸' : '▶'}
            </button>
            <button onClick={() => step(1)} disabled={idx >= snapshots.length - 1}
              className="replay-btn" data-testid="replay-next-btn" aria-label="Next turn">⏭</button>
            <input
              type="range"
              min="0"
              max={snapshots.length - 1}
              value={idx}
              onChange={(e) => { setReplayPlaying(false); setReplayTurnIdx(Number(e.target.value)); }}
              className="replay-scrubber"
              data-testid="replay-scrubber"
            />
            <div className="replay-turn-label" data-testid="replay-turn-label">
              Turn {frame.turn} <span className="replay-turn-of">of {snapshots[snapshots.length - 1].turn}</span>
            </div>
          </div>

          {combats.length > 0 && (
            <div className="replay-combat-list" data-testid="replay-combat-list">
              <div className="replay-combat-header">Combats this turn</div>
              {combats.map((cr, i) => (
                <div key={`rcl-${i}`} className="replay-combat-row">
                  <span className="replay-combat-sys">{cr.system}</span>
                  <span className={`replay-combat-outcome outcome-${cr.outcome}`}>{cr.outcome}</span>
                  <span className="replay-combat-winner">
                    {cr.winner ? nameFor(cr.winner) : (cr.contested_between ? 'contested' : '—')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };
  const renderBuildingPanel = () => {
    if (!selectedSystem || !gameState || !showBuildPanel) return null;
    
    const system = gameState.systems[selectedSystem];
    if (!system || system.owner !== currentPlayer) return null;
    
    const availableResources = calculateAvailableResources();
    const currentBuildOrders = getCurrentPlayerBuildOrders();
    
    const buildOptions = [
      {
        type: 'starfleet',
        name: 'Starfleet',
        cost: { tech: 1, metals: 1, chon: 1 },
        requirement: 'shipyard',
        canBuild: system.upgrades.includes('shipyard')
      },
      {
        type: 'starport',
        name: 'Starport',
        cost: { tech: 2, metals: 2, chon: 2 },
        requirement: null,
        canBuild: !system.upgrades.includes('starport')
      },
      {
        type: 'shipyard',
        name: 'Shipyard',
        cost: { tech: 3, metals: 3, chon: 1 },
        requirement: null,
        canBuild: !system.upgrades.includes('shipyard')
      },
      {
        type: 'colony',
        name: 'Colony',
        cost: { tech: 0, metals: 2, chon: 2 },
        requirement: null,
        canBuild: !system.upgrades.includes('colony')
      },
      {
        type: 'mining_facilities',
        name: 'Mining Facilities',
        cost: { tech: 2, metals: 2, chon: 1 },
        requirement: null,
        canBuild: !system.upgrades.includes('mining_facilities')
      },
      {
        type: 'wormhole_generator',
        name: 'Wormhole Generator',
        cost: { tech: 6, metals: 2, chon: 0 },
        requirement: null,
        canBuild: !system.upgrades.includes('wormhole_generator')
      }
    ];
    
    return (
      <div className="building-panel">
        <h4>Construction</h4>
        <p>Build in: {system.name}</p>
        <p>Available after pending orders: T:{availableResources.tech} M:{availableResources.metals} C:{availableResources.chon}</p>
        
        <div className="build-options">
          {buildOptions.map(option => {
            const canAfford = availableResources.tech >= option.cost.tech &&
                             availableResources.metals >= option.cost.metals &&
                             availableResources.chon >= option.cost.chon;
            
            const isDisabled = !option.canBuild || !canAfford;
            
            // Check if requirement is missing (only show "Requires" when NOT met)
            const missingRequirement = option.requirement && !system.upgrades.includes(option.requirement);
            
            return (
              <div key={option.type} className="build-option">
                <div className="build-info">
                  <strong>{option.name}</strong>
                  <div className="build-cost">
                    Cost: T:{option.cost.tech} M:{option.cost.metals} C:{option.cost.chon}
                  </div>
                  {missingRequirement && (
                    <div className="build-requirement">
                      Requires: {option.requirement}
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => issueBuildOrder(option.type, selectedSystem)}
                  disabled={isDisabled && !currentBuildOrders[`${selectedSystem}_${option.type}`]}
                  className={`build-btn ${isDisabled && !currentBuildOrders[`${selectedSystem}_${option.type}`] ? 'disabled' : ''} ${currentBuildOrders[`${selectedSystem}_${option.type}`] ? 'selected' : ''}`}
                >
                  {currentBuildOrders[`${selectedSystem}_${option.type}`] ? 'Cancel' : 'Build'}
                </button>
              </div>
            );
          })}
        </div>
        
        {Object.keys(currentBuildOrders).length > 0 && (
          <div className="build-queue">
            <p>{Object.keys(currentBuildOrders).length} build orders pending</p>
          </div>
        )}
      </div>
    );
  };
  const renderOrdersPanel = () => {
    if (!selectedStarfleet || !gameState || !selectedSystem) return null;
    
    const starfleet = gameState.systems[selectedSystem]?.starfleet_details?.find(
      sf => sf.id === selectedStarfleet
    );
    
    if (!starfleet || starfleet.owner !== currentPlayer) return null;
    
    // Get current order for this starfleet
    const currentOrder = starfleetOrders[selectedStarfleet];
    const currentOrderType = currentOrder?.order_type || 'defend';
    
    const system = gameState.systems[selectedSystem];
    const connections = system.connections || [];

    return (
      <div className="orders-panel">
        <h4>Starfleet Orders</h4>
        <p>Starfleet in: {system.name}</p>
        
        <div className="order-buttons">
          <button 
            onClick={() => issueStarfleetOrder('defend')}
            className={`order-btn defend-btn ${currentOrderType === 'defend' ? 'selected' : ''}`}
          >
            Defend System
          </button>
          
          {connections.map(connId => {
            const connSystem = gameState.systems[connId];
            if (!connSystem) return null;
            
            const isSelected = currentOrderType === 'move' && currentOrder?.target_system === connId;
            
            return (
              <button
                key={connId}
                onClick={() => {
                  // If clicking the same move order, act like Defend System
                  if (isSelected) {
                    issueStarfleetOrder('defend');
                  } else {
                    issueStarfleetOrder('move', connId);
                  }
                }}
                className={`order-btn move-btn ${isSelected ? 'selected' : ''}`}
              >
                Move to {connSystem.name}
              </button>
            );
          })}
        </div>

        {connections.length > 0 && (
          <div className="support-section">
            <p>Support Actions:</p>
            {connections.map(connId => {
              const connSystem = gameState.systems[connId];
              if (!connSystem) return null;
              
              const isSelected = currentOrderType === 'support' && currentOrder?.target_system === connId;
              
              return (
                <button
                  key={`support_${connId}`}
                  onClick={() => {
                    // If clicking the same support order, act like Defend System
                    if (isSelected) {
                      issueStarfleetOrder('defend');
                    } else {
                      issueStarfleetOrder('support', connId);
                    }
                  }}
                  className={`order-btn support-btn ${isSelected ? 'selected' : ''}`}
                >
                  Support {connSystem.name}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const shareUrl = () => {
    try {
      return `${window.location.origin}${window.location.pathname}?game=${currentGame}`;
    } catch (e) { return currentGame || ''; }
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl());
      setCopiedFlag(true);
      setTimeout(() => setCopiedFlag(false), 1500);
    } catch (e) { setError('Could not copy — link is: ' + shareUrl()); }
  };

  const copyGameCode = async () => {
    try {
      await navigator.clipboard.writeText(currentGame);
      setCopiedFlag(true);
      setTimeout(() => setCopiedFlag(false), 1500);
    } catch (e) { setError('Could not copy — code is: ' + currentGame); }
  };

  const renderLobby = () => {
    const capacity = gameState?.config?.num_players || 2;
    const joined = availablePlayers.length;
    const isHost = availablePlayers.length > 0 && availablePlayers[0].id === currentPlayer;
    const link = shareUrl();
    return (
      <div className="App">
        <div className="main-menu">
          <div className="menu-background"></div>
          <div className="menu-content" style={{ minWidth: 480 }}>
            <h1 className="game-title">Consilium Mundi</h1>
            <p className="game-subtitle">Lobby — waiting for players</p>

            <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '1rem', margin: '1rem 0', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Game Code</div>
                  <div style={{ fontFamily: 'monospace', color: '#f8fafc', fontSize: 14, wordBreak: 'break-all' }} data-testid="lobby-game-code">{currentGame}</div>
                </div>
                <button onClick={copyGameCode} className="create-game-btn" style={{ padding: '0.5rem 0.75rem', width: 'auto' }} data-testid="lobby-copy-code">
                  {copiedFlag ? 'Copied ✓' : 'Copy Code'}
                </button>
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Share Link</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input readOnly value={link} className="player-name-input" style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }} data-testid="lobby-share-link" />
                  <button onClick={copyShareLink} className="create-game-btn" style={{ padding: '0.5rem 0.75rem', width: 'auto' }} data-testid="lobby-copy-link">Copy</button>
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'left', margin: '0.5rem 0 1rem 0' }}>
              <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Players ({joined} / {capacity})</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} data-testid="lobby-player-list">
                {availablePlayers.map(p => (
                  <li key={p.id} style={{ padding: '6px 10px', margin: '4px 0', background: 'rgba(255,255,255,0.04)', borderRadius: 8, color: getPlayerColor(p.id) }}>
                    {p.name}{p.id === currentPlayer ? ' (you)' : ''}
                  </li>
                ))}
                {Array.from({ length: Math.max(0, capacity - joined) }).map((_, i) => (
                  <li key={`empty-${i}`} style={{ padding: '6px 10px', margin: '4px 0', background: 'rgba(255,255,255,0.02)', borderRadius: 8, color: '#64748b', fontStyle: 'italic' }}>
                    Empty slot
                  </li>
                ))}
              </ul>
            </div>

            {isHost ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => startGame(true)}
                  disabled={loading}
                  className="create-game-btn"
                  style={{ flex: 1 }}
                  data-testid="lobby-start-with-ai"
                >
                  {loading ? 'Starting…' : (joined < capacity ? 'Start Now (fill with AI)' : 'Start Game')}
                </button>
              </div>
            ) : (
              <div style={{ color: '#94a3b8', fontStyle: 'italic', padding: '0.5rem 0' }}>
                Waiting for host to start…
              </div>
            )}

            {error && <div className="error-message">{error}</div>}
          </div>
        </div>
      </div>
    );
  };

  if (!currentGame) {
    return (
      <div className="App">
        <div className="main-menu">
          <div className="menu-background"></div>
          <div className="menu-content" style={{ minWidth: 460 }}>
            <h1 className="game-title">Consilium Mundi</h1>
            <p className="game-subtitle">A Game of Interstellar Commerce, Diplomacy and Warfare</p>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, margin: '1.25rem 0 1rem 0' }}>
              <button
                onClick={() => setLandingMode('create')}
                className="create-game-btn"
                style={{ flex: 1, background: landingMode === 'create' ? undefined : 'rgba(255,255,255,0.06)', color: landingMode === 'create' ? undefined : '#cbd5e1' }}
                data-testid="landing-tab-create"
              >
                Create Game
              </button>
              <button
                onClick={() => setLandingMode('join')}
                className="create-game-btn"
                style={{ flex: 1, background: landingMode === 'join' ? undefined : 'rgba(255,255,255,0.06)', color: landingMode === 'join' ? undefined : '#cbd5e1' }}
                data-testid="landing-tab-join"
              >
                Join Game
              </button>
            </div>

            <div className="create-game-form">
              <input
                type="text"
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="player-name-input"
                data-testid="landing-player-name"
              />

              {landingMode === 'create' ? (
                <>
                  <label style={{ display: 'block', textAlign: 'left', color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, margin: '0.5rem 0 0.25rem 2px' }}>
                    Players in this game
                  </label>
                  <select
                    value={numPlayersConfig}
                    onChange={(e) => setNumPlayersConfig(parseInt(e.target.value, 10))}
                    className="player-name-input"
                    data-testid="landing-num-players"
                  >
                    <option value={2}>2 players</option>
                    <option value={3}>3 players</option>
                    <option value={4}>4 players</option>
                  </select>
                  <label style={{ display: 'block', textAlign: 'left', color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, margin: '0.75rem 0 0.25rem 2px' }}>
                    Turn timer (auto-resolves at zero)
                  </label>
                  <select
                    value={turnSecondsConfig}
                    onChange={(e) => setTurnSecondsConfig(parseInt(e.target.value, 10))}
                    className="player-name-input"
                    data-testid="landing-turn-timer"
                  >
                    <option value={120}>2 minutes</option>
                    <option value={300}>5 minutes (recommended)</option>
                    <option value={600}>10 minutes</option>
                    <option value={900}>15 minutes</option>
                    <option value={1800}>30 minutes</option>
                  </select>
                  <label style={{ display: 'block', textAlign: 'left', color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, margin: '0.75rem 0 0.25rem 2px' }}>
                    Fog of War
                  </label>
                  <select
                    value={fowModeConfig}
                    onChange={(e) => setFowModeConfig(e.target.value)}
                    className="player-name-input"
                    data-testid="landing-fow-mode"
                  >
                    <option value="basic">Basic — reveal 1 jump from owned systems</option>
                    <option value="off">Off — full galaxy visible (demo/dev)</option>
                  </select>
                  <button
                    onClick={createGame}
                    disabled={loading}
                    className="create-game-btn"
                    data-testid="landing-create-btn"
                  >
                    {loading ? 'Creating Galaxy…' : 'Create New Game'}
                  </button>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Paste game code from your host"
                    value={joinGameId}
                    onChange={(e) => setJoinGameId(e.target.value)}
                    className="player-name-input"
                    style={{ fontFamily: 'monospace' }}
                    data-testid="landing-join-code"
                  />
                  <button
                    onClick={joinGame}
                    disabled={loading}
                    className="create-game-btn"
                    data-testid="landing-join-btn"
                  >
                    {loading ? 'Joining…' : 'Join Game'}
                  </button>
                </>
              )}
            </div>

            {error && <div className="error-message" data-testid="landing-error">{error}</div>}
          </div>
        </div>
      </div>
    );
  }

  // In a game but not yet in activity phase → show lobby
  if (gameState && gameState.phase && gameState.phase !== 'activity') {
    return renderLobby();
  }

  return (
    <div className="App">
      <div className="game-interface">
        {/* Header */}
        <div className="game-header">
          <div className="game-info">
            <h2>Consilium Mundi</h2>
            <span className="turn-info">
              Turn {gameState?.turn} - {gameState?.phase}
              {gameState?.player_resources && (
                <span className="resources-info">
                  | T:{gameState.player_resources.tech} M:{gameState.player_resources.metals} C:{gameState.player_resources.chon}
                </span>
              )}
            </span>
            {secondsRemaining !== null && gameState?.phase === 'activity' && (() => {
              const mm = String(Math.floor(secondsRemaining / 60)).padStart(2, '0');
              const ss = String(secondsRemaining % 60).padStart(2, '0');
              const paused = !!gameState.turn_paused;
              const urgent = !paused && secondsRemaining <= 30;
              return (
                <span
                  data-testid="turn-timer"
                  title={paused ? 'Turn timer paused by host' : 'Turn auto-resolves when this hits zero'}
                  style={{
                    marginLeft: 12,
                    padding: '2px 10px',
                    fontFamily: 'monospace',
                    fontSize: 13,
                    borderRadius: 999,
                    background: paused ? 'rgba(148,163,184,0.15)' : (urgent ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)'),
                    color: paused ? '#cbd5e1' : (urgent ? '#fca5a5' : '#e2e8f0'),
                    border: `1px solid ${paused ? 'rgba(148,163,184,0.4)' : (urgent ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.15)')}`,
                    animation: urgent ? 'pulse 1s ease-in-out infinite' : 'none',
                  }}
                >
                  {paused ? '⏸ PAUSED' : '⏱'} {mm}:{ss}
                </span>
              );
            })()}
            {/* Host-only timer controls */}
            {gameState?.phase === 'activity' && availablePlayers.length > 0 && availablePlayers[0].id === currentPlayer && (
              <span style={{ marginLeft: 8, display: 'inline-flex', gap: 6 }} data-testid="host-timer-controls">
                {gameState.turn_paused ? (
                  <button
                    onClick={() => controlTimer('resume')}
                    className="center-home-btn"
                    style={{ padding: '2px 10px', fontSize: 12 }}
                    data-testid="timer-resume"
                    title="Resume the turn timer"
                  >
                    ▶ Resume
                  </button>
                ) : (
                  <button
                    onClick={() => controlTimer('pause')}
                    className="center-home-btn"
                    style={{ padding: '2px 10px', fontSize: 12 }}
                    data-testid="timer-pause"
                    title="Pause the turn timer"
                  >
                    ⏸ Pause
                  </button>
                )}
                <button
                  onClick={() => controlTimer('extend', 120)}
                  className="center-home-btn"
                  style={{ padding: '2px 10px', fontSize: 12 }}
                  data-testid="timer-extend"
                  title="Add 2 minutes to the current turn timer"
                >
                  +2 min
                </button>
              </span>
            )}
          </div>

          {/* Shareable game-code chip (visible to all players in-game) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.06)', padding: '4px 8px', borderRadius: 999, fontSize: 12 }}>
            <span style={{ color: '#94a3b8' }}>Code:</span>
            <span style={{ fontFamily: 'monospace', color: '#f8fafc' }} data-testid="game-code-chip">
              {currentGame ? currentGame.slice(0, 8) : ''}
            </span>
            <button
              onClick={copyShareLink}
              style={{ padding: '2px 8px', fontSize: 11, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0', borderRadius: 999, cursor: 'pointer' }}
              data-testid="game-code-copy"
              title="Copy shareable join link"
            >
              {copiedFlag ? '✓' : 'Copy link'}
            </button>
          </div>
          
          {/* Always-visible game controls (available to every player) */}
          <div className="testing-controls">
            {testingMode && (
              <>
                <label>Testing Mode:</label>
                <select
                  value={currentPlayer || ''}
                  onChange={(e) => switchPlayer(e.target.value)}
                  className="player-selector"
                  data-testid="header-player-selector"
                >
                  {availablePlayers.map(player => (
                    <option key={player.id} value={player.id} style={{ color: getPlayerColor(player.id) }}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </>
            )}

            {gameState?.phase === 'activity' && (
              <button onClick={resolveTurn} className="resolve-turn-btn" data-testid="header-resolve-turn">
                Resolve Turn
              </button>
            )}

            {gameState?.phase === 'activity' && currentPlayer && (() => {
              const readySet = gameState.ready_players || [];
              const iAmReady = readySet.includes(currentPlayer);
              const total = (gameState.players || []).length || (availablePlayers?.length || 0);
              return (
                <button
                  onClick={() => setReady(!iAmReady)}
                  className="resolve-turn-btn"
                  data-testid="header-ready-btn"
                  title="Mark yourself ready — turn resolves when everyone is"
                  style={{
                    background: iAmReady ? 'linear-gradient(135deg, #16a34a, #15803d)' : undefined,
                  }}
                >
                  {iAmReady ? '✓ Ready' : 'Ready'} ({readySet.length}/{total})
                </button>
              );
            })()}

            {gameState?.combat_reports && gameState.combat_reports.length > 0 && (
              <button
                onClick={() => setShowCombatReports(!showCombatReports)}
                className="combat-reports-btn"
                data-testid="header-combat-reports"
              >
                Combat Reports ({gameState.combat_reports.length})
              </button>
            )}

            {gameState?.phase === 'activity' && (
              <button
                onClick={() => setShowDiplomacy(true)}
                className="combat-reports-btn"
                data-testid="header-diplomacy-btn"
                title="Open the diplomatic pouch — templated offers, alliances, trades"
              >
                Diplomacy{(() => {
                  const th = gameState?.kernel?.threads || [];
                  const unread = th.reduce((n, t) => n + t.messages.filter((m) => m.toPlayerId === currentPlayer && !m.read).length, 0);
                  return unread ? ` (${unread})` : '';
                })()}
              </button>
            )}

            <button
              onClick={centerHomeWorld}
              className="center-home-btn"
              title="Center map on your home world"
              data-testid="header-center-home"
            >
              Center Home
            </button>

            <button
              onClick={() => setTestingMode(m => !m)}
              className="center-home-btn"
              title="Toggle solo testing (switch between all players in this game)"
              data-testid="header-toggle-testing"
              style={{ opacity: 0.6 }}
            >
              {testingMode ? 'Exit Solo' : 'Solo Mode'}
            </button>
          </div>
        </div>

        {/* Main game area */}
        <div className="game-main">
          {/* Victory overlay */}
          {renderVictoryStatus()}
          {/* Full Replay viewer (over game-over) */}
          {renderReplayViewer()}
          {/* Diplomatic pouch */}
          {showDiplomacy && (
            <DiplomacyPouch
              apiBase={API_BASE}
              gameId={currentGame}
              me={currentPlayer}
              gameState={gameState}
              playersMeta={availablePlayers}
              onClose={() => setShowDiplomacy(false)}
              reload={async () => {
                await loadGameState(currentGame, currentPlayer);
                await loadGamePlayers(currentGame);
              }}
            />
          )}
          
          <div className="galaxy-section">
            {renderGalaxyMap()}
          </div>
          
          <div className="info-panel">
            {renderSystemDetails()}
            {renderBuildingPanel()}
            {renderCombatReports()}
            {renderOrdersPanel()}
            {renderOrderSummary()}
            
            {(Object.keys(starfleetOrders).length > 0 || Object.keys(getCurrentPlayerBuildOrders()).length > 0) && (
              <div className="global-submit-section">
                <div className="order-actions">
                  <button 
                    onClick={() => setShowOrderSummary(true)}
                    className="order-summary-btn"
                  >
                    Review Orders ({Object.keys(starfleetOrders).length + Object.keys(getCurrentPlayerBuildOrders()).length})
                  </button>
                  <button onClick={submitAllOrders} className="submit-all-orders-btn">
                    Finalize Orders
                  </button>
                </div>
              </div>
            )}
            
            {gameState && (
              <div className="game-status">
                <h4>Players</h4>
                <ul>
                  {availablePlayers.map(player => (
                    <li 
                      key={player.id} 
                      className={currentPlayer === player.id ? 'current-player' : ''}
                      style={{ color: getPlayerColor(player.id) }}
                    >
                      {player.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {error && <div className="error-message">{error}</div>}
          </div>
        </div>
        
        {/* Dialog overlays */}
        {renderResourceWarningDialog()}
        {renderResourceImpactDialog()}
      </div>
    </div>
  );
}

export default App;