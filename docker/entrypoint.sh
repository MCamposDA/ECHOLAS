#!/bin/bash
# =============================================================================
# ECHOLAS — container entrypoint
# =============================================================================
# Prints a friendly banner with the dashboard URL, then starts the web server.
# Runs every time the container starts (`docker compose up`).
# =============================================================================

# Detect the port (defaults to 8080). docker-compose maps it to host:8080.
PORT="${ECHOLAS_PORT:-8080}"
URL="http://localhost:${PORT}"

# ANSI colors — only emit them if the terminal supports color.
if [ -t 1 ] && [ -z "$NO_COLOR" ]; then
    BOLD=$'\033[1m'
    TEAL=$'\033[38;5;30m'
    DIM=$'\033[2m'
    RESET=$'\033[0m'
else
    BOLD=""; TEAL=""; DIM=""; RESET=""
fi

cat <<EOF

${TEAL}${BOLD}╔══════════════════════════════════════════════════════════════════╗
║  ECHOLAS dashboard is ready                                      ║
╠══════════════════════════════════════════════════════════════════╣${RESET}
${TEAL}║${RESET}                                                                  ${TEAL}║${RESET}
${TEAL}║${RESET}    ${BOLD}Open in your browser:${RESET}                                         ${TEAL}║${RESET}
${TEAL}║${RESET}                                                                  ${TEAL}║${RESET}
${TEAL}║${RESET}        ${BOLD}→  ${URL}${RESET}                                ${TEAL}║${RESET}
${TEAL}║${RESET}                                                                  ${TEAL}║${RESET}
${TEAL}║${RESET}    ${DIM}(Ctrl+click the link above in most modern terminals,${RESET}         ${TEAL}║${RESET}
${TEAL}║${RESET}     ${DIM}or copy and paste it into your browser.)${RESET}                    ${TEAL}║${RESET}
${TEAL}║${RESET}                                                                  ${TEAL}║${RESET}
${TEAL}║${RESET}    ${DIM}Press Ctrl+C in this terminal to stop the dashboard.${RESET}         ${TEAL}║${RESET}
${TEAL}║${RESET}                                                                  ${TEAL}║${RESET}
${TEAL}${BOLD}╚══════════════════════════════════════════════════════════════════╝${RESET}

EOF

# Hand control over to uvicorn (the web server).
exec uvicorn backend:app --host 0.0.0.0 --port "${PORT}"
