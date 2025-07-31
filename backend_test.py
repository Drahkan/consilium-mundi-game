import requests
import sys
import json
from datetime import datetime

class ConsiliumMundiAPITester:
    def __init__(self, base_url="https://1bc598af-b8b5-494f-b21a-848ca019a707.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.game_id = None
        self.player_id = None
        self.ai_player_ids = []

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
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
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

    def test_root_endpoint(self):
        """Test the root endpoint"""
        success, response = self.run_test(
            "Root Endpoint",
            "GET",
            "",
            200
        )
        return success

    def test_create_game(self):
        """Test game creation"""
        success, response = self.run_test(
            "Create Game",
            "POST",
            "api/create-game",
            200,
            data={
                "player_name": "Test Player",
                "config": {
                    "num_players": 4,
                    "galaxy_size": "standard",
                    "turn_time_limit": 24
                }
            }
        )
        
        if success and 'game_id' in response and 'player_id' in response:
            self.game_id = response['game_id']
            self.player_id = response['player_id']
            print(f"   Game ID: {self.game_id}")
            print(f"   Player ID: {self.player_id}")
            return True
        return False

    def test_get_game_state(self):
        """Test getting game state"""
        if not self.game_id:
            print("❌ No game ID available for testing")
            return False
            
        success, response = self.run_test(
            "Get Game State",
            "GET",
            f"api/game/{self.game_id}/state",
            200
        )
        
        if success:
            # Validate game state structure
            required_fields = ['turn', 'phase', 'systems', 'players', 'config']
            for field in required_fields:
                if field not in response:
                    print(f"❌ Missing required field: {field}")
                    return False
            
            # Check if systems were generated
            systems = response.get('systems', {})
            if len(systems) == 0:
                print("❌ No systems generated")
                return False
            
            print(f"   Generated {len(systems)} systems")
            
            # Check for home systems
            home_systems = [s for s in systems.values() if s.get('is_home_system')]
            print(f"   Found {len(home_systems)} home systems")
            
            # Check resource distribution
            resource_systems = [s for s in systems.values() if 
                               s.get('resources', {}).get('tech', 0) > 0 or
                               s.get('resources', {}).get('metals', 0) > 0 or
                               s.get('resources', {}).get('chon', 0) > 0]
            print(f"   Found {len(resource_systems)} systems with resources")
            
            return True
        return False

    def test_get_game_players(self):
        """Test getting game players"""
        if not self.game_id:
            print("❌ No game ID available for testing")
            return False
            
        success, response = self.run_test(
            "Get Game Players",
            "GET",
            f"api/game/{self.game_id}/players",
            200
        )
        
        if success and 'players' in response:
            players = response['players']
            print(f"   Found {len(players)} players")
            return True
        return False

    def test_join_game(self):
        """Test joining a game with AI players"""
        if not self.game_id:
            print("❌ No game ID available for testing")
            return False
        
        ai_names = ['Admiral Zara', 'Commander Vex', 'Captain Nova']
        
        for ai_name in ai_names:
            success, response = self.run_test(
                f"Join Game - {ai_name}",
                "POST",
                "api/join-game",
                200,
                data={
                    "player_name": ai_name,
                    "game_id": self.game_id
                }
            )
            
            if success and 'player_id' in response:
                self.ai_player_ids.append(response['player_id'])
                print(f"   AI Player ID: {response['player_id']}")
            else:
                return False
        
        return True

    def test_submit_action(self):
        """Test submitting a player action"""
        if not self.game_id or not self.player_id:
            print("❌ No game ID or player ID available for testing")
            return False
            
        success, response = self.run_test(
            "Submit Action",
            "POST",
            f"api/game/{self.game_id}/action",
            200,
            data={
                "player_id": self.player_id,
                "game_id": self.game_id,
                "action_type": "test_action",
                "action_data": {"test": "data"}
            }
        )
        
        return success

    def test_list_games(self):
        """Test listing all games"""
        success, response = self.run_test(
            "List Games",
            "GET",
            "api/games",
            200
        )
        
        if success and 'games' in response:
            games = response['games']
            print(f"   Found {len(games)} active games")
            return True
        return False

    def test_game_state_after_full_game(self):
        """Test game state after all players have joined"""
        if not self.game_id:
            print("❌ No game ID available for testing")
            return False
            
        success, response = self.run_test(
            "Get Game State After Full Game",
            "GET",
            f"api/game/{self.game_id}/state",
            200
        )
        
        if success:
            # Check if game phase changed to 'activity' after all players joined
            phase = response.get('phase')
            print(f"   Game phase: {phase}")
            
            # Check if starfleets were created
            systems = response.get('systems', {})
            systems_with_starfleets = [s for s in systems.values() if s.get('starfleets', 0) > 0]
            print(f"   Systems with starfleets: {len(systems_with_starfleets)}")
            
            # Check if home systems have owners
            home_systems = [s for s in systems.values() if s.get('is_home_system')]
            owned_home_systems = [s for s in home_systems if s.get('owner')]
            print(f"   Owned home systems: {len(owned_home_systems)}/{len(home_systems)}")
            
            return True
        return False

    def test_starfleet_orders(self):
        """Test submitting starfleet movement orders"""
        if not self.game_id or not self.player_id:
            print("❌ No game ID or player ID available for testing")
            return False
        
        # First get game state to find our starfleets
        success, game_state = self.run_test(
            "Get Game State for Orders",
            "GET",
            f"api/game/{self.game_id}/state?player_id={self.player_id}",
            200
        )
        
        if not success:
            return False
        
        # Find our starfleets and connected systems
        our_starfleets = []
        for system_id, system in game_state.get('systems', {}).items():
            if system.get('owner') == self.player_id:
                for starfleet in system.get('starfleet_details', []):
                    if starfleet.get('owner') == self.player_id:
                        our_starfleets.append({
                            'id': starfleet['id'],
                            'system_id': system_id,
                            'connections': system.get('connections', [])
                        })
        
        if not our_starfleets:
            print("❌ No starfleets found for player")
            return False
        
        # Create movement orders
        orders = []
        for starfleet in our_starfleets[:1]:  # Test with first starfleet
            if starfleet['connections']:
                orders.append({
                    "starfleet_id": starfleet['id'],
                    "order_type": "move",
                    "target_system": starfleet['connections'][0]
                })
        
        if not orders:
            print("❌ No valid movement orders could be created")
            return False
        
        success, response = self.run_test(
            "Submit Starfleet Orders",
            "POST",
            f"api/game/{self.game_id}/orders",
            200,
            data={
                "player_id": self.player_id,
                "orders": orders
            }
        )
        
        return success

    def test_build_orders(self):
        """Test submitting build orders"""
        if not self.game_id or not self.player_id:
            print("❌ No game ID or player ID available for testing")
            return False
        
        # Get game state to find our systems
        success, game_state = self.run_test(
            "Get Game State for Building",
            "GET",
            f"api/game/{self.game_id}/state?player_id={self.player_id}",
            200
        )
        
        if not success:
            return False
        
        # Find our owned systems
        our_systems = []
        for system_id, system in game_state.get('systems', {}).items():
            if system.get('owner') == self.player_id:
                our_systems.append(system_id)
        
        if not our_systems:
            print("❌ No owned systems found for player")
            return False
        
        # Create build orders
        orders = [
            {
                "type": "build",
                "build_type": "starfleet",
                "system_id": our_systems[0]
            }
        ]
        
        success, response = self.run_test(
            "Submit Build Orders",
            "POST",
            f"api/game/{self.game_id}/build-orders",
            200,
            data={
                "player_id": self.player_id,
                "orders": orders
            }
        )
        
        return success

    def test_espionage_orders(self):
        """Test submitting espionage orders"""
        if not self.game_id or not self.player_id:
            print("❌ No game ID or player ID available for testing")
            return False
        
        # Get game state to find target systems
        success, game_state = self.run_test(
            "Get Game State for Espionage",
            "GET",
            f"api/game/{self.game_id}/state?player_id={self.player_id}",
            200
        )
        
        if not success:
            return False
        
        # Find enemy systems adjacent to our systems
        our_systems = [s_id for s_id, s in game_state.get('systems', {}).items() if s.get('owner') == self.player_id]
        target_systems = []
        
        for our_system_id in our_systems:
            our_system = game_state['systems'][our_system_id]
            for conn_id in our_system.get('connections', []):
                conn_system = game_state['systems'].get(conn_id)
                if conn_system and conn_system.get('owner') and conn_system.get('owner') != self.player_id:
                    target_systems.append(conn_id)
                    break
        
        if not target_systems:
            print("❌ No valid espionage targets found")
            return False
        
        # Create espionage orders
        orders = [
            {
                "espionage_type": "sabotage",
                "target_system": target_systems[0]
            }
        ]
        
        success, response = self.run_test(
            "Submit Espionage Orders",
            "POST",
            f"api/game/{self.game_id}/espionage-orders",
            200,
            data={
                "player_id": self.player_id,
                "orders": orders
            }
        )
        
        return success

    def test_combat_reports(self):
        """Test combat reports system with turn information"""
        if not self.game_id or not self.player_id:
            print("❌ No game ID or player ID available for testing")
            return False
        
        print("\n🔍 Testing Combat Reports System...")
        
        # Test 1: Create a combat scenario by moving starfleets
        success, game_state = self.run_test(
            "Get Game State for Combat Setup",
            "GET",
            f"api/game/{self.game_id}/state?player_id={self.player_id}",
            200
        )
        
        if not success:
            return False
        
        # Find our starfleets and enemy systems
        our_starfleets = []
        enemy_systems = []
        
        for system_id, system in game_state.get('systems', {}).items():
            if system.get('owner') == self.player_id:
                for starfleet in system.get('starfleet_details', []):
                    if starfleet.get('owner') == self.player_id:
                        our_starfleets.append({
                            'id': starfleet['id'],
                            'system_id': system_id,
                            'connections': system.get('connections', [])
                        })
            elif system.get('owner') and system.get('owner') != self.player_id:
                enemy_systems.append(system_id)
        
        print(f"   Found {len(our_starfleets)} our starfleets")
        print(f"   Found {len(enemy_systems)} enemy systems")
        
        # Test 2: Create movement orders to trigger combat
        combat_orders = []
        target_system = None
        
        for starfleet in our_starfleets:
            for connection in starfleet['connections']:
                if connection in enemy_systems:
                    combat_orders.append({
                        "starfleet_id": starfleet['id'],
                        "order_type": "move",
                        "target_system": connection
                    })
                    target_system = connection
                    break
            if combat_orders:
                break
        
        # If no enemy systems adjacent, try uncontrolled systems for automatic capture test
        if not combat_orders:
            print("   No enemy systems adjacent, testing automatic capture...")
            for starfleet in our_starfleets:
                for connection in starfleet['connections']:
                    conn_system = game_state['systems'].get(connection)
                    if conn_system and not conn_system.get('owner'):
                        combat_orders.append({
                            "starfleet_id": starfleet['id'],
                            "order_type": "move",
                            "target_system": connection
                        })
                        target_system = connection
                        break
                if combat_orders:
                    break
        
        if not combat_orders:
            print("❌ No valid combat scenarios could be created")
            return False
        
        # Submit combat orders
        success, response = self.run_test(
            "Submit Combat Orders",
            "POST",
            f"api/game/{self.game_id}/orders",
            200,
            data={
                "player_id": self.player_id,
                "orders": combat_orders
            }
        )
        
        if not success:
            return False
        
        # Test 3: Resolve turn to trigger combat
        current_turn = game_state.get('turn', 1)
        print(f"   Current turn before combat: {current_turn}")
        
        success, response = self.run_test(
            "Resolve Turn for Combat",
            "POST",
            f"api/game/{self.game_id}/resolve-turn",
            200
        )
        
        if not success:
            return False
        
        new_turn = response.get('new_turn', current_turn)
        print(f"   Turn after combat resolution: {new_turn}")
        
        # Test 4: Check combat reports were created with turn information
        success, post_combat_state = self.run_test(
            "Get Game State After Combat",
            "GET",
            f"api/game/{self.game_id}/state",
            200
        )
        
        if not success:
            return False
        
        combat_reports = post_combat_state.get('combat_reports', [])
        print(f"   Found {len(combat_reports)} combat reports")
        
        if len(combat_reports) == 0:
            print("❌ No combat reports generated")
            return False
        
        # Test 5: Verify combat reports have turn information
        latest_report = combat_reports[-1]  # Get the most recent report
        
        required_fields = ['system', 'turn', 'attackers', 'defenders', 'outcome', 'casualties']
        for field in required_fields:
            if field not in latest_report:
                print(f"❌ Combat report missing required field: {field}")
                return False
        
        report_turn = latest_report.get('turn')
        if report_turn != current_turn:
            print(f"❌ Combat report turn mismatch. Expected {current_turn}, got {report_turn}")
            return False
        
        print(f"   ✅ Combat report has correct turn information: {report_turn}")
        print(f"   Combat report details:")
        print(f"     System: {latest_report.get('system')}")
        print(f"     Outcome: {latest_report.get('outcome')}")
        print(f"     Attackers: {latest_report.get('attackers')}")
        print(f"     Defenders: {latest_report.get('defenders')}")
        
        # Test 6: Verify different combat scenarios
        outcome = latest_report.get('outcome')
        valid_outcomes = ['automatic_capture', 'attacker_victory', 'defender_victory', 'stalemate']
        
        if outcome not in valid_outcomes:
            print(f"❌ Invalid combat outcome: {outcome}")
            return False
        
        print(f"   ✅ Valid combat outcome: {outcome}")
        
        return True

    def test_resource_management(self):
        """Test resource collection and management - comprehensive test for bug fix"""
        if not self.game_id or not self.player_id:
            print("❌ No game ID or player ID available for testing")
            return False
        
        print("\n🔍 Testing Resource Management Bug Fix...")
        
        # Test 1: Check initial player resources after game creation
        success, game_state = self.run_test(
            "Get Initial Game State for Resources",
            "GET",
            f"api/game/{self.game_id}/state?player_id={self.player_id}",
            200
        )
        
        if not success:
            return False
        
        initial_resources = game_state.get('player_resources', {})
        print(f"   Initial Player resources: Tech:{initial_resources.get('tech', 0)}, Metals:{initial_resources.get('metals', 0)}, CHON:{initial_resources.get('chon', 0)}")
        
        # Verify initial resources are correct (should be 3,3,3 as per code)
        if initial_resources.get('tech', 0) != 3 or initial_resources.get('metals', 0) != 3 or initial_resources.get('chon', 0) != 3:
            print(f"❌ Initial resources incorrect. Expected 3,3,3 but got {initial_resources}")
            return False
        
        # Test 2: Check resource collection from owned systems
        owned_systems = []
        total_system_resources = {"tech": 0, "metals": 0, "chon": 0}
        
        for system_id, system in game_state.get('systems', {}).items():
            if system.get('owner') == self.player_id:
                owned_systems.append(system_id)
                sys_resources = system.get('resources', {})
                total_system_resources["tech"] += sys_resources.get('tech', 0)
                total_system_resources["metals"] += sys_resources.get('metals', 0)
                total_system_resources["chon"] += sys_resources.get('chon', 0)
                
                # Check for upgrade bonuses
                upgrades = system.get('upgrades', [])
                if "colony" in upgrades:
                    total_system_resources["tech"] += 1
                if "mining_facilities" in upgrades:
                    total_system_resources["metals"] += 1
                    total_system_resources["chon"] += 1
        
        print(f"   Owned systems: {len(owned_systems)}")
        print(f"   Total system resources per turn: Tech:{total_system_resources['tech']}, Metals:{total_system_resources['metals']}, CHON:{total_system_resources['chon']}")
        
        # Test 3: Advance through several turns and verify resource accumulation
        print("\n   Testing resource accumulation over multiple turns...")
        
        for turn in range(3):  # Test 3 turns
            print(f"\n   --- Turn {turn + 1} ---")
            
            # Resolve turn to trigger resource phase
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
                f"Get Game State After Turn {turn + 1}",
                "GET",
                f"api/game/{self.game_id}/state?player_id={self.player_id}",
                200
            )
            
            if not success:
                return False
            
            current_resources = updated_state.get('player_resources', {})
            print(f"   Resources after turn {turn + 1}: Tech:{current_resources.get('tech', 0)}, Metals:{current_resources.get('metals', 0)}, CHON:{current_resources.get('chon', 0)}")
            
            # Calculate expected resources (initial + (turn * system_resources))
            expected_resources = {
                "tech": initial_resources['tech'] + ((turn + 1) * total_system_resources['tech']),
                "metals": initial_resources['metals'] + ((turn + 1) * total_system_resources['metals']),
                "chon": initial_resources['chon'] + ((turn + 1) * total_system_resources['chon'])
            }
            
            print(f"   Expected resources: Tech:{expected_resources['tech']}, Metals:{expected_resources['metals']}, CHON:{expected_resources['chon']}")
            
            # Verify resources are accumulating, not being replaced
            if (current_resources.get('tech', 0) < expected_resources['tech'] - 10 or  # Allow some tolerance for upkeep
                current_resources.get('metals', 0) < expected_resources['metals'] - 10 or
                current_resources.get('chon', 0) < expected_resources['chon'] - 10):
                print(f"❌ Resources not accumulating properly on turn {turn + 1}")
                print(f"   Current: {current_resources}")
                print(f"   Expected (minimum): {expected_resources}")
                return False
            
            print(f"   ✅ Resources accumulating correctly on turn {turn + 1}")
        
        # Test 4: Verify resources are pooled globally per player (not per system)
        print("\n   Testing global resource pooling...")
        final_state_success, final_state = self.run_test(
            "Get Final Game State",
            "GET",
            f"api/game/{self.game_id}/state",
            200
        )
        
        if not final_state_success:
            return False
        
        # Check that player_resources is a single pool, not per-system
        all_player_resources = final_state.get('player_resources', {})
        if self.player_id in all_player_resources:
            player_resources = all_player_resources[self.player_id]
            if isinstance(player_resources, dict) and 'tech' in player_resources:
                print("   ✅ Resources are pooled globally per player")
                return True
            else:
                print("❌ Resources not properly structured as global pool")
                return False
        else:
            print("❌ Player resources not found in global pool")
            return False

def main():
    print("🚀 Starting Consilium Mundi API Tests")
    print("=" * 50)
    
    tester = ConsiliumMundiAPITester()
    
    # Run all tests in sequence
    tests = [
        tester.test_root_endpoint,
        tester.test_create_game,
        tester.test_get_game_state,
        tester.test_get_game_players,
        tester.test_join_game,
        tester.test_game_state_after_full_game,
        tester.test_resource_management,
        tester.test_starfleet_orders,
        tester.test_build_orders,
        tester.test_espionage_orders,
        tester.test_turn_resolution,
        tester.test_submit_action,
        tester.test_list_games
    ]
    
    for test in tests:
        if not test():
            print(f"\n❌ Test failed: {test.__name__}")
            break
        print("✅ Test passed")
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All backend tests passed!")
        return 0
    else:
        print("❌ Some backend tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())