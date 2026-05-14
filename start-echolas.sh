#!/usr/bin/env bash
# =============================================================================
# ECHOLAS — start launcher (Linux / macOS / WSL2)
# =============================================================================
# Usage:
#   chmod +x start-echolas.sh   (only the first time)
#   ./start-echolas.sh
#
# What it does:
#   1. Verifies Docker is installed and running
#   2. Builds the image if needed, then starts the container
#   3. Waits for the dashboard to respond
#   4. Opens your browser to http://localhost:8080
#   5. Prints clear errors and pauses if anything fails
# =============================================================================

cd "$(dirname "$0")" || {
  echo "ERROR: could not cd into script directory"
  read -p "Press Enter to close..."
  exit 1
}

URL="http://localhost:8080"

# ----- pretty banner -----
echo ""
echo "  ╔════════════════════════════════════════════════════════════╗"
echo "  ║                    ECHOLAS  —  launcher                    ║"
echo "  ╚════════════════════════════════════════════════════════════╝"
echo ""

# ----- 1. Docker installed? -----
if ! command -v docker >/dev/null 2>&1; then
  echo "  ✗ Docker is not installed (or not on your PATH)."
  echo ""
  echo "    Install Docker Desktop:  https://www.docker.com/products/docker-desktop/"
  echo "    Then enable WSL2 integration → restart this script."
  echo ""
  read -p "  Press Enter to close..."
  exit 1
fi

# ----- 2. Docker daemon running? -----
if ! docker info >/dev/null 2>&1; then
  echo "  ✗ Docker is installed, but the engine is not running."
  echo ""
  echo "    1. Open Docker Desktop on Windows (whale icon in the system tray)."
  echo "    2. Wait until it says \"Docker Desktop is running\"."
  echo "    3. Run this script again."
  echo ""
  read -p "  Press Enter to close..."
  exit 1
fi

# ----- 3. docker compose available? (v2 plugin) -----
if ! docker compose version >/dev/null 2>&1; then
  echo "  ✗ docker compose v2 not found."
  echo "    Install/upgrade Docker Desktop — older 'docker-compose' (with hyphen) is not supported."
  echo ""
  read -p "  Press Enter to close..."
  exit 1
fi

echo "  Docker OK. Building / starting the container ..."
echo ""

# ----- 4. Start (build if needed, detached) -----
if ! docker compose up -d --build; then
  echo ""
  echo "  ✗ docker compose up failed. See the error message above."
  echo "    Common causes:"
  echo "       • Out of disk space   →  docker system prune -a"
  echo "       • Port 8080 in use    →  edit docker-compose.yml, change 8080:8080 to 9090:8080"
  echo ""
  read -p "  Press Enter to close..."
  exit 1
fi

# ----- 5. Wait for backend to answer -----
echo ""
echo -n "  Waiting for dashboard to come online "
for i in $(seq 1 60); do
  if curl -fsS "${URL}/api/files" >/dev/null 2>&1; then
    echo " ✓ ready"
    READY=1
    break
  fi
  echo -n "."
  sleep 1
done
echo ""

if [ -z "$READY" ]; then
  echo "  ⚠ Dashboard didn't respond after 60 seconds."
  echo "    Check the container logs:    docker compose logs echolas"
  echo "    You can still try opening:   ${URL}"
  read -p "  Press Enter to continue and open the browser anyway..."
fi

# ----- 6. Open the browser -----
open_url() {
  if   command -v wslview        >/dev/null 2>&1; then wslview "$1"
  elif command -v powershell.exe >/dev/null 2>&1; then powershell.exe -c "Start-Process '$1'" 2>/dev/null
  elif command -v xdg-open       >/dev/null 2>&1; then xdg-open "$1" >/dev/null 2>&1 &
  elif command -v open           >/dev/null 2>&1; then open "$1"
  else
    return 1
  fi
}

if ! open_url "${URL}"; then
  echo ""
  echo "  Could not auto-open your browser."
  echo "  Open this address manually:"
  echo "       →  ${URL}"
fi

echo ""
echo "  ┌────────────────────────────────────────────────────────────┐"
echo "  │  Dashboard:  ${URL}                          │"
echo "  │  Stop with:  ./stop-echolas.sh   (or  docker compose down) │"
echo "  └────────────────────────────────────────────────────────────┘"
echo ""
