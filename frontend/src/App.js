import React, { useState, useEffect } from 'react';
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
  const [starfleetOrders, setStarfleetOrders] = useState({});
  const [buildOrders, setBuildOrders] = useState({});
  const [showBuildPanel, setShowBuildPanel] = useState(false);
  const [showCombatReports, setShowCombatReports] = useState(false);
  const [combatReportsExpanded, setCombatReportsExpanded] = useState({});
  const [seenCombatTurns, setSeenCombatTurns] = useState(new Set());
  const [showOrderSummary, setShowOrderSummary] = useState(false);

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
            num_players: 4,
            galaxy_size: "standard",
            turn_time_limit: 24
          }
        })
      });

      if (!response.ok) throw new Error('Failed to create game');

      const data = await response.json();
      setCurrentGame(data.game_id);
      setCurrentPlayer(data.player_id);
      setTestingMode(true);
      
      // Load game state
      await loadGameState(data.game_id);
      await loadGamePlayers(data.game_id);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load game state
  const loadGameState = async (gameId) => {
    try {
      const response = await fetch(`${API_BASE}/api/game/${gameId}/state?player_id=${currentPlayer}`);
      if (!response.ok) throw new Error('Failed to load game state');
      
      const data = await response.json();
      setGameState(data);
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

  // Issue starfleet order
  const issueStarfleetOrder = (orderType, targetSystem = null, supportTarget = null) => {
    if (!selectedStarfleet) return;

    const newOrders = { ...starfleetOrders };
    newOrders[selectedStarfleet] = {
      starfleet_id: selectedStarfleet,
      order_type: orderType,
      target_system: targetSystem,
      support_target: supportTarget
    };
    
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

  // Calculate available resources after pending build orders
  const calculateAvailableResources = () => {
    if (!gameState || !gameState.player_resources) return { tech: 0, metals: 0, chon: 0 };
    
    const currentResources = { ...gameState.player_resources };
    
    // Subtract costs of pending build orders
    Object.values(buildOrders).forEach(order => {
      const buildType = order.build_type;
      const buildOptions = [
        { type: 'starfleet', cost: { tech: 1, metals: 1, chon: 1 } },
        { type: 'starport', cost: { tech: 2, metals: 2, chon: 2 } },
        { type: 'shipyard', cost: { tech: 3, metals: 3, chon: 1 } },
        { type: 'colony', cost: { tech: 0, metals: 2, chon: 2 } },
        { type: 'mining_facilities', cost: { tech: 2, metals: 2, chon: 1 } },
        { type: 'wormhole_generator', cost: { tech: 6, metals: 2, chon: 0 } }
      ];
      
      const option = buildOptions.find(opt => opt.type === buildType);
      if (option) {
        currentResources.tech -= option.cost.tech;
        currentResources.metals -= option.cost.metals;
        currentResources.chon -= option.cost.chon;
      }
    });
    
    return currentResources;
  };

  // Render order summary window
  const renderOrderSummary = () => {
    if (!showOrderSummary || !gameState) return null;
    
    const movementOrders = Object.values(starfleetOrders);
    const pendingBuildOrders = Object.values(buildOrders);
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
                    <div key={index} className="text-sm text-gray-300 bg-gray-700 p-2 rounded">
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
                    <div key={index} className="text-sm text-gray-300 bg-gray-700 p-2 rounded">
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

  // Issue build order
  const issueBuildOrder = (buildType, systemId) => {
    const newOrders = { ...buildOrders };
    const orderId = `${systemId}_${buildType}`;
    
    // If this build order already exists, remove it (toggle behavior)
    if (newOrders[orderId]) {
      delete newOrders[orderId];
      setBuildOrders(newOrders);
      return;
    }

    // Check if player can afford this build order
    const availableResources = calculateAvailableResources();
    const buildCosts = {
      'starfleet': { tech: 1, metals: 1, chon: 1 },
      'starport': { tech: 2, metals: 2, chon: 2 },
      'shipyard': { tech: 3, metals: 3, chon: 1 },
      'colony': { tech: 0, metals: 2, chon: 2 },
      'mining_facilities': { tech: 2, metals: 2, chon: 1 },
      'wormhole_generator': { tech: 6, metals: 2, chon: 0 }
    };
    
    const cost = buildCosts[buildType];
    if (cost && (
      availableResources.tech < cost.tech ||
      availableResources.metals < cost.metals ||
      availableResources.chon < cost.chon
    )) {
      // Can't afford this build order
      return;
    }

    // Add the build order
    newOrders[orderId] = {
      type: "build",
      build_type: buildType,
      system_id: systemId
    };
    
    setBuildOrders(newOrders);
  };

  // Submit build orders
  const submitBuildOrders = async () => {
    if (!currentGame || !currentPlayer) return;

    try {
      const orders = Object.values(buildOrders);
      
      const response = await fetch(`${API_BASE}/api/game/${currentGame}/build-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: currentPlayer,
          orders: orders
        })
      });

      if (!response.ok) throw new Error('Failed to submit build orders');

      setBuildOrders({});
      alert('Build orders submitted successfully!');
      
    } catch (err) {
      setError(err.message);
    }
  };

  // Submit all orders (both movement and build)
  const submitAllOrders = async () => {
    const movementCount = Object.keys(starfleetOrders).length;
    const buildCount = Object.keys(buildOrders).length;
    
    if (movementCount === 0 && buildCount === 0) {
      alert('No orders to submit!');
      return;
    }
    
    // Order confirmation popup
    const confirmationMessage = `Are you sure you want to finalize your turn?\n\n` +
      `${movementCount} movement orders and ${buildCount} build orders will be submitted.\n` +
      `This will end your turn and you cannot make changes until the next turn.`;
    
    if (!window.confirm(confirmationMessage)) {
      return;
    }
    
    let success = true;
    
    try {
      // Submit starfleet orders first
      if (Object.keys(starfleetOrders).length > 0) {
        await submitOrders();
      }
      
      // Submit build orders
      if (Object.keys(buildOrders).length > 0) {
        await submitBuildOrders();
      }
      
      if (success) {
        alert(`Turn finalized for ${getPlayerName(currentPlayer)}!`);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Resolve turn (for testing)
  const resolveTurn = async () => {
    if (!currentGame) return;

    try {
      const response = await fetch(`${API_BASE}/api/game/${currentGame}/resolve-turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('Failed to resolve turn');

      // Reload game state
      await loadGameState(currentGame);
      alert('Turn resolved!');
      
    } catch (err) {
      setError(err.message);
    }
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

  // Render galaxy map
  const renderGalaxyMap = () => {
    if (!gameState || !gameState.systems) return null;

    const systems = Object.values(gameState.systems);
    
    return (
      <div className="galaxy-container">
        <svg 
          className="galaxy-map" 
          viewBox="0 0 800 600"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Background */}
          <defs>
            <radialGradient id="spaceGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1a202c" />
              <stop offset="100%" stopColor="#0f0f23" />
            </radialGradient>
          </defs>
          <rect width="800" height="600" fill="url(#spaceGradient)" />
          
          {/* Draw connections first */}
          {systems.map(system => 
            system.connections.map(connId => {
              const connSystem = gameState.systems[connId];
              if (!connSystem) return null;
              
              return (
                <line
                  key={`${system.id}-${connId}`}
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
          
          {/* Draw systems */}
          {systems.map(system => (
            <g key={system.id}>
              {/* System circle */}
              <circle
                cx={system.x}
                cy={system.y}
                r={system.is_home_system ? "12" : "8"}
                fill={getPlayerColor(system.owner)}
                stroke={selectedSystem === system.id ? "#ffd700" : "#ffffff"}
                strokeWidth={selectedSystem === system.id ? "3" : system.is_home_system ? "2" : "1"}
                className="system-node"
                onClick={() => handleSystemClick(system.id)}
                style={{ cursor: 'pointer' }}
              />
              
              {/* System name */}
              <text
                x={system.x}
                y={system.y - 18}
                fill="#ffffff"
                fontSize="10"
                textAnchor="middle"
                className="system-label"
              >
                {system.name}
              </text>
              
              {/* Resource indicators */}
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
              
              {/* Starfleet indicators */}
              {system.starfleet_details && system.starfleet_details.map((starfleet, index) => (
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
          ))}
        </svg>
      </div>
    );
  };

  // Render system details
  const renderSystemDetails = () => {
    if (!selectedSystem || !gameState) return null;
    
    const system = gameState.systems[selectedSystem];
    if (!system) return null;
    
    return (
      <div className="system-details">
        <h3>{system.name}</h3>
        <div className="system-info">
          <p><strong>Owner:</strong> {
            system.owner 
              ? getPlayerName(system.owner)
              : 'Uncontrolled'
          }</p>
          <p><strong>Resources per turn:</strong></p>
          <ul>
            <li>Tech: {system.resources.tech}</li>
            <li>Metals: {system.resources.metals}</li>
            <li>CHON: {system.resources.chon}</li>
          </ul>
          <p><strong>Starfleets:</strong> {system.starfleets}</p>
          <p><strong>Upgrades:</strong> {system.upgrades.join(', ') || 'None'}</p>
          {system.is_home_system && <p className="home-system-badge">Home System</p>}
          
          {/* Show starfleet details */}
          {system.starfleet_details && system.starfleet_details.length > 0 && (
            <div className="starfleet-section">
              <h4>Starfleets:</h4>
              {system.starfleet_details.map(starfleet => (
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
                </div>
              ))}
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

  // Render combat reports
  const renderCombatReports = () => {
    if (!gameState || !gameState.combat_reports || !showCombatReports) return null;
    
    // Group reports by turn
    const reportsByTurn = {};
    gameState.combat_reports.forEach((report, index) => {
      const turn = report.turn || 'Unknown';
      if (!reportsByTurn[turn]) {
        reportsByTurn[turn] = [];
      }
      reportsByTurn[turn].push({ ...report, index });
    });
    
    // Auto-expand current turn, collapse seen turns
    const currentTurn = gameState.turn;
    
    const toggleTurnExpansion = (turn) => {
      setCombatReportsExpanded(prev => ({
        ...prev,
        [turn]: !prev[turn]
      }));
      
      // Mark turn as seen
      setSeenCombatTurns(prev => new Set([...prev, turn]));
    };
    
    const getOutcomeColor = (outcome) => {
      switch (outcome) {
        case 'attacker_victory': return 'text-red-400';
        case 'defender_victory': return 'text-blue-400';
        case 'stalemate': return 'text-yellow-400';
        case 'automatic_capture': return 'text-green-400';
        default: return 'text-gray-400';
      }
    };
    
    return (
      <div className="combat-reports-panel">
        <h4>Combat Reports</h4>
        {Object.entries(reportsByTurn)
          .sort(([a], [b]) => Number(b) - Number(a)) // Newest first
          .map(([turn, reports]) => {
            const isCurrentTurn = Number(turn) === currentTurn;
            const isSeen = seenCombatTurns.has(turn);
            const isExpanded = combatReportsExpanded[turn] !== false && (isCurrentTurn || !isSeen);
            
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
                    {reports.map(report => (
                      <div key={report.index} className="combat-report mb-4 p-3 bg-gray-900 rounded">
                        <div className="report-header">
                          <strong>Battle for {report.system}</strong>
                        </div>
                        <div className="report-details mt-2">
                          <p>
                            Outcome: <span className={`font-bold ${getOutcomeColor(report.outcome)}`}>
                              {report.outcome.replace('_', ' ').toUpperCase()}
                            </span>
                          </p>
                          <div className="forces mt-2">
                            <div>
                              Attackers: {Object.entries(report.attackers).map(([playerId, strength]) => (
                                <span key={playerId} style={{ color: getPlayerColor(playerId) }} className="mr-2">
                                  {getPlayerName(playerId)}: {strength}
                                </span>
                              ))}
                            </div>
                            <div>
                              <span style={{ color: getPlayerColor(gameState.systems[report.system]?.owner || null) }}>
                                Defenders: {report.defenders}
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

  // Render victory status
  const renderVictoryStatus = () => {
    if (!gameState || !gameState.victory_status) return null;
    
    const victory = gameState.victory_status;
    const winnerName = getPlayerName(victory.winner);
    
    return (
      <div className="victory-panel">
        <div className="victory-header">
          <h2>🏆 VICTORY! 🏆</h2>
        </div>
        <div className="victory-details">
          <p><strong>{winnerName}</strong> has conquered the galaxy!</p>
          <p>Systems controlled: {victory.systems_controlled}/{victory.total_systems}</p>
          <p>Required for victory: {victory.required_systems}</p>
        </div>
      </div>
    );
  };
  const renderBuildingPanel = () => {
    if (!selectedSystem || !gameState || !showBuildPanel) return null;
    
    const system = gameState.systems[selectedSystem];
    if (!system || system.owner !== currentPlayer) return null;
    
    const availableResources = calculateAvailableResources();
    
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
                  disabled={isDisabled}
                  className={`build-btn ${isDisabled ? 'disabled' : ''} ${buildOrders[`${selectedSystem}_${option.type}`] ? 'selected' : ''}`}
                >
                  {buildOrders[`${selectedSystem}_${option.type}`] ? 'Cancel' : 'Build'}
                </button>
              </div>
            );
          })}
        </div>
        
        {Object.keys(buildOrders).length > 0 && (
          <div className="build-queue">
            <p>{Object.keys(buildOrders).length} build orders pending</p>
          </div>
        )}
      </div>
    );
  };
  const renderOrdersPanel = () => {
    if (!selectedStarfleet || !gameState || !selectedSystem) return null;
    
    const system = gameState.systems[selectedSystem];
    const starfleet = system.starfleet_details.find(sf => sf.id === selectedStarfleet);
    
    if (!starfleet || starfleet.owner !== currentPlayer) return null;
    
    return (
      <div className="orders-panel">
        <h4>Starfleet Orders</h4>
        <p>Selected: {starfleet.id}</p>
        
        <div className="order-buttons">
          <button 
            onClick={() => issueStarfleetOrder('hold')}
            className="order-btn hold-btn"
          >
            Hold Position
          </button>
          
          <div className="move-section">
            <p>Move to:</p>
            {system.connections.map(connId => {
              const connSystem = gameState.systems[connId];
              return (
                <button
                  key={connId}
                  onClick={() => issueStarfleetOrder('move', connId)}
                  className="order-btn move-btn"
                >
                  {connSystem.name}
                </button>
              );
            })}
          </div>

          <div className="support-section">
            <p>Support attacks on:</p>
            {system.connections.map(connId => {
              const connSystem = gameState.systems[connId];
              return (
                <button
                  key={`support_${connId}`}
                  onClick={() => issueStarfleetOrder('support', connId)}
                  className="order-btn support-btn"
                >
                  Support → {connSystem.name}
                </button>
              );
            })}
          </div>
        </div>
        
        {Object.keys(starfleetOrders).length > 0 && (
          <div className="submit-section">
            <p>{Object.keys(starfleetOrders).length} movement orders pending</p>
            <button onClick={submitOrders} className="submit-orders-btn">
              Submit Movement Orders
            </button>
          </div>
        )}
      </div>
    );
  };

  if (!currentGame) {
    return (
      <div className="App">
        <div className="main-menu">
          <div className="menu-background"></div>
          <div className="menu-content">
            <h1 className="game-title">Consilium Mundi</h1>
            <p className="game-subtitle">A Game of Interstellar Commerce, Diplomacy and Warfare</p>
            
            <div className="create-game-form">
              <input
                type="text"
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="player-name-input"
              />
              
              <button 
                onClick={createGame}
                disabled={loading}
                className="create-game-btn"
              >
                {loading ? 'Creating Galaxy...' : 'Create New Game'}
              </button>
            </div>
            
            {error && <div className="error-message">{error}</div>}
          </div>
        </div>
      </div>
    );
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
          </div>
          
          {/* Testing controls */}
          {testingMode && (
            <div className="testing-controls">
              <label>Testing Mode:</label>
              <select 
                value={currentPlayer || ''} 
                onChange={(e) => switchPlayer(e.target.value)}
                className="player-selector"
              >
                {availablePlayers.map(player => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
              
              {availablePlayers.length === 1 && (
                <button onClick={addAIPlayers} className="add-ai-btn">
                  Add AI Players
                </button>
              )}
              
              {gameState?.phase === 'activity' && (
                <button onClick={resolveTurn} className="resolve-turn-btn">
                  Resolve Turn
                </button>
              )}
              
              {gameState?.combat_reports && gameState.combat_reports.length > 0 && (
                <button 
                  onClick={() => setShowCombatReports(!showCombatReports)} 
                  className="combat-reports-btn"
                >
                  Combat Reports ({gameState.combat_reports.length})
                </button>
              )}
            </div>
          )}
        </div>

        {/* Main game area */}
        <div className="game-main">
          {/* Victory overlay */}
          {renderVictoryStatus()}
          
          <div className="galaxy-section">
            {renderGalaxyMap()}
          </div>
          
          <div className="info-panel">
            {renderSystemDetails()}
            {renderBuildingPanel()}
            {renderCombatReports()}
            {renderOrdersPanel()}
            
            {(Object.keys(starfleetOrders).length > 0 || Object.keys(buildOrders).length > 0) && (
              <div className="global-submit-section">
                <p>
                  {Object.keys(starfleetOrders).length} movement orders, {Object.keys(buildOrders).length} build orders pending
                </p>
                <button onClick={submitAllOrders} className="submit-all-orders-btn">
                  Finalize Orders
                </button>
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
      </div>
    </div>
  );
}

export default App;