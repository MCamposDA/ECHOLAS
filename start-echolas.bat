@echo off
setlocal enabledelayedexpansion
REM =============================================================================
REM ECHOLAS - start launcher (Windows)
REM =============================================================================
REM Double-click this file in File Explorer, or run from cmd.exe / PowerShell.
REM Requires: Docker Desktop installed and running.
REM =============================================================================

cd /d "%~dp0"

set "URL=http://localhost:8080"

echo.
echo   ============================================================
echo                     ECHOLAS  -  launcher
echo   ============================================================
echo.

REM ----- 1. Docker installed? -----
where docker >nul 2>&1
if errorlevel 1 (
    echo   X  Docker is not installed or not on PATH.
    echo.
    echo      Install Docker Desktop: https://www.docker.com/products/docker-desktop/
    echo      Then restart your computer and run this script again.
    echo.
    pause
    exit /b 1
)

REM ----- 2. Docker daemon running? -----
docker info >nul 2>&1
if errorlevel 1 (
    echo   X  Docker is installed, but the engine is not running.
    echo.
    echo      1. Open Docker Desktop ^(whale icon in the system tray^).
    echo      2. Wait until it says "Docker Desktop is running".
    echo      3. Run this script again.
    echo.
    pause
    exit /b 1
)

REM ----- 3. docker compose v2 available? -----
docker compose version >nul 2>&1
if errorlevel 1 (
    echo   X  docker compose v2 not found.
    echo      Upgrade Docker Desktop. The old "docker-compose" command is not supported.
    echo.
    pause
    exit /b 1
)

echo   Docker OK. Building / starting the container ...
echo.

REM ----- 4. Start the container -----
docker compose up -d --build
if errorlevel 1 (
    echo.
    echo   X  docker compose up failed. See the error message above.
    echo      Common causes:
    echo         - Out of disk space     ^> docker system prune -a
    echo         - Port 8080 in use      ^> edit docker-compose.yml, change to 9090:8080
    echo.
    pause
    exit /b 1
)

echo.
echo   Waiting for dashboard to come online ...
set "READY="
for /l %%i in (1,1,60) do (
    curl -fsS %URL%/api/files >nul 2>&1
    if not errorlevel 1 (
        set "READY=1"
        goto :ready
    )
    <nul set /p "=."
    timeout /t 1 /nobreak >nul
)

:ready
echo.
if defined READY (
    echo   Ready! Opening browser ...
) else (
    echo   Dashboard did not respond after 60 seconds.
    echo   Check container logs with:  docker compose logs echolas
    echo   Trying to open the browser anyway ...
)
echo.

start "" "%URL%"

echo   ============================================================
echo     Dashboard: %URL%
echo     Stop with: stop-echolas.bat  ^(or  docker compose down^)
echo   ============================================================
echo.
echo   You can close this window now.
pause
