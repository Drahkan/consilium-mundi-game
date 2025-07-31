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
      const response = await fetch(`${API_BASE}/api/game/${gameId}/state`);
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
  };

  // Handle system click
  const handleSystemClick = (systemId) => {
    setSelectedSystem(systemId);
  };

  // Get player color
  const getPlayerColor = (playerId) => {
    if (!playerId) return '#4a5568';
    const colors = ['#3182ce', '#38a169', '#d69e2e', '#e53e3e', '#805ad5', '#dd6b20'];
    const playerIndex = availablePlayers.findIndex(p => p.id === playerId);
    return colors[playerIndex % colors.length];
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
              
              {/* Starfleet indicator */}
              {system.starfleets > 0 && (
                <circle
                  cx={system.x + 10}
                  cy={system.y - 10}
                  r="4"
                  fill="#ffd700"
                  stroke="#ffffff"
                  strokeWidth="1"
                />
              )}
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
              ? availablePlayers.find(p => p.id === system.owner)?.name || 'Unknown'
              : 'Uncontrolled'
          }</p>
          <p><strong>Resources per turn:</strong></p>
          <ul>
            <li>Tech: {system.resources.tech}</li>
            <li>Metals: {system.resources.metals}</li>
            <li>CHON: {system.resources.chon}</li>
          </ul>
          <p><strong>Starfleets:</strong> {system.starfleets}</p>
          <p><strong>Upgrades:</strong> {system.upgrades.length}</p>
          {system.is_home_system && <p className="home-system-badge">Home System</p>}
        </div>
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
            <span className="turn-info">Turn {gameState?.turn} - {gameState?.phase}</span>
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
            </div>
          )}
        </div>

        {/* Main game area */}
        <div className="game-main">
          <div className="galaxy-section">
            {renderGalaxyMap()}
          </div>
          
          <div className="info-panel">
            {renderSystemDetails()}
            
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
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;