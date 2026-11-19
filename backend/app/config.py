import os
import tempfile
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent

# Models & Binaries directory for embedded llama.cpp engine
MODELS_DIR = BASE_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)
BIN_DIR = BASE_DIR / "bin"
BIN_DIR.mkdir(parents=True, exist_ok=True)
LLAMA_SERVER_EXE = BIN_DIR / "llama" / ("llama-server.exe" if os.name == "nt" else "llama-server")
LLAMA_PORT = 8081
LLAMA_URL = f"http://127.0.0.1:{LLAMA_PORT}"

# Target GGUF Model: Gemma-4-E4B Q4
DEFAULT_GGUF_FILENAME = "gemma-4-E4B-Q4_K_M.gguf"
DEFAULT_GGUF_PATH = MODELS_DIR / DEFAULT_GGUF_FILENAME

# Safe isolated build cache outside OneDrive locking hazards
BUILD_CACHE_DIR = Path(tempfile.gettempdir()) / "botstudio_builds"
BUILD_CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Server Config
HOST = os.getenv("BOTSTUDIO_HOST", "127.0.0.1")
PORT = int(os.getenv("BOTSTUDIO_PORT", "8000"))

# AI Inference Config
DEFAULT_LLM_MODEL = os.getenv("BOTSTUDIO_LLM_MODEL", "google/gemma-4-E4B-Q4_K_M")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")

# Live Runner limits
MAX_LIVE_BOT_RUN_SECONDS = 3600  # 1 hour max for active live test session
