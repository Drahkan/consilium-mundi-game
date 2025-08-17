#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: Transfer full Consilium Mundi repo into active app, preserve env vars, run under supervisor, and verify warning system works.

backend:
  - task: "Sync Consilium Mundi backend/server.py"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Replaced backend/server.py with repo version. Supervisor restarted. Health confirmed."
  - task: "API basic smoke test"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "curl POST /api/create-game returned game_id and player_id. GET state and players succeeded."

frontend:
  - task: "Sync Consilium Mundi frontend App.js/App.css and src"
    implemented: true
    working: true
    file: "/app/frontend/src/App.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Synced full src and styles. Supervisor restarted. UI loads at provided URL. Landing screenshot captured."
  - task: "Basic UI flow"
    implemented: true
    working: true
    file: "/app/frontend/src/App.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Verified landing loads. Next: create game, auto-add AI, open build panel, verify warning dialogs show as per resource impact."

metadata:
  created_by: "main_agent"
  version: "1.2"
  test_sequence: 4
  run_ui: true

recent_changes:
  - date: "2025-08-16"
    summary: "Phase 1 persistence (optional Mongo) + Dev Mode controls + Start Lobby endpoint"
    backend:
      - file: "/app/backend/persistence.py"
        change: "Add GameDAO with save/load/list; UUID-only; no URL hardcoding"
      - file: "/app/backend/server.py"
        change: "Hook persistence on mutating routes; lazy-load on state/players; POST /api/lobby/{game_id}/start; POST /api/login"
    frontend:
      - file: "/app/frontend/src/App.js"
        change: "Add devMode toggle (localStorage), Start Lobby button, show Dev/Testing controls when testingMode||devMode"
      - file: "/app/frontend/src/App.css"
        change: "Styles for dev toggle and Start Lobby buttons"

verification:
  - step: "Create game via UI, enable Dev Mode, Start Lobby"
    result: "Phase shows activity; starfleets at home; player selector visible; Build panel accessible"
  - step: "Backend curl POST /api/lobby/{game_id}/start"
    result: "Returns {status: started, phase: activity}"
  - step: "Persistence check"
    result: "games count increased in Mongo; after backend restart, GET state by game_id loads successfully (lazy-load)"

test_plan:
  current_focus:
    - "Create game from UI and verify game state loads"
    - "Open a home system, place build orders, verify resource warning/impact dialogs"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "Repo synced into active /app. Services restarted via supervisor. Backend curl tests passed. Landing screenshot saved during automation run. Proceed with UI flow validations."