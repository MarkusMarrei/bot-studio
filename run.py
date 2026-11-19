#!/usr/bin/env python
"""
Bot Studio IDE — Master Launcher
Clean startup: handles port cleanup, system RAM telemetry, and opens the Web UI.
"""
import sys
import os
import time
import threading
import webbrowser
from pathlib import Path

# Add backend to sys.path
BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.config import HOST, PORT, DEFAULT_LLM_MODEL
from app.utils.system_diag import get_system_diagnostics
from app.utils.process_cleaner import is_port_in_use, kill_process_on_port

def open_browser():
    """Wait for server to bind and launch the browser."""
    time.sleep(1.2)
    url = f"http://{HOST}:{PORT}"
    print(f"\n🚀 Opening Bot Studio IDE in your default browser: {url}\n")
    webbrowser.open(url)

def main():
    print("=" * 65)
    print("           BOT STUDIO IDE — Visual Compiler (aiogram 3.x)")
    print("=" * 65)

    # 1. System diagnostics (Win32 ctypes from BPMN Studio)
    diag = get_system_diagnostics()
    print(f"🖥  OS: {diag['os']} {diag['platform_release']} (Python {diag['python_version']})")
    print(f"🧠 RAM: {diag['avail_ram_gb']} GB available / {diag['total_ram_gb']} GB total")
    print(f"🤖 Default AI Target: {DEFAULT_LLM_MODEL}")
    print(f"💡 Recommended Tier: {diag['recommended_model_tier']}")

    # 2. Port check and orphan cleanup (SREDA AI pattern)
    if is_port_in_use(PORT, HOST):
        print(f"⚠️  Port {PORT} is currently occupied. Terminating orphan process...")
        kill_process_on_port(PORT)
        time.sleep(0.5)

    # 3. Schedule browser open
    threading.Thread(target=open_browser, daemon=True).start()

    # 4. Start Uvicorn
    import uvicorn
    from app.main import app
    print(f"⚡ Server starting on http://{HOST}:{PORT} ... (Press Ctrl+C to stop)")
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")

if __name__ == "__main__":
    main()
