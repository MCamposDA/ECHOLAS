#!/usr/bin/env bash
# Stop the ECHOLAS container.
cd "$(dirname "$0")" || exit 1
echo ""
echo "  Stopping ECHOLAS ..."
docker compose down
echo ""
echo "  ✓ Stopped."
read -p "  Press Enter to close..."
