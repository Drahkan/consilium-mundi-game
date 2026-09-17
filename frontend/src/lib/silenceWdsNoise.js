// Silence CRA dev-server / webpack websocket noise so real console errors
// stand out (Grok kernel v5 hosting task 3).
//
// In the emergent preview environment the webpack-dev-server WS at
// `ws(s)://.../ws` cannot complete the upgrade through the ingress and
// prints two lines of red on every reload:
//   • "WebSocket connection to 'ws://localhost:443/ws' failed"
//   • "[webpack-dev-server] Trying to reconnect..."
// Neither reflects an application error and neither is actionable in prod.
//
// We ONLY suppress these specific WDS lines. Everything else (kernel 400s,
// real network errors, React runtime errors, application logs) still
// reaches the console verbatim.
const WDS_NOISE = [
  'webpack-dev-server',
  'WebSocketClient',
  "WebSocket connection to 'ws://",
  "WebSocket connection to 'wss://",
  '/ws failed',
  '/sockjs-node',
];

function isWdsNoise(args) {
  try {
    const first = args[0];
    if (typeof first !== 'string') return false;
    return WDS_NOISE.some((needle) => first.includes(needle));
  } catch {
    return false;
  }
}

for (const level of ['error', 'warn', 'log', 'info']) {
  const original = console[level].bind(console);
  console[level] = (...args) => {
    if (isWdsNoise(args)) return;
    original(...args);
  };
}
