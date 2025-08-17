# E2E Test Plan: Dev Mode vs Normal Mode Parity

This plan verifies that shared game flows behave identically in Dev Mode and "normal" UI mode.

Key flows:
1. Create game (enter name, Create New Game)
2. Start lobby (either auto-add AI or use Start Lobby button)
3. Switch players (player selector visible in Dev Mode and Testing Mode)
4. Open Build panel, add a build order, review resource warnings and impacts
5. Submit orders and resolve turn

Expected parity:
- Build costs, resource changes, and warnings should be identical regardless of Dev Mode toggle.
- UI actions should call the same /api endpoints.

Playwright Notes:
- Set localStorage.devMode = '1' to enable Dev Mode controls explicitly.
- Frontend base URL is defined in frontend/.env (REACT_APP_BACKEND_URL). Use it for non-/api routes.