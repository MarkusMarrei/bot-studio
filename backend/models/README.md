# Local Models Directory

This directory stores offline GGUF neural network weights for the embedded AI copilot engine (powered by `llama.cpp`).

## Automatic Download
In the Bot Studio IDE, open the **AI Assistant** drawer and click **Download** to automatically fetch the recommended GGUF model (`gemma-4-E4B-Q4_K_M.gguf` or compatible weights) directly into this folder.

## Manual Installation
You can place any compatible `.gguf` model here manually:
1. Download your preferred GGUF file (e.g. from Hugging Face).
2. Name it `gemma-4-E4B-Q4_K_M.gguf` (or configure `DEFAULT_GGUF_FILENAME` in `backend/app/config.py`).
3. Click **Start** in the AI Assistant drawer.
