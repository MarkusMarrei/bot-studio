#!/usr/bin/env bash
# =====================================================================
#                BOT STUDIO IDE - UNIVERSAL LAUNCHER
#         Cross-Platform Runner for Linux (Ubuntu/Debian/Arch) & macOS
# =====================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "====================================================================="
echo "               BOT STUDIO IDE - UNIVERSAL LAUNCHER"
echo "             Visual Telegram Bot Engineering Platform"
echo "====================================================================="
echo ""

# 1. Check Python 3
echo "[1/4] Checking Python 3..."
if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON_CMD="python"
else
    echo "❌ ERROR: Python 3 is not installed!"
    echo "On Ubuntu/Debian: sudo apt update && sudo apt install -y python3 python3-pip python3-venv"
    echo "On macOS: brew install python"
    exit 1
fi
echo "  Found Python: $($PYTHON_CMD --version)"

# 2. Check Node.js and npm
echo ""
echo "[2/4] Checking Node.js and npm..."
if ! command -v node >/dev/null 2>&1; then
    echo "❌ ERROR: Node.js is not installed!"
    echo "Please install Node.js 18+ from https://nodejs.org/ or via your package manager."
    exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
    echo "❌ ERROR: npm is not installed!"
    exit 1
fi
echo "  Found Node: $(node --version)"
echo "  Found npm:  $(npm --version)"

# 3. Setup Backend
echo ""
echo "[3/4] Preparing Backend dependencies..."
cd "$SCRIPT_DIR/backend"
if [ ! -d "venv" ]; then
    echo "  Creating virtual environment in backend/venv..."
    $PYTHON_CMD -m venv venv || true
fi

if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
    PIP_CMD="pip"
    UVICORN_CMD="uvicorn"
else
    PIP_CMD="$PYTHON_CMD -m pip"
    UVICORN_CMD="$PYTHON_CMD -m uvicorn"
fi

$PIP_CMD install --quiet -r requirements.txt || echo "⚠️ Warning during pip install, trying to proceed..."

# 4. Setup Frontend
echo ""
echo "[4/4] Preparing Frontend dependencies..."
cd "$SCRIPT_DIR/frontend"
if [ ! -d "node_modules" ]; then
    echo "  Installing npm packages (first run only)..."
    npm install
fi

# Cleanup child processes on exit
cleanup() {
    echo ""
    echo "Stopping Bot Studio services..."
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 5. Launch Servers
echo ""
echo "====================================================================="
echo "  Starting Bot Studio IDE:"
echo "  - Backend API:  http://127.0.0.1:8000"
echo "  - Frontend IDE: http://127.0.0.1:5173"
echo "====================================================================="
echo ""

cd "$SCRIPT_DIR/backend"
$UVICORN_CMD app.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

sleep 2

# Auto-open browser
if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://127.0.0.1:5173" >/dev/null 2>&1 &
elif command -v open >/dev/null 2>&1; then
    open "http://127.0.0.1:5173" >/dev/null 2>&1 &
fi

cd "$SCRIPT_DIR/frontend"
npm run dev -- --host 127.0.0.1 --port 5173
