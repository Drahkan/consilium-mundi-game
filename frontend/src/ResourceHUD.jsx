import React from 'react';

// Top-bar resource chip. Extracted from App.js as the first component in
// Grok's App.js split (MapCanvas / OrdersTray / ResourceHUD).
// Renders the current player's Tech / Metals / CHON. Empty when the state
// has no player_resources (e.g. during setup or between resolves).
export default function ResourceHUD({ resources }) {
  if (!resources) return null;
  return (
    <span className="resources-info" data-testid="resource-hud">
      | T:{resources.tech} M:{resources.metals} C:{resources.chon}
    </span>
  );
}
