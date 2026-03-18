#!/bin/bash
set -euo pipefail

LIVEKIT_URL="${LIVEKIT_URL:-ws://localhost:7880}"
LIVEKIT_API_KEY="${LIVEKIT_API_KEY:-APIdJhgr9E3fvSp}"
LIVEKIT_API_SECRET="${LIVEKIT_API_SECRET:-TjSg8VhSIMnNrCBbhvXgSNqCjzxJXYsLNJEnwqSAhqKR}"

export LIVEKIT_URL LIVEKIT_API_KEY LIVEKIT_API_SECRET

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$SCRIPT_DIR/../agent"

echo "=== Setting up SIP trunks and dispatch rules ==="
echo "LiveKit URL: $LIVEKIT_URL"

echo ""
echo "--- Creating inbound trunk ---"
lk sip inbound create "$AGENT_DIR/inbound-trunk.json"

echo ""
echo "--- Creating outbound trunk ---"
lk sip outbound create "$AGENT_DIR/outbound-trunk.json"

echo ""
echo "--- Creating dispatch rule ---"
lk sip dispatch create "$AGENT_DIR/dispatch-rule.json"

echo ""
echo "=== SIP setup complete ==="
echo ""
echo "Verify with:"
echo "  lk sip inbound list"
echo "  lk sip outbound list"
echo "  lk sip dispatch list"
