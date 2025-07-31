import requests
import sys
import json
from datetime import datetime

class ConsiliumMundiAPITester:
    def __init__(self, base_url="https://12187e21-0bc0-4be3-92a5-546c251df7e9.preview.emergentagent.com"):
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