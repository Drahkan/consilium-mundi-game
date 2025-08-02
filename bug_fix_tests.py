import requests
import sys
import json
from datetime import datetime

class BugFixTester:
    def __init__(self, base_url="https://1bc598af-b8b5-494f-b21a-848ca019a707.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.game_id = None
        self.player_ids = []
        self.test_results = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def setup_test_game(self):
        """Create a game with multiple players for testing"""
        print("\n🎮 Setting up test game with multiple players...")
        
        # Create game
        success, response = self.run_test(
            "Create Test Game",
            "POST",
            "api/create-game",
            200,
            data={
                "player_name": "Player Alpha",
                "config": {
                    "num_players": 4,
                    "galaxy_size": "standard",
                    "turn_time_limit": 24
                }
            }
        )
        
        if not success:
            return False
        
        self.game_id = response['game_id']
        self.player_ids.append(response['player_id'])
        print(f"   Game ID: {self.game_id}")
        print(f"   Player 1 ID: {response['player_id']}")
        
        # Add 3 more players
        player_names = ["Player Beta", "Player Gamma", "Player Delta"]
        for name in player_names:
            success, response = self.run_test(
                f"Add {name}",
                "POST",
                "api/join-game",
                200,
                data={
                    "player_name": name,
                    "game_id": self.game_id
                }
            )
            
            if not success:
                return False
            
            self.player_ids.append(response['player_id'])
            print(f"   {name} ID: {response['player_id']}")
        
        print(f"✅ Game setup complete with {len(self.player_ids)} players")
        return True

    def test_chon_collection_bug_fix(self):
        """Test 1: CHON Collection Test - Verify resources are properly collected each turn"""
        print("\n" + "="*60)
        print("🧪 TEST 1: CHON COLLECTION BUG FIX")
        print("="*60)
        
        if not self.game_id or not self.player_ids:
            print("❌ No game setup available")
            return False
        
        # Get initial game state for all players
        success, initial_state = self.run_test(
            "Get Initial Game State",
            "GET",
            f"api/game/{self.game_id}/state",
            200
        )
        
        if not success:
            return False
        
        # Record initial CHON values for each player
        initial_resources = {}
        for player_id in self.player_ids:
            player_resources = initial_state.get('player_resources', {}).get(player_id, {})
            initial_resources[player_id] = {
                'tech': player_resources.get('tech', 0),
                'metals': player_resources.get('metals', 0),
                'chon': player_resources.get('chon', 0)
            }
            print(f"   Player {player_id[:8]}... initial resources: {initial_resources[player_id]}")
        
        # Calculate expected resource generation per turn for each player
        expected_generation = {}
        for player_id in self.player_ids:
            expected_generation[player_id] = {'tech': 0, 'metals': 0, 'chon': 0}
            
            # Count resources from owned systems
            for system_id, system in initial_state.get('systems', {}).items():
                if system.get('owner') == player_id:
                    sys_resources = system.get('resources', {})
                    expected_generation[player_id]['tech'] += sys_resources.get('tech', 0)
                    expected_generation[player_id]['metals'] += sys_resources.get('metals', 0)
                    expected_generation[player_id]['chon'] += sys_resources.get('chon', 0)
                    
                    # Add upgrade bonuses
                    upgrades = system.get('upgrades', [])
                    if "colony" in upgrades:
                        expected_generation[player_id]['tech'] += 1
                    if "mining_facilities" in upgrades:
                        expected_generation[player_id]['metals'] += 1
                        expected_generation[player_id]['chon'] += 1
            
            print(f"   Player {player_id[:8]}... expected per turn: {expected_generation[player_id]}")
        
        # Add some build orders for different players to test resource consumption
        print("\n   Adding build orders for players...")
        
        # Player 1: Try to build a starport
        player1_systems = [s_id for s_id, s in initial_state.get('systems', {}).items() 
                          if s.get('owner') == self.player_ids[0]]
        if player1_systems:
            success, response = self.run_test(
                "Player 1 Build Orders",
                "POST",
                f"api/game/{self.game_id}/build-orders",
                200,
                data={
                    "player_id": self.player_ids[0],
                    "orders": [{
                        "type": "build",
                        "build_type": "starport",
                        "system_id": player1_systems[0]
                    }]
                }
            )
            if success:
                print(f"   ✅ Player 1 submitted starport build order")
        
        # Player 2: Try to build a starfleet (if they have a shipyard)
        player2_systems = [s_id for s_id, s in initial_state.get('systems', {}).items() 
                          if s.get('owner') == self.player_ids[1] and "shipyard" in s.get('upgrades', [])]
        if player2_systems:
            success, response = self.run_test(
                "Player 2 Build Orders",
                "POST",
                f"api/game/{self.game_id}/build-orders",
                200,
                data={
                    "player_id": self.player_ids[1],
                    "orders": [{
                        "type": "build",
                        "build_type": "starfleet",
                        "system_id": player2_systems[0]
                    }]
                }
            )
            if success:
                print(f"   ✅ Player 2 submitted starfleet build order")
        
        # Test resource accumulation over multiple turns
        print("\n   Testing resource accumulation over 3 turns...")
        
        for turn in range(3):
            print(f"\n   --- Turn {turn + 1} ---")
            
            # Resolve turn
            success, response = self.run_test(
                f"Resolve Turn {turn + 1}",
                "POST",
                f"api/game/{self.game_id}/resolve-turn",
                200
            )
            
            if not success:
                print(f"❌ Failed to resolve turn {turn + 1}")
                return False
            
            # Get updated game state
            success, updated_state = self.run_test(
                f"Get State After Turn {turn + 1}",
                "GET",
                f"api/game/{self.game_id}/state",
                200
            )
            
            if not success:
                return False
            
            # Verify resource accumulation for each player
            all_players_correct = True
            for player_id in self.player_ids:
                current_resources = updated_state.get('player_resources', {}).get(player_id, {})
                
                # Calculate minimum expected resources (accounting for upkeep and builds)
                min_expected = {
                    'tech': initial_resources[player_id]['tech'] + ((turn + 1) * expected_generation[player_id]['tech']) - 10,  # Allow for upkeep/builds
                    'metals': initial_resources[player_id]['metals'] + ((turn + 1) * expected_generation[player_id]['metals']) - 10,
                    'chon': initial_resources[player_id]['chon'] + ((turn + 1) * expected_generation[player_id]['chon']) - 10
                }
                
                print(f"   Player {player_id[:8]}... current: Tech:{current_resources.get('tech', 0)}, Metals:{current_resources.get('metals', 0)}, CHON:{current_resources.get('chon', 0)}")
                
                # Check if resources are accumulating (not being replaced)
                if (current_resources.get('chon', 0) < max(0, min_expected['chon']) or
                    current_resources.get('tech', 0) < max(0, min_expected['tech']) or
                    current_resources.get('metals', 0) < max(0, min_expected['metals'])):
                    print(f"   ❌ Player {player_id[:8]}... resources not accumulating properly")
                    all_players_correct = False
                else:
                    print(f"   ✅ Player {player_id[:8]}... resources accumulating correctly")
            
            if not all_players_correct:
                print(f"❌ CHON collection bug still present on turn {turn + 1}")
                return False
        
        print("\n✅ CHON COLLECTION BUG FIX: PASSED")
        print("   - Resources properly accumulate each turn")
        print("   - Resources are not replaced but added to existing pools")
        print("   - Multiple players all show correct accumulation")
        return True

    def test_auto_submit_orders_bug_fix(self):
        """Test 2: Auto-submit Orders Test - Verify pending orders are automatically submitted"""
        print("\n" + "="*60)
        print("🧪 TEST 2: AUTO-SUBMIT ORDERS BUG FIX")
        print("="*60)
        
        if not self.game_id or not self.player_ids:
            print("❌ No game setup available")
            return False
        
        # Get current game state
        success, game_state = self.run_test(
            "Get Game State for Orders",
            "GET",
            f"api/game/{self.game_id}/state",
            200
        )
        
        if not success:
            return False
        
        # Create starfleet movement orders for some players
        print("\n   Creating starfleet movement orders...")
        movement_orders_created = 0
        
        for i, player_id in enumerate(self.player_ids[:2]):  # Test with first 2 players
            # Find player's starfleets and valid moves
            player_starfleets = []
            for system_id, system in game_state.get('systems', {}).items():
                if system.get('owner') == player_id:
                    for starfleet in system.get('starfleet_details', []):
                        if starfleet.get('owner') == player_id:
                            player_starfleets.append({
                                'id': starfleet['id'],
                                'system_id': system_id,
                                'connections': system.get('connections', [])
                            })
            
            # Create movement orders
            orders = []
            for starfleet in player_starfleets[:1]:  # One starfleet per player
                if starfleet['connections']:
                    orders.append({
                        "starfleet_id": starfleet['id'],
                        "order_type": "move",
                        "target_system": starfleet['connections'][0]
                    })
            
            if orders:
                success, response = self.run_test(
                    f"Player {i+1} Movement Orders",
                    "POST",
                    f"api/game/{self.game_id}/orders",
                    200,
                    data={
                        "player_id": player_id,
                        "orders": orders
                    }
                )
                
                if success:
                    movement_orders_created += 1
                    print(f"   ✅ Player {i+1} submitted {len(orders)} movement orders")
        
        # Create build orders for some players
        print("\n   Creating build orders...")
        build_orders_created = 0
        
        for i, player_id in enumerate(self.player_ids[2:], 3):  # Test with last 2 players
            # Find player's owned systems
            player_systems = [s_id for s_id, s in game_state.get('systems', {}).items() 
                            if s.get('owner') == player_id]
            
            if player_systems:
                # Try to build a colony (cheaper option)
                orders = [{
                    "type": "build",
                    "build_type": "colony",
                    "system_id": player_systems[0]
                }]
                
                success, response = self.run_test(
                    f"Player {i} Build Orders",
                    "POST",
                    f"api/game/{self.game_id}/build-orders",
                    200,
                    data={
                        "player_id": player_id,
                        "orders": orders
                    }
                )
                
                if success:
                    build_orders_created += 1
                    print(f"   ✅ Player {i} submitted {len(orders)} build orders")
        
        print(f"\n   Total orders created: {movement_orders_created} movement, {build_orders_created} build")
        
        if movement_orders_created == 0 and build_orders_created == 0:
            print("❌ No orders could be created for testing")
            return False
        
        # Record pre-resolution state
        print("\n   Recording pre-resolution state...")
        
        # Check starfleet positions before resolution
        pre_resolution_positions = {}
        for system_id, system in game_state.get('systems', {}).items():
            for starfleet in system.get('starfleet_details', []):
                pre_resolution_positions[starfleet['id']] = system_id
        
        # Check system upgrades before resolution
        pre_resolution_upgrades = {}
        for system_id, system in game_state.get('systems', {}).items():
            pre_resolution_upgrades[system_id] = system.get('upgrades', []).copy()
        
        print(f"   Recorded {len(pre_resolution_positions)} starfleet positions")
        print(f"   Recorded upgrades for {len(pre_resolution_upgrades)} systems")
        
        # Resolve turn WITHOUT manually finalizing orders first
        print("\n   🔥 CRITICAL TEST: Resolving turn WITHOUT manual order finalization...")
        
        success, response = self.run_test(
            "Auto-Submit Orders Turn Resolution",
            "POST",
            f"api/game/{self.game_id}/resolve-turn",
            200
        )
        
        if not success:
            print("❌ Turn resolution failed")
            return False
        
        print("   ✅ Turn resolved successfully")
        
        # Get post-resolution state
        success, post_state = self.run_test(
            "Get Post-Resolution State",
            "GET",
            f"api/game/{self.game_id}/state",
            200
        )
        
        if not success:
            return False
        
        # Verify that movement orders were automatically processed
        print("\n   Verifying movement orders were auto-processed...")
        movements_processed = 0
        
        for system_id, system in post_state.get('systems', {}).items():
            for starfleet in system.get('starfleet_details', []):
                starfleet_id = starfleet['id']
                old_position = pre_resolution_positions.get(starfleet_id)
                
                if old_position and old_position != system_id:
                    movements_processed += 1
                    print(f"   ✅ Starfleet {starfleet_id[:8]}... moved from {old_position} to {system_id}")
        
        # Verify that build orders were automatically processed
        print("\n   Verifying build orders were auto-processed...")
        builds_processed = 0
        
        for system_id, system in post_state.get('systems', {}).items():
            old_upgrades = set(pre_resolution_upgrades.get(system_id, []))
            new_upgrades = set(system.get('upgrades', []))
            
            if new_upgrades - old_upgrades:  # New upgrades added
                builds_processed += 1
                added_upgrades = new_upgrades - old_upgrades
                print(f"   ✅ System {system_id}: built {', '.join(added_upgrades)}")
        
        # Check for new starfleets (harder to track, but check starfleet counts)
        total_starfleets_before = sum(len(s.get('starfleet_details', [])) for s in game_state.get('systems', {}).values())
        total_starfleets_after = sum(len(s.get('starfleet_details', [])) for s in post_state.get('systems', {}).values())
        
        if total_starfleets_after > total_starfleets_before:
            new_starfleets = total_starfleets_after - total_starfleets_before
            builds_processed += new_starfleets
            print(f"   ✅ {new_starfleets} new starfleets built")
        
        # Verify auto-submission worked
        total_processed = movements_processed + builds_processed
        
        if total_processed == 0:
            print("❌ No orders were automatically processed during turn resolution")
            return False
        
        print(f"\n✅ AUTO-SUBMIT ORDERS BUG FIX: PASSED")
        print(f"   - {movements_processed} movement orders auto-processed")
        print(f"   - {builds_processed} build orders auto-processed")
        print(f"   - Total {total_processed} orders automatically submitted and executed")
        return True

    def test_map_centering_logic(self):
        """Test 3: Map Centering Test - Test improved centering logic (backend validation)"""
        print("\n" + "="*60)
        print("🧪 TEST 3: MAP CENTERING LOGIC (Backend Validation)")
        print("="*60)
        
        if not self.game_id or not self.player_ids:
            print("❌ No game setup available")
            return False
        
        # Get game state to analyze map structure
        success, game_state = self.run_test(
            "Get Game State for Map Analysis",
            "GET",
            f"api/game/{self.game_id}/state",
            200
        )
        
        if not success:
            return False
        
        # Analyze map structure and home system positions
        print("\n   Analyzing map structure...")
        
        systems = game_state.get('systems', {})
        home_systems = []
        all_systems = []
        
        for system_id, system in systems.items():
            system_data = {
                'id': system_id,
                'name': system.get('name', ''),
                'x': system.get('x', 0),
                'y': system.get('y', 0),
                'owner': system.get('owner'),
                'is_home': system.get('is_home_system', False)
            }
            
            all_systems.append(system_data)
            if system_data['is_home']:
                home_systems.append(system_data)
        
        print(f"   Total systems: {len(all_systems)}")
        print(f"   Home systems: {len(home_systems)}")
        
        # Calculate map bounds
        if all_systems:
            min_x = min(s['x'] for s in all_systems)
            max_x = max(s['x'] for s in all_systems)
            min_y = min(s['y'] for s in all_systems)
            max_y = max(s['y'] for s in all_systems)
            
            map_center_x = (min_x + max_x) / 2
            map_center_y = (min_y + max_y) / 2
            
            print(f"   Map bounds: X({min_x:.1f} to {max_x:.1f}), Y({min_y:.1f} to {max_y:.1f})")
            print(f"   Map center: ({map_center_x:.1f}, {map_center_y:.1f})")
        
        # Test centering logic for each player's home system
        print("\n   Testing home system centering for each player...")
        
        centering_tests_passed = 0
        
        for i, player_id in enumerate(self.player_ids):
            # Find player's home system
            player_home = None
            for home_system in home_systems:
                if home_system['owner'] == player_id:
                    player_home = home_system
                    break
            
            if not player_home:
                print(f"   ❌ Player {i+1}: No home system found")
                continue
            
            print(f"   Player {i+1} home system: {player_home['name']} at ({player_home['x']:.1f}, {player_home['y']:.1f})")
            
            # Validate home system position is reasonable
            # Home systems should be distributed around the map, not all at center
            distance_from_center = ((player_home['x'] - map_center_x)**2 + (player_home['y'] - map_center_y)**2)**0.5
            
            if distance_from_center > 50:  # Should be reasonably distributed
                print(f"   ✅ Player {i+1}: Home system properly positioned (distance from center: {distance_from_center:.1f})")
                centering_tests_passed += 1
            else:
                print(f"   ❌ Player {i+1}: Home system too close to center (distance: {distance_from_center:.1f})")
        
        # Test that home systems are not overlapping
        print("\n   Testing home system separation...")
        
        separation_tests_passed = 0
        for i, home1 in enumerate(home_systems):
            for j, home2 in enumerate(home_systems[i+1:], i+1):
                distance = ((home1['x'] - home2['x'])**2 + (home1['y'] - home2['y'])**2)**0.5
                
                if distance > 100:  # Minimum separation
                    separation_tests_passed += 1
                    print(f"   ✅ Home systems {i+1} and {j+1}: Good separation ({distance:.1f})")
                else:
                    print(f"   ❌ Home systems {i+1} and {j+1}: Too close ({distance:.1f})")
        
        # Test map boundary constraints
        print("\n   Testing map boundary constraints...")
        
        boundary_tests_passed = 0
        for system in all_systems:
            # Systems should be within reasonable bounds (not at edges)
            if (50 <= system['x'] <= 750 and 50 <= system['y'] <= 550):
                boundary_tests_passed += 1
        
        boundary_percentage = (boundary_tests_passed / len(all_systems)) * 100
        print(f"   ✅ {boundary_tests_passed}/{len(all_systems)} systems ({boundary_percentage:.1f}%) within proper boundaries")
        
        # Overall centering logic validation
        min_required_centering = len(self.player_ids) - 1  # Allow one failure
        min_required_separation = max(1, len(home_systems) * (len(home_systems) - 1) // 2 - 1)  # Allow one failure
        
        if (centering_tests_passed >= min_required_centering and 
            separation_tests_passed >= min_required_separation and
            boundary_percentage >= 80):
            
            print(f"\n✅ MAP CENTERING LOGIC: PASSED")
            print(f"   - {centering_tests_passed}/{len(self.player_ids)} home systems properly positioned")
            print(f"   - {separation_tests_passed} home system pairs properly separated")
            print(f"   - {boundary_percentage:.1f}% of systems within proper boundaries")
            print("   - Map generation follows improved centering logic")
            return True
        else:
            print(f"\n❌ MAP CENTERING LOGIC: FAILED")
            print(f"   - Only {centering_tests_passed}/{len(self.player_ids)} home systems properly positioned")
            print(f"   - Only {separation_tests_passed} home system pairs properly separated")
            print(f"   - Only {boundary_percentage:.1f}% of systems within proper boundaries")
            return False

    def run_all_bug_fix_tests(self):
        """Run all three bug fix tests"""
        print("🚀 Starting Bug Fix Validation Tests")
        print("="*80)
        
        # Setup test game
        if not self.setup_test_game():
            print("❌ Failed to setup test game")
            return False
        
        # Run the three specific bug fix tests
        test_results = []
        
        # Test 1: CHON Collection
        result1 = self.test_chon_collection_bug_fix()
        test_results.append(("CHON Collection Bug Fix", result1))
        
        # Test 2: Auto-submit Orders
        result2 = self.test_auto_submit_orders_bug_fix()
        test_results.append(("Auto-submit Orders Bug Fix", result2))
        
        # Test 3: Map Centering
        result3 = self.test_map_centering_logic()
        test_results.append(("Map Centering Logic", result3))
        
        # Print final results
        print("\n" + "="*80)
        print("📊 BUG FIX TEST RESULTS")
        print("="*80)
        
        passed_tests = 0
        for test_name, result in test_results:
            status = "✅ PASSED" if result else "❌ FAILED"
            print(f"{status}: {test_name}")
            if result:
                passed_tests += 1
        
        print(f"\n🎯 Overall Result: {passed_tests}/{len(test_results)} bug fixes validated")
        
        if passed_tests == len(test_results):
            print("🎉 All bug fixes are working correctly!")
            return True
        else:
            print("⚠️  Some bug fixes need attention")
            return False

def main():
    tester = BugFixTester()
    success = tester.run_all_bug_fix_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())