// MapCanvas — scaffold for the App.js split.
//
// STATUS: scaffold only. The real galaxy map render lives in
// `App.js::renderGalaxyMap()` (lines ~1774–2778) and touches ~40 pieces of
// App-local state (fleet orders, drag state, selection, fog, replay frame,
// rally lines, etc.). Extracting it into a self-contained component requires
// either lifting that state to a context or threading it as props. Doing that
// in the same pass as the kernel v3 wrap would risk regressing the core
// game loop, so this file marks the extraction target for a follow-up.
//
// TODO(App.js split):
//   1. Move renderGalaxyMap's JSX return into <MapCanvas /> here.
//   2. Convert the closures it uses (getSystemColor, handleSystemClick,
//      renderConnections, renderOrderArrows, renderRallyLine, etc.) into
//      pure helpers or MapCanvas methods.
//   3. Pass in { gameState, currentPlayer, selectedSystem, starfleetOrders,
//      buildOrders, orderMode, onSelectSystem, onIssueOrder, replayFrame }.
//   4. Keep DiplomacyPouch and ObligationsHUD outside — they already own
//      their own state.
//
// Until this file is real, App.js keeps renderGalaxyMap() and this module
// remains a placeholder export to make the intended boundary discoverable.

export default function MapCanvas() {
  return null;
}
