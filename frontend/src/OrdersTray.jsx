import React from 'react';
import EspionagePanel from './EspionagePanel';

// Orders tray. Extracted from App.js for Grok's App.js split (kernel v4).
// Owns the three render helpers `renderBuildingPanel`, `renderOrdersPanel`,
// `renderOrderSummary`, plus the Espionage panel per ui-reference/ESPIONAGE.md.
// Kernel field names are preserved verbatim (systems / owner /
// starfleet_details / target_system / support_target / build_type /
// order_type / player_resources).
//
// State is App-local; every setter and helper is passed as a prop.

export default function OrdersTray({
  gameState,
  currentPlayer,
  starfleetOrders,
  selectedStarfleet,
  selectedSystem,
  showBuildPanel,
  showOrderSummary,
  setShowOrderSummary,
  handleOrderClick,
  issueStarfleetOrder,
  issueBuildOrder,
  submitAllOrders,
  getCurrentPlayerBuildOrders,
  calculateAvailableResources,
  // Espionage — kernel v4. Panel hangs off the currently-selected system
  // (per ui-reference/ESPIONAGE.md). All 4 fields optional so the panel
  // stays hidden when the host has not wired espionage yet.
  espionageQueue,
  onScheduleEspionage,
  onCancelEspionage,
  onConfirmHostileEspionage,
}) {
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

  const selectedSystemObj =
    selectedSystem && gameState?.systems ? gameState.systems[selectedSystem] : null;
  const currentTech = gameState?.player_resources?.tech ?? 0;

  return (
    <>
      {renderBuildingPanel()}
      {renderOrdersPanel()}
      {onScheduleEspionage && selectedSystemObj && (
        <EspionagePanel
          system={selectedSystemObj}
          queued={espionageQueue || []}
          tech={currentTech}
          onSchedule={onScheduleEspionage}
          onCancel={onCancelEspionage || (() => {})}
          confirmHostile={onConfirmHostileEspionage}
        />
      )}
      {showOrderSummary && renderOrderSummary()}
    </>
  );
}
