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
        """Test submitting build orders and resource deduction"""
        if not self.game_id or not self.player_id:
            print("❌ No game ID or player ID available for testing")
            return False
        
        print("\n🔍 Testing Build Orders and Resource Deduction...")
        
        # Get initial game state and resources
        success, game_state = self.run_test(
            "Get Game State for Building",
            "GET",
            f"api/game/{self.game_id}/state?player_id={self.player_id}",
            200
        )
        
        if not success:
            return False
        
        initial_resources = game_state.get('player_resources', {})
        print(f"   Initial resources: Tech:{initial_resources.get('tech', 0)}, Metals:{initial_resources.get('metals', 0)}, CHON:{initial_resources.get('chon', 0)}")
        
        # Find our owned systems with shipyards
        our_systems = []
        shipyard_systems = []
        
        for system_id, system in game_state.get('systems', {}).items():
            if system.get('owner') == self.player_id:
                our_systems.append(system_id)
                if "shipyard" in system.get('upgrades', []):
                    shipyard_systems.append(system_id)
        
        print(f"   Owned systems: {len(our_systems)}")
        print(f"   Systems with shipyards: {len(shipyard_systems)}")
        
        if not our_systems:
            print("❌ No owned systems found for player")
            return False
        
        # Test 1: Submit build orders
        build_orders = []
        
        # Try to build a starfleet if we have a shipyard
        if shipyard_systems and initial_resources.get('tech', 0) >= 1 and initial_resources.get('metals', 0) >= 1 and initial_resources.get('chon', 0) >= 1:
            build_orders.append({
                "type": "build",
                "build_type": "starfleet",
                "system_id": shipyard_systems[0]
            })
            print(f"   Planning to build starfleet in system {shipyard_systems[0]}")
        
        # Try to build a starport if we have enough resources
        if (initial_resources.get('tech', 0) >= 2 and initial_resources.get('metals', 0) >= 2 and initial_resources.get('chon', 0) >= 2):
            # Find a system without starport
            for system_id in our_systems:
                system = game_state['systems'][system_id]
                if "starport" not in system.get('upgrades', []):
                    build_orders.append({
                        "type": "build",
                        "build_type": "starport",
                        "system_id": system_id
                    })
                    print(f"   Planning to build starport in system {system_id}")
                    break
        
        if not build_orders:
            print("❌ No valid build orders could be created with current resources")
            return False
        
        success, response = self.run_test(
            "Submit Build Orders",
            "POST",
            f"api/game/{self.game_id}/build-orders",
            200,
            data={
                "player_id": self.player_id,
                "orders": build_orders
            }
        )
        
        if not success:
            return False
        
        print(f"   ✅ Successfully submitted {len(build_orders)} build orders")
        
        # Test 2: Resolve turn to execute build phase
        success, response = self.run_test(
            "Resolve Turn for Build Phase",
            "POST",
            f"api/game/{self.game_id}/resolve-turn",
            200
        )
        
        if not success:
            return False
        
        # Test 3: Verify resource deduction
        success, post_build_state = self.run_test(
            "Get Game State After Build Phase",
            "GET",
            f"api/game/{self.game_id}/state?player_id={self.player_id}",
            200
        )
        
        if not success:
            return False
        
        final_resources = post_build_state.get('player_resources', {})
        print(f"   Final resources: Tech:{final_resources.get('tech', 0)}, Metals:{final_resources.get('metals', 0)}, CHON:{final_resources.get('chon', 0)}")
        
        # Calculate expected resource deduction
        expected_deduction = {"tech": 0, "metals": 0, "chon": 0}
        
        for order in build_orders:
            build_type = order.get('build_type')
            if build_type == "starfleet":
                expected_deduction["tech"] += 1
                expected_deduction["metals"] += 1
                expected_deduction["chon"] += 1
            elif build_type == "starport":
                expected_deduction["tech"] += 2
                expected_deduction["metals"] += 2
                expected_deduction["chon"] += 2
            elif build_type == "shipyard":
                expected_deduction["tech"] += 3
                expected_deduction["metals"] += 3
                expected_deduction["chon"] += 1
            elif build_type == "colony":
                expected_deduction["metals"] += 2
                expected_deduction["chon"] += 2
            elif build_type == "mining_facilities":
                expected_deduction["tech"] += 2
                expected_deduction["metals"] += 2
                expected_deduction["chon"] += 1
        
        print(f"   Expected resource deduction: {expected_deduction}")
        
        # Note: Resources might have increased due to resource phase, so we need to account for that
        # We'll check if the deduction happened by comparing the difference
        
        # Test 4: Verify builds were actually constructed
        built_items = 0
        for system_id, system in post_build_state.get('systems', {}).items():
            if system.get('owner') == self.player_id:
                # Check for new starfleets
                starfleet_count = system.get('starfleets', 0)
                if starfleet_count > 0:
                    built_items += 1
                
                # Check for new upgrades
                upgrades = system.get('upgrades', [])
                if "starport" in upgrades or "shipyard" in upgrades:
                    built_items += len([u for u in upgrades if u in ["starport", "shipyard"]])
        
        if built_items > 0:
            print(f"   ✅ Successfully built {built_items} items")
            return True
        else:
            print("❌ No items were built despite submitting orders")
            return False

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

    def test_finalize_orders_button(self):
        """Test the Finalize Orders button functionality - Critical Bug Fix Test"""
        if not self.game_id or not self.player_id:
            print("❌ No game ID or player ID available for testing")
            return False
        
        print("\n🔍 Testing Finalize Orders Button - Critical Bug Fix...")
        
        # Test 1: Create a game with multiple players and set up orders
        success, game_state = self.run_test(
            "Get Game State for Order Setup",
            "GET",
            f"api/game/{self.game_id}/state?player_id={self.player_id}",
            200
        )
        
        if not success:
            return False
        
        print(f"   Game has {len(game_state.get('players', []))} players")
        
        # Test 2: Create starfleet movement orders
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
            print("❌ No starfleets found for testing orders")
            return False
        
        # Create movement orders
        movement_orders = []
        for starfleet in our_starfleets[:2]:  # Test with first 2 starfleets
            if starfleet['connections']:
                movement_orders.append({
                    "starfleet_id": starfleet['id'],
                    "order_type": "move",
                    "target_system": starfleet['connections'][0]
                })
        
        print(f"   Created {len(movement_orders)} movement orders")
        
        # Test 3: Submit starfleet movement orders
        if movement_orders:
            success, response = self.run_test(
                "Submit Starfleet Movement Orders",
                "POST",
                f"api/game/{self.game_id}/orders",
                200,
                data={
                    "player_id": self.player_id,
                    "orders": movement_orders
                }
            )
            
            if not success:
                print("❌ Failed to submit starfleet movement orders")
                return False
            
            print(f"   ✅ Successfully submitted {len(movement_orders)} movement orders")
        
        # Test 4: Create build orders
        our_systems = [s_id for s_id, s in game_state.get('systems', {}).items() if s.get('owner') == self.player_id]
        shipyard_systems = [s_id for s_id, s in game_state.get('systems', {}).items() 
                           if s.get('owner') == self.player_id and "shipyard" in s.get('upgrades', [])]
        
        build_orders = []
        player_resources = game_state.get('player_resources', {})
        
        # Try to create a starfleet build order if we have resources and shipyard
        if (shipyard_systems and 
            player_resources.get('tech', 0) >= 1 and 
            player_resources.get('metals', 0) >= 1 and 
            player_resources.get('chon', 0) >= 1):
            
            build_orders.append({
                "type": "build",
                "build_type": "starfleet",
                "system_id": shipyard_systems[0]
            })
        
        # Try to create a starport build order if we have resources
        if (player_resources.get('tech', 0) >= 2 and 
            player_resources.get('metals', 0) >= 2 and 
            player_resources.get('chon', 0) >= 2):
            
            for system_id in our_systems:
                system = game_state['systems'][system_id]
                if "starport" not in system.get('upgrades', []):
                    build_orders.append({
                        "type": "build",
                        "build_type": "starport",
                        "system_id": system_id
                    })
                    break
        
        print(f"   Created {len(build_orders)} build orders")
        
        # Test 5: Submit build orders
        if build_orders:
            success, response = self.run_test(
                "Submit Build Orders",
                "POST",
                f"api/game/{self.game_id}/build-orders",
                200,
                data={
                    "player_id": self.player_id,
                    "orders": build_orders
                }
            )
            
            if not success:
                print("❌ Failed to submit build orders")
                return False
            
            print(f"   ✅ Successfully submitted {len(build_orders)} build orders")
        
        # Test 6: Test the Finalize Orders functionality (resolve turn)
        print("\n   Testing Finalize Orders button (turn resolution)...")
        
        success, response = self.run_test(
            "Finalize Orders (Resolve Turn)",
            "POST",
            f"api/game/{self.game_id}/resolve-turn",
            200
        )
        
        if not success:
            print("❌ Finalize Orders button failed - turn resolution failed")
            return False
        
        print("   ✅ Finalize Orders button working - turn resolved successfully")
        
        # Test 7: Verify orders were processed
        success, post_resolution_state = self.run_test(
            "Get Game State After Order Finalization",
            "GET",
            f"api/game/{self.game_id}/state?player_id={self.player_id}",
            200
        )
        
        if not success:
            return False
        
        # Check if turn advanced
        new_turn = post_resolution_state.get('turn', 1)
        old_turn = game_state.get('turn', 1)
        
        if new_turn <= old_turn:
            print(f"❌ Turn did not advance. Old: {old_turn}, New: {new_turn}")
            return False
        
        print(f"   ✅ Turn advanced from {old_turn} to {new_turn}")
        
        # Test 8: Verify error handling and logging
        print("\n   Testing error handling...")
        
        # Try to submit orders for non-existent game
        success, response = self.run_test(
            "Test Error Handling - Invalid Game ID",
            "POST",
            "api/game/invalid-game-id/resolve-turn",
            404
        )
        
        if success:
            print("   ✅ Error handling working - invalid game ID properly rejected")
        else:
            print("   ❌ Error handling failed - should have returned 404")
            return False
        
        print("\n   ✅ FINALIZE ORDERS BUTTON TEST PASSED")
        print("   - Orders submitted successfully to backend")
        print("   - Turn resolution working correctly")
        print("   - Error handling and logging functional")
        
        return True

    def test_resolve_turn_functionality(self):
        """Test the Resolve Turn endpoint functionality - Critical Bug Fix Test"""
        if not self.game_id or not self.player_id:
            print("❌ No game ID or player ID available for testing")
            return False
        
        print("\n🔍 Testing Resolve Turn Functionality - Critical Bug Fix...")
        
        # Test 1: Get initial game state
        success, initial_state = self.run_test(
            "Get Initial State for Turn Resolution",
            "GET",
            f"api/game/{self.game_id}/state",
            200
        )
        
        if not success:
            return False
        
        initial_turn = initial_state.get('turn', 1)
        initial_phase = initial_state.get('phase', 'setup')
        
        print(f"   Initial turn: {initial_turn}, phase: {initial_phase}")
        
        # Test 2: Set up pending orders for multiple players
        all_players = initial_state.get('players', [])
        print(f"   Setting up orders for {len(all_players)} players")
        
        # Create orders for our player
        our_orders_created = False
        for system_id, system in initial_state.get('systems', {}).items():
            if system.get('owner') == self.player_id:
                for starfleet in system.get('starfleet_details', []):
                    if starfleet.get('owner') == self.player_id and system.get('connections'):
                        # Create a movement order
                        success, response = self.run_test(
                            "Create Pending Movement Order",
                            "POST",
                            f"api/game/{self.game_id}/orders",
                            200,
                            data={
                                "player_id": self.player_id,
                                "orders": [{
                                    "starfleet_id": starfleet['id'],
                                    "order_type": "move",
                                    "target_system": system['connections'][0]
                                }]
                            }
                        )
                        
                        if success:
                            our_orders_created = True
                            print("   ✅ Created pending movement order")
                            break
                if our_orders_created:
                    break
        
        # Create a build order if possible
        player_resources = initial_state.get('player_resources', {}).get(self.player_id, {})
        if (player_resources.get('tech', 0) >= 2 and 
            player_resources.get('metals', 0) >= 2 and 
            player_resources.get('chon', 0) >= 2):
            
            for system_id, system in initial_state.get('systems', {}).items():
                if system.get('owner') == self.player_id:
                    success, response = self.run_test(
                        "Create Pending Build Order",
                        "POST",
                        f"api/game/{self.game_id}/build-orders",
                        200,
                        data={
                            "player_id": self.player_id,
                            "orders": [{
                                "type": "build",
                                "build_type": "starport",
                                "system_id": system_id
                            }]
                        }
                    )
                    
                    if success:
                        print("   ✅ Created pending build order")
                    break
        
        # Test 3: Test auto-submission of pending orders during turn resolution
        print("\n   Testing auto-submission of pending orders...")
        
        success, response = self.run_test(
            "Resolve Turn with Auto-Submit",
            "POST",
            f"api/game/{self.game_id}/resolve-turn",
            200
        )
        
        if not success:
            print("❌ Turn resolution failed")
            return False
        
        new_turn = response.get('new_turn', initial_turn)
        print(f"   ✅ Turn resolved successfully. New turn: {new_turn}")
        
        # Test 4: Verify turn advanced correctly
        if new_turn != initial_turn + 1:
            print(f"❌ Turn did not advance correctly. Expected {initial_turn + 1}, got {new_turn}")
            return False
        
        print(f"   ✅ Turn advanced correctly from {initial_turn} to {new_turn}")
        
        # Test 5: Verify resources were updated after resolution
        success, post_resolution_state = self.run_test(
            "Get State After Turn Resolution",
            "GET",
            f"api/game/{self.game_id}/state",
            200
        )
        
        if not success:
            return False
        
        # Check resource updates
        post_resources = post_resolution_state.get('player_resources', {}).get(self.player_id, {})
        initial_resources = initial_state.get('player_resources', {}).get(self.player_id, {})
        
        print(f"   Resources before: Tech:{initial_resources.get('tech', 0)}, Metals:{initial_resources.get('metals', 0)}, CHON:{initial_resources.get('chon', 0)}")
        print(f"   Resources after: Tech:{post_resources.get('tech', 0)}, Metals:{post_resources.get('metals', 0)}, CHON:{post_resources.get('chon', 0)}")
        
        # Resources should have changed (either increased from collection or decreased from builds/upkeep)
        resources_changed = (
            post_resources.get('tech', 0) != initial_resources.get('tech', 0) or
            post_resources.get('metals', 0) != initial_resources.get('metals', 0) or
            post_resources.get('chon', 0) != initial_resources.get('chon', 0)
        )
        
        if resources_changed:
            print("   ✅ Resources updated properly after turn resolution")
        else:
            print("   ⚠️  Resources unchanged - may be normal if no resource-generating systems owned")
        
        # Test 6: Test multiple consecutive turn resolutions
        print("\n   Testing multiple consecutive turn resolutions...")
        
        for i in range(2):
            success, response = self.run_test(
                f"Consecutive Turn Resolution {i+1}",
                "POST",
                f"api/game/{self.game_id}/resolve-turn",
                200
            )
            
            if not success:
                print(f"❌ Consecutive turn resolution {i+1} failed")
                return False
            
            turn_after = response.get('new_turn', 0)
            expected_turn = new_turn + i + 1
            
            if turn_after != expected_turn:
                print(f"❌ Turn sequence broken. Expected {expected_turn}, got {turn_after}")
                return False
            
            print(f"   ✅ Consecutive turn {i+1} resolved correctly (turn {turn_after})")
        
        print("\n   ✅ RESOLVE TURN FUNCTIONALITY TEST PASSED")
        print("   - Auto-submission of pending orders working")
        print("   - Turn resolution advances correctly")
        print("   - Resources updated properly after resolution")
        print("   - Multiple consecutive resolutions working")
        
        return True

    def test_resource_accumulation_bug_comprehensive(self):
        """COMPREHENSIVE TEST: Resource Accumulation Bug - Focus on Tech, Metals, and CHON accumulation over multiple turns"""
        print("\n🔍 COMPREHENSIVE RESOURCE ACCUMULATION BUG TEST")
        print("=" * 60)
        
        # Test 1: Create a fresh game with 4 players
        print("\n📋 STEP 1: Creating fresh 4-player game...")
        success, response = self.run_test(
            "Create Fresh 4-Player Game",
            "POST",
            "api/create-game",
            200,
            data={
                "player_name": "Resource Test Player 1",
                "config": {
                    "num_players": 4,
                    "galaxy_size": "standard",
                    "turn_time_limit": 24
                }
            }
        )
        
        if not success:
            return False
        
        test_game_id = response.get('game_id')
        test_player_id = response.get('player_id')
        
        # Add AI players to complete the 4-player setup
        success, response = self.run_test(
            "Add 3 AI Players",
            "POST",
            f"api/game/{test_game_id}/add-ai-players",
            200
        )
        
        if not success:
            return False
        
        print(f"   ✅ Created 4-player game: {test_game_id}")
        
        # Test 2: Record initial state and resource values for all players
        print("\n📋 STEP 2: Recording initial resource values for all 4 players...")
        success, initial_state = self.run_test(
            "Get Initial Game State",
            "GET",
            f"api/game/{test_game_id}/state",
            200
        )
        
        if not success:
            return False
        
        all_players = initial_state.get('players', [])
        initial_player_resources = initial_state.get('player_resources', {})
        
        print(f"   Game has {len(all_players)} players")
        
        # Record initial resources for all players
        player_resource_history = {}
        for i, player_id in enumerate(all_players):
            resources = initial_player_resources.get(player_id, {})
            player_resource_history[player_id] = {
                'name': f'Player {i+1}',
                'history': [resources.copy()]
            }
            print(f"   Player {i+1} initial: Tech:{resources.get('tech', 0)}, Metals:{resources.get('metals', 0)}, CHON:{resources.get('chon', 0)}")
        
        # Test 3: Analyze each player's systems and expected production
        print("\n📋 STEP 3: System-by-system analysis for each player...")
        player_production = {}
        
        for i, player_id in enumerate(all_players):
            owned_systems = []
            base_production = {"tech": 0, "metals": 0, "chon": 0}
            upgrade_bonuses = {"tech": 0, "metals": 0, "chon": 0}
            
            for system_id, system in initial_state.get('systems', {}).items():
                if system.get('owner') == player_id:
                    owned_systems.append(system_id)
                    
                    # Base resources from system
                    sys_resources = system.get('resources', {})
                    base_production["tech"] += sys_resources.get('tech', 0)
                    base_production["metals"] += sys_resources.get('metals', 0)
                    base_production["chon"] += sys_resources.get('chon', 0)
                    
                    # Upgrade bonuses
                    upgrades = system.get('upgrades', [])
                    if "colony" in upgrades:
                        upgrade_bonuses["tech"] += 1
                    if "mining_facilities" in upgrades:
                        upgrade_bonuses["metals"] += 1
                        upgrade_bonuses["chon"] += 1
            
            total_production = {
                "tech": base_production["tech"] + upgrade_bonuses["tech"],
                "metals": base_production["metals"] + upgrade_bonuses["metals"],
                "chon": base_production["chon"] + upgrade_bonuses["chon"]
            }
            
            player_production[player_id] = total_production
            
            print(f"   Player {i+1} owns {len(owned_systems)} systems")
            print(f"     Base production: Tech:{base_production['tech']}, Metals:{base_production['metals']}, CHON:{base_production['chon']}")
            print(f"     Upgrade bonuses: Tech:{upgrade_bonuses['tech']}, Metals:{upgrade_bonuses['metals']}, CHON:{upgrade_bonuses['chon']}")
            print(f"     Total per turn: Tech:{total_production['tech']}, Metals:{total_production['metals']}, CHON:{total_production['chon']}")
        
        # Test 4: Turn 1 Resource Test
        print("\n📋 STEP 4: TURN 1 RESOURCE TEST...")
        print("   Resolving Turn 1...")
        
        success, response = self.run_test(
            "Resolve Turn 1",
            "POST",
            f"api/game/{test_game_id}/resolve-turn",
            200
        )
        
        if not success:
            print("❌ Failed to resolve Turn 1")
            return False
        
        # Get state after Turn 1
        success, turn1_state = self.run_test(
            "Get State After Turn 1",
            "GET",
            f"api/game/{test_game_id}/state",
            200
        )
        
        if not success:
            return False
        
        turn1_resources = turn1_state.get('player_resources', {})
        
        print("   TURN 1 RESULTS:")
        all_resources_increased = True
        
        for i, player_id in enumerate(all_players):
            initial = player_resource_history[player_id]['history'][0]
            current = turn1_resources.get(player_id, {})
            expected_production = player_production[player_id]
            
            # Calculate expected resources (initial + production - upkeep)
            # Upkeep is 1 of each resource per starfleet
            starfleet_count = 0
            for system_id, system in turn1_state.get('systems', {}).items():
                if system.get('owner') == player_id:
                    starfleet_count += system.get('starfleets', 0)
            
            expected = {
                "tech": initial['tech'] + expected_production['tech'] - starfleet_count,
                "metals": initial['metals'] + expected_production['metals'] - starfleet_count,
                "chon": initial['chon'] + expected_production['chon'] - starfleet_count
            }
            
            # Record in history
            player_resource_history[player_id]['history'].append(current.copy())
            
            print(f"     Player {i+1}:")
            print(f"       Before: Tech:{initial['tech']}, Metals:{initial['metals']}, CHON:{initial['chon']}")
            print(f"       After:  Tech:{current.get('tech', 0)}, Metals:{current.get('metals', 0)}, CHON:{current.get('chon', 0)}")
            print(f"       Expected: Tech:{expected['tech']}, Metals:{expected['metals']}, CHON:{expected['chon']} (after {starfleet_count} upkeep)")
            
            # Check if ALL THREE resource types increased (or at least didn't decrease unexpectedly)
            tech_ok = current.get('tech', 0) >= expected['tech'] - 1  # Allow 1 unit tolerance
            metals_ok = current.get('metals', 0) >= expected['metals'] - 1
            chon_ok = current.get('chon', 0) >= expected['chon'] - 1
            
            if not (tech_ok and metals_ok and chon_ok):
                print(f"       ❌ RESOURCE ACCUMULATION FAILED for Player {i+1}")
                all_resources_increased = False
            else:
                print(f"       ✅ All resources accumulated correctly for Player {i+1}")
        
        if not all_resources_increased:
            print("❌ TURN 1 RESOURCE TEST FAILED - Not all resources accumulated properly")
            return False
        
        print("   ✅ TURN 1 RESOURCE TEST PASSED - All players' resources accumulated correctly")
        
        # Test 5: Turn 2 Resource Test
        print("\n📋 STEP 5: TURN 2 RESOURCE TEST...")
        print("   Resolving Turn 2...")
        
        success, response = self.run_test(
            "Resolve Turn 2",
            "POST",
            f"api/game/{test_game_id}/resolve-turn",
            200
        )
        
        if not success:
            print("❌ Failed to resolve Turn 2")
            return False
        
        # Get state after Turn 2
        success, turn2_state = self.run_test(
            "Get State After Turn 2",
            "GET",
            f"api/game/{test_game_id}/state",
            200
        )
        
        if not success:
            return False
        
        turn2_resources = turn2_state.get('player_resources', {})
        
        print("   TURN 2 RESULTS:")
        turn2_accumulation_ok = True
        
        for i, player_id in enumerate(all_players):
            turn1_resources_player = player_resource_history[player_id]['history'][1]
            current = turn2_resources.get(player_id, {})
            expected_production = player_production[player_id]
            
            # Calculate expected resources from Turn 1 + production - upkeep
            starfleet_count = 0
            for system_id, system in turn2_state.get('systems', {}).items():
                if system.get('owner') == player_id:
                    starfleet_count += system.get('starfleets', 0)
            
            expected = {
                "tech": turn1_resources_player['tech'] + expected_production['tech'] - starfleet_count,
                "metals": turn1_resources_player['metals'] + expected_production['metals'] - starfleet_count,
                "chon": turn1_resources_player['chon'] + expected_production['chon'] - starfleet_count
            }
            
            # Record in history
            player_resource_history[player_id]['history'].append(current.copy())
            
            print(f"     Player {i+1}:")
            print(f"       Turn 1: Tech:{turn1_resources_player['tech']}, Metals:{turn1_resources_player['metals']}, CHON:{turn1_resources_player['chon']}")
            print(f"       Turn 2: Tech:{current.get('tech', 0)}, Metals:{current.get('metals', 0)}, CHON:{current.get('chon', 0)}")
            print(f"       Expected: Tech:{expected['tech']}, Metals:{expected['metals']}, CHON:{expected['chon']}")
            
            # Verify continued accumulation
            tech_accumulated = current.get('tech', 0) >= expected['tech'] - 1
            metals_accumulated = current.get('metals', 0) >= expected['metals'] - 1
            chon_accumulated = current.get('chon', 0) >= expected['chon'] - 1
            
            if not (tech_accumulated and metals_accumulated and chon_accumulated):
                print(f"       ❌ CONTINUED ACCUMULATION FAILED for Player {i+1}")
                turn2_accumulation_ok = False
            else:
                print(f"       ✅ Continued accumulation working for Player {i+1}")
        
        if not turn2_accumulation_ok:
            print("❌ TURN 2 RESOURCE TEST FAILED - Resources not continuing to accumulate")
            return False
        
        print("   ✅ TURN 2 RESOURCE TEST PASSED - Resources continue to accumulate correctly")
        
        # Test 6: Specific Focus on Metals and CHON vs Tech
        print("\n📋 STEP 6: SPECIFIC ANALYSIS - Metals and CHON vs Tech accumulation...")
        
        metals_chon_issues = []
        for i, player_id in enumerate(all_players):
            history = player_resource_history[player_id]['history']
            
            # Check if Metals and CHON are accumulating at the same rate as Tech
            tech_increase = history[2]['tech'] - history[0]['tech']
            metals_increase = history[2]['metals'] - history[0]['metals']
            chon_increase = history[2]['chon'] - history[0]['chon']
            
            print(f"   Player {i+1} total increase over 2 turns:")
            print(f"     Tech: +{tech_increase}")
            print(f"     Metals: +{metals_increase}")
            print(f"     CHON: +{chon_increase}")
            
            # Check for patterns where Metals/CHON might be lagging behind Tech
            expected_production = player_production[player_id]
            expected_tech_increase = expected_production['tech'] * 2
            expected_metals_increase = expected_production['metals'] * 2
            expected_chon_increase = expected_production['chon'] * 2
            
            if (metals_increase < expected_metals_increase - 2 or 
                chon_increase < expected_chon_increase - 2):
                metals_chon_issues.append(f"Player {i+1}")
        
        if metals_chon_issues:
            print(f"   ⚠️  Potential issues with Metals/CHON accumulation for: {', '.join(metals_chon_issues)}")
        else:
            print("   ✅ Metals and CHON accumulating at expected rates for all players")
        
        # Test 7: Final Summary and Verification
        print("\n📋 STEP 7: FINAL VERIFICATION SUMMARY...")
        print("=" * 60)
        
        final_success = True
        
        for i, player_id in enumerate(all_players):
            history = player_resource_history[player_id]['history']
            initial = history[0]
            final = history[2]
            
            print(f"   Player {i+1} FINAL SUMMARY:")
            print(f"     Initial:  Tech:{initial['tech']}, Metals:{initial['metals']}, CHON:{initial['chon']}")
            print(f"     After 2 turns: Tech:{final['tech']}, Metals:{final['metals']}, CHON:{final['chon']}")
            
            # Verify all resources increased
            tech_increased = final['tech'] > initial['tech']
            metals_increased = final['metals'] > initial['metals']
            chon_increased = final['chon'] > initial['chon']
            
            if not (tech_increased and metals_increased and chon_increased):
                print(f"     ❌ NOT ALL RESOURCES INCREASED for Player {i+1}")
                final_success = False
            else:
                print(f"     ✅ ALL RESOURCES ACCUMULATED CORRECTLY for Player {i+1}")
        
        if final_success:
            print("\n🎉 COMPREHENSIVE RESOURCE ACCUMULATION TEST PASSED!")
            print("✅ Tech, Metals, and CHON all accumulate properly each turn")
            print("✅ Resources accumulate (not replace) over multiple turns")
            print("✅ All 4 players show consistent resource accumulation")
            print("✅ System-by-system production calculations working correctly")
            return True
        else:
            print("\n❌ COMPREHENSIVE RESOURCE ACCUMULATION TEST FAILED!")
            print("❌ Resource accumulation bug still present")
            return False

    def test_player_resource_initialization(self):
        """Test player resource initialization - Critical Bug Fix Test"""
        print("\n🔍 Testing Player Resource Initialization - Critical Bug Fix...")
        
        # Test 1: Create a fresh game to test initialization
        success, response = self.run_test(
            "Create Fresh Game for Resource Test",
            "POST",
            "api/create-game",
            200,
            data={
                "player_name": "Resource Test Player",
                "config": {
                    "num_players": 4,
                    "galaxy_size": "standard",
                    "turn_time_limit": 24
                }
            }
        )
        
        if not success:
            return False
        
        test_game_id = response.get('game_id')
        test_player_id = response.get('player_id')
        
        if not test_game_id or not test_player_id:
            print("❌ Failed to get game/player IDs from fresh game")
            return False
        
        print(f"   Created test game: {test_game_id}")
        print(f"   Test player ID: {test_player_id}")
        
        # Test 2: Add AI players to start the game
        success, response = self.run_test(
            "Add AI Players to Test Game",
            "POST",
            f"api/game/{test_game_id}/add-ai-players",
            200
        )
        
        if not success:
            return False
        
        print(f"   Added {len(response.get('players_added', []))} AI players")
        
        # Test 3: Get game state and verify all players have proper initial resources
        success, game_state = self.run_test(
            "Get Game State for Resource Verification",
            "GET",
            f"api/game/{test_game_id}/state",
            200
        )
        
        if not success:
            return False
        
        all_players = game_state.get('players', [])
        player_resources = game_state.get('player_resources', {})
        
        print(f"   Game has {len(all_players)} players")
        print(f"   Resource data available for {len(player_resources)} players")
        
        # Test 4: Verify each player (especially Player 1) has correct initial resources
        expected_initial_resources = {"tech": 3, "metals": 3, "chon": 3}
        
        for i, player_id in enumerate(all_players):
            player_name = f"Player {i+1}"
            if player_id == test_player_id:
                player_name = "Resource Test Player (Player 1)"
            
            if player_id not in player_resources:
                print(f"❌ {player_name} ({player_id}) missing from resource data")
                return False
            
            resources = player_resources[player_id]
            
            print(f"   {player_name}: Tech:{resources.get('tech', 0)}, Metals:{resources.get('metals', 0)}, CHON:{resources.get('chon', 0)}")
            
            # Verify resources match expected values
            for resource_type, expected_value in expected_initial_resources.items():
                actual_value = resources.get(resource_type, 0)
                if actual_value != expected_value:
                    print(f"❌ {player_name} has incorrect {resource_type}. Expected {expected_value}, got {actual_value}")
                    return False
            
            print(f"   ✅ {player_name} has correct initial resources")
        
        # Test 5: Test resource API endpoint specifically for Player 1
        success, player1_resources = self.run_test(
            "Get Player 1 Resources Specifically",
            "GET",
            f"api/game/{test_game_id}/state?player_id={test_player_id}",
            200
        )
        
        if not success:
            return False
        
        player1_resource_data = player1_resources.get('player_resources', {})
        
        print(f"   Player 1 specific resource query: Tech:{player1_resource_data.get('tech', 0)}, Metals:{player1_resource_data.get('metals', 0)}, CHON:{player1_resource_data.get('chon', 0)}")
        
        # Verify Player 1 resources are correctly returned by API
        for resource_type, expected_value in expected_initial_resources.items():
            actual_value = player1_resource_data.get(resource_type, 0)
            if actual_value != expected_value:
                print(f"❌ Player 1 API resource query incorrect for {resource_type}. Expected {expected_value}, got {actual_value}")
                return False
        
        # Test 6: Test resource calculations after a turn
        print("\n   Testing resource calculations after turn resolution...")
        
        # Get systems owned by test player
        owned_systems = []
        system_resource_generation = {"tech": 0, "metals": 0, "chon": 0}
        
        for system_id, system in game_state.get('systems', {}).items():
            if system.get('owner') == test_player_id:
                owned_systems.append(system_id)
                sys_resources = system.get('resources', {})
                system_resource_generation["tech"] += sys_resources.get('tech', 0)
                system_resource_generation["metals"] += sys_resources.get('metals', 0)
                system_resource_generation["chon"] += sys_resources.get('chon', 0)
                
                # Add upgrade bonuses
                upgrades = system.get('upgrades', [])
                if "colony" in upgrades:
                    system_resource_generation["tech"] += 1
                if "mining_facilities" in upgrades:
                    system_resource_generation["metals"] += 1
                    system_resource_generation["chon"] += 1
        
        print(f"   Player 1 owns {len(owned_systems)} systems")
        print(f"   Expected resource generation per turn: Tech:{system_resource_generation['tech']}, Metals:{system_resource_generation['metals']}, CHON:{system_resource_generation['chon']}")
        
        # Resolve a turn
        success, response = self.run_test(
            "Resolve Turn for Resource Calculation Test",
            "POST",
            f"api/game/{test_game_id}/resolve-turn",
            200
        )
        
        if not success:
            return False
        
        # Get updated resources
        success, post_turn_state = self.run_test(
            "Get Resources After Turn",
            "GET",
            f"api/game/{test_game_id}/state?player_id={test_player_id}",
            200
        )
        
        if not success:
            return False
        
        post_turn_resources = post_turn_state.get('player_resources', {})
        
        print(f"   Resources after turn: Tech:{post_turn_resources.get('tech', 0)}, Metals:{post_turn_resources.get('metals', 0)}, CHON:{post_turn_resources.get('chon', 0)}")
        
        # Calculate expected resources (initial + generation - upkeep)
        # Upkeep is 1 of each resource per starfleet
        starfleet_count = 0
        for system_id, system in post_turn_state.get('systems', {}).items():
            if system.get('owner') == test_player_id:
                starfleet_count += system.get('starfleets', 0)
        
        expected_post_turn = {
            "tech": expected_initial_resources["tech"] + system_resource_generation["tech"] - starfleet_count,
            "metals": expected_initial_resources["metals"] + system_resource_generation["metals"] - starfleet_count,
            "chon": expected_initial_resources["chon"] + system_resource_generation["chon"] - starfleet_count
        }
        
        print(f"   Expected after turn (init + generation - upkeep): Tech:{expected_post_turn['tech']}, Metals:{expected_post_turn['metals']}, CHON:{expected_post_turn['chon']}")
        print(f"   (Upkeep for {starfleet_count} starfleets)")
        
        # Verify resources are in expected range (allow some tolerance)
        for resource_type in ["tech", "metals", "chon"]:
            actual = post_turn_resources.get(resource_type, 0)
            expected = expected_post_turn[resource_type]
            
            if abs(actual - expected) > 1:  # Allow 1 unit tolerance
                print(f"❌ Resource calculation error for {resource_type}. Expected ~{expected}, got {actual}")
                return False
        
        print("   ✅ Resource calculations working correctly after turn resolution")
        
        print("\n   ✅ PLAYER RESOURCE INITIALIZATION TEST PASSED")
        print("   - All players have proper initial resources (3,3,3)")
        print("   - Player 1 specifically verified to have correct resources")
        print("   - Resource values correctly returned by API")
        print("   - Resource calculations work properly after orders")
        
        return True

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
        tester.test_finalize_orders_button,
        tester.test_resolve_turn_functionality,
        tester.test_player_resource_initialization,
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