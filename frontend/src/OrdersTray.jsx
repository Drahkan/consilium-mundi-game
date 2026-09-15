// OrdersTray — scaffold for the App.js split.
//
// STATUS: scaffold only. The orders panel currently lives in
// `App.js::renderOrdersPanel()` (~line 2883) together with `renderOrderSummary`
// (~line 732) and `renderBuildingPanel` (~line 2778). It reads and writes
// starfleetOrders / buildOrders / espionageOrders — all App-local state.
//
// TODO(App.js split):
//   1. Move renderOrdersPanel + renderOrderSummary + renderBuildingPanel here.
//   2. Convert order mutations to callback props (onIssueFleetOrder,
//      onQueueBuild, onCancelOrder, onSubmitAllOrders).
//   3. Pass in { gameState, currentPlayer, starfleetOrders, buildOrders,
//      espionageOrders, onChange, onSubmit }.
//   4. Keep ResourceHUD separate — it's already extracted.
//
// Until this file is real, App.js keeps its render helpers and this module
// remains a placeholder export to make the intended boundary discoverable.

export default function OrdersTray() {
  return null;
}
