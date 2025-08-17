#!/usr/bin/env python3
"""
Backend API Testing for Consilium Mundi Game
Tests the FastAPI endpoints to ensure proper functionality
"""

import requests
import json
import sys
from datetime import datetime

class ConsiliumMundiAPITester:
    def __init__(self, base_url="https://569b636b-003b-4f01-871f-d973706ff103.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.game_id = None
        self.player_id = None

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED")
        
        if details:
            print(f"   Details: {details}")
        print()

    def test_root_endpoint(self):
        """Test the root endpoint"""
        try:
            response = requests.get(f"{self.base_url}/", timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                details = f"Status: {response.status_code}, Message: {data.get('message', 'N/A')}"
            else:
                details = f"Status: {response.status_code}"
                
            self.log_test("Root Endpoint", success, details)
            return success
            
        except Exception as e:
            self.log_test("Root Endpoint", False, f"Exception: {str(e)}")
            return False

    def test_create_game(self):
        """Test game creation with specific payload from request"""
        try:
            payload = {
                "player_name": "UI Tester",
                "config": {
                    "num_players": 4,
                    "galaxy_size": "standard",
                    "turn_time_limit": 24
                }
            }
            
            response = requests.post(
                f"{self.base_url}/api/create-game",
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=15
            )
            
            success = response.status_code == 200
            
            if success:
                data = response.json()
                self.game_id = data.get('game_id')
                self.player_id = data.get('player_id')
                
                # Validate response structure
                required_fields = ['game_id', 'player_id', 'status']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    success = False
                    details = f"Missing fields: {missing_fields}"
                else:
                    details = f"Game ID: {self.game_id[:8]}..., Player ID: {self.player_id[:8]}..., Status: {data.get('status')}"
            else:
                details = f"Status: {response.status_code}, Response: {response.text[:200]}"
                
            self.log_test("Create Game", success, details)
            return success
            
        except Exception as e:
            self.log_test("Create Game", False, f"Exception: {str(e)}")
            return False

    def test_get_game_state(self):
        """Test getting game state with player_id"""
        if not self.game_id or not self.player_id:
            self.log_test("Get Game State", False, "No game_id or player_id available")
            return False
            
        try:
            response = requests.get(
                f"{self.base_url}/api/game/{self.game_id}/state?player_id={self.player_id}",
                timeout=10
            )
            
            success = response.status_code == 200
            
            if success:
                data = response.json()
                
                # Validate game state structure
                required_fields = ['turn', 'phase', 'systems', 'players', 'player_resources']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    success = False
                    details = f"Missing fields: {missing_fields}"
                else:
                    systems_count = len(data.get('systems', {}))
                    players_count = len(data.get('players', []))
                    
                    # Check if systems array is non-empty
                    if systems_count == 0:
                        success = False
                        details = "Systems array is empty"
                    else:
                        details = f"Turn: {data.get('turn')}, Phase: {data.get('phase')}, Systems: {systems_count}, Players: {players_count}"
                        
                        # Validate player resources
                        player_resources = data.get('player_resources', {})
                        if isinstance(player_resources, dict) and all(key in player_resources for key in ['tech', 'metals', 'chon']):
                            details += f", Resources: T:{player_resources['tech']} M:{player_resources['metals']} C:{player_resources['chon']}"
                        else:
                            details += ", Resources: Invalid structure"
            else:
                details = f"Status: {response.status_code}, Response: {response.text[:200]}"
                
            self.log_test("Get Game State", success, details)
            return success
            
        except Exception as e:
            self.log_test("Get Game State", False, f"Exception: {str(e)}")
            return False

    def test_get_game_players(self):
        """Test getting game players"""
        if not self.game_id:
            self.log_test("Get Game Players", False, "No game_id available")
            return False
            
        try:
            response = requests.get(
                f"{self.base_url}/api/game/{self.game_id}/players",
                timeout=10
            )
            
            success = response.status_code == 200
            
            if success:
                data = response.json()
                
                # Validate players structure
                if 'players' not in data:
                    success = False
                    details = "Missing 'players' field"
                else:
                    players = data['players']
                    if not isinstance(players, list):
                        success = False
                        details = "'players' is not an array"
                    elif len(players) == 0:
                        success = False
                        details = "Players array is empty"
                    else:
                        # Check first player structure
                        first_player = players[0]
                        required_player_fields = ['id', 'name', 'game_id']
                        missing_player_fields = [field for field in required_player_fields if field not in first_player]
                        
                        if missing_player_fields:
                            success = False
                            details = f"Player missing fields: {missing_player_fields}"
                        else:
                            details = f"Players count: {len(players)}, First player: {first_player['name']}"
            else:
                details = f"Status: {response.status_code}, Response: {response.text[:200]}"
                
            self.log_test("Get Game Players", success, details)
            return success
            
        except Exception as e:
            self.log_test("Get Game Players", False, f"Exception: {str(e)}")
            return False

    def test_add_ai_players(self):
        """Test adding AI players to fill the game"""
        if not self.game_id:
            self.log_test("Add AI Players", False, "No game_id available")
            return False
            
        try:
            response = requests.post(
                f"{self.base_url}/api/game/{self.game_id}/add-ai-players",
                timeout=10
            )
            
            success = response.status_code == 200
            
            if success:
                data = response.json()
                details = f"Status: {data.get('status')}, Total players: {data.get('total_players')}, Added: {len(data.get('players_added', []))}"
            else:
                details = f"Status: {response.status_code}, Response: {response.text[:200]}"
                
            self.log_test("Add AI Players", success, details)
            return success
            
        except Exception as e:
            self.log_test("Add AI Players", False, f"Exception: {str(e)}")
            return False

    def test_list_games(self):
        """Test listing all games"""
        try:
            response = requests.get(f"{self.base_url}/api/games", timeout=10)
            
            success = response.status_code == 200
            
            if success:
                data = response.json()
                games_count = len(data.get('games', []))
                details = f"Games listed: {games_count}"
            else:
                details = f"Status: {response.status_code}"
                
            self.log_test("List Games", success, details)
            return success
            
        except Exception as e:
            self.log_test("List Games", False, f"Exception: {str(e)}")
            return False

    def test_lobby_start(self):
        """Test the new lobby start endpoint"""
        if not self.game_id:
            self.log_test("Lobby Start", False, "No game_id available")
            return False
            
        try:
            response = requests.post(
                f"{self.base_url}/api/lobby/{self.game_id}/start",
                timeout=10
            )
            
            success = response.status_code == 200
            
            if success:
                data = response.json()
                
                # Validate response structure
                required_fields = ['status', 'phase']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    success = False
                    details = f"Missing fields: {missing_fields}"
                else:
                    details = f"Status: {data.get('status')}, Phase: {data.get('phase')}"
                    
                    # Check if phase is 'activity' as expected
                    if data.get('phase') != 'activity':
                        details += f" (Expected 'activity', got '{data.get('phase')}')"
            else:
                details = f"Status: {response.status_code}, Response: {response.text[:200]}"
                
            self.log_test("Lobby Start", success, details)
            return success
            
        except Exception as e:
            self.log_test("Lobby Start", False, f"Exception: {str(e)}")
            return False

    def test_login_endpoint(self):
        """Test the new dev login endpoint"""
        try:
            payload = {"name": "Test Player"}
            
            response = requests.post(
                f"{self.base_url}/api/login",
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            success = response.status_code == 200
            
            if success:
                data = response.json()
                
                # Validate response structure
                required_fields = ['token', 'name']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    success = False
                    details = f"Missing fields: {missing_fields}"
                else:
                    token = data.get('token', '')
                    name = data.get('name', '')
                    details = f"Token: {token[:8]}..., Name: {name}"
            else:
                details = f"Status: {response.status_code}, Response: {response.text[:200]}"
                
            self.log_test("Login Endpoint", success, details)
            return success
            
        except Exception as e:
            self.log_test("Login Endpoint", False, f"Exception: {str(e)}")
            return False

    def test_lobby_create(self):
        """Test lobby creation with join code"""
        try:
            payload = {"name": "UI QA"}
            
            response = requests.post(
                f"{self.base_url}/api/lobby/create",
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            success = response.status_code == 200
            
            if success:
                data = response.json()
                
                # Validate response structure
                required_fields = ['game_id', 'player_id', 'token', 'join_code']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    success = False
                    details = f"Missing fields: {missing_fields}"
                else:
                    join_code = data.get('join_code', '')
                    # Store for join test
                    self.join_code = join_code
                    self.lobby_game_id = data.get('game_id')
                    details = f"Join Code: {join_code} (length: {len(join_code)}), Game ID: {data.get('game_id')[:8]}..."
                    
                    # Validate join code is 6 characters
                    if len(join_code) != 6:
                        success = False
                        details += f" - ERROR: Join code should be 6 characters, got {len(join_code)}"
            else:
                details = f"Status: {response.status_code}, Response: {response.text[:200]}"
                
            self.log_test("Lobby Create", success, details)
            return success
            
        except Exception as e:
            self.log_test("Lobby Create", False, f"Exception: {str(e)}")
            return False

    def test_lobby_join(self):
        """Test joining lobby with join code"""
        if not hasattr(self, 'join_code') or not self.join_code:
            self.log_test("Lobby Join", False, "No join_code available from lobby create")
            return False
            
        try:
            payload = {"join_code": self.join_code, "name": "Join QA"}
            
            response = requests.post(
                f"{self.base_url}/api/lobby/join",
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            success = response.status_code == 200
            
            if success:
                data = response.json()
                
                # Validate response structure
                required_fields = ['game_id', 'player_id', 'token']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    success = False
                    details = f"Missing fields: {missing_fields}"
                else:
                    details = f"Joined Game ID: {data.get('game_id')[:8]}..., Player ID: {data.get('player_id')[:8]}..."
                    
                    # Verify same game_id as lobby create
                    if hasattr(self, 'lobby_game_id') and data.get('game_id') == self.lobby_game_id:
                        details += " - Same game as lobby create ✓"
                    else:
                        details += " - Different game than lobby create ⚠️"
            else:
                details = f"Status: {response.status_code}, Response: {response.text[:200]}"
                
            self.log_test("Lobby Join", success, details)
            return success
            
        except Exception as e:
            self.log_test("Lobby Join", False, f"Exception: {str(e)}")
            return False

    def test_lobby_status(self):
        """Test lobby status endpoint"""
        if not hasattr(self, 'lobby_game_id') or not self.lobby_game_id:
            self.log_test("Lobby Status", False, "No lobby_game_id available")
            return False
            
        try:
            response = requests.get(
                f"{self.base_url}/api/lobby/{self.lobby_game_id}",
                timeout=10
            )
            
            success = response.status_code == 200
            
            if success:
                data = response.json()
                
                # Validate response structure
                required_fields = ['game_id', 'players', 'join_code']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    success = False
                    details = f"Missing fields: {missing_fields}"
                else:
                    players = data.get('players', [])
                    join_code = data.get('join_code', '')
                    details = f"Players: {len(players)}, Join Code: {join_code}"
                    
                    # Check if join code matches
                    if hasattr(self, 'join_code') and join_code == self.join_code:
                        details += " - Join code matches ✓"
                    else:
                        details += " - Join code mismatch ⚠️"
            else:
                details = f"Status: {response.status_code}, Response: {response.text[:200]}"
                
            self.log_test("Lobby Status", success, details)
            return success
            
        except Exception as e:
            self.log_test("Lobby Status", False, f"Exception: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all backend tests in sequence"""
        print("🚀 Starting Consilium Mundi Backend API Tests")
        print(f"🌐 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Test sequence
        tests = [
            self.test_root_endpoint,
            self.test_lobby_create,  # Test lobby creation first
            self.test_lobby_status,  # Test lobby status
            self.test_lobby_join,    # Test joining lobby
            self.test_create_game,
            self.test_get_game_state,
            self.test_get_game_players,
            self.test_add_ai_players,
            self.test_lobby_start,  # New test for lobby start
            self.test_login_endpoint,  # New test for login
            self.test_list_games
        ]
        
        for test in tests:
            test()
        
        # Summary
        print("=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All backend tests PASSED!")
            return 0
        else:
            print("⚠️  Some backend tests FAILED!")
            return 1

def main():
    """Main test execution"""
    tester = ConsiliumMundiAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())