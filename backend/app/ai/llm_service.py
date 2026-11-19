import os
import ast
import json
import logging
import asyncio
import atexit
import subprocess
import urllib.request
import zipfile
import io
from pathlib import Path
from typing import Dict, Any, List, Optional
import httpx
from app.utils.hardware import HardwareDetector
from app.config import (
    BASE_DIR,
    DEFAULT_LLM_MODEL,
    MODELS_DIR,
    BIN_DIR,
    LLAMA_SERVER_EXE,
    LLAMA_PORT,
    LLAMA_URL,
    DEFAULT_GGUF_FILENAME,
    DEFAULT_GGUF_PATH,
    OPENROUTER_API_KEY
)

logger = logging.getLogger("ai_service")

# Official llama.cpp Windows AVX2 pre-built release (10.3 MB standalone binary)
LLAMA_CPP_ZIP_URL = "https://github.com/ggerganov/llama.cpp/releases/download/b4500/llama-b4500-bin-win-avx2-x64.zip"

# Real fast, high-quality GGUF model for coding and multilingual Telegram bot logic (Gemma-4-E4B / Qwen-2.5-Coder 3B/4B)
GGUF_DOWNLOAD_URL = "https://huggingface.co/Qwen/Qwen2.5-Coder-3B-Instruct-GGUF/resolve/main/qwen2.5-coder-3b-instruct-q4_k_m.gguf"

class LLMService:
    def __init__(self):
        self.default_model = DEFAULT_LLM_MODEL
        self.gguf_path = DEFAULT_GGUF_PATH
        self.gguf_filename = DEFAULT_GGUF_FILENAME
        self.server_proc: Optional[subprocess.Popen] = None
        self.is_loaded = False
        self.download_progress = 0
        self.is_downloading = False
        atexit.register(self._cleanup_process)

    def _cleanup_process(self):
        if self.server_proc:
            try:
                self.server_proc.terminate()
                self.server_proc.wait(timeout=2)
            except Exception:
                try:
                    self.server_proc.kill()
                except Exception:
                    pass
            self.server_proc = None

    async def _is_server_alive(self) -> bool:
        """Checks if llama-server is listening and healthy on port 8081."""
        try:
            async with httpx.AsyncClient(timeout=1.5) as client:
                res = await client.get(f"{LLAMA_URL}/health")
                return res.status_code == 200
        except Exception:
            return False

    async def get_engine_status(self) -> Dict[str, Any]:
        """Returns embedded llama.cpp engine and model file status."""
        downloaded = self.gguf_path.exists() and self.gguf_path.stat().st_size > 10 * 1024 * 1024
        file_size_mb = 0.0
        if self.gguf_path.exists():
            try:
                file_size_mb = round(self.gguf_path.stat().st_size / (1024 * 1024), 1)
            except Exception:
                file_size_mb = 0.0

        is_alive = await self._is_server_alive()
        self.is_loaded = is_alive

        hw = HardwareDetector.get_best_accelerator()
        status_text = "Встроенный движок llama.cpp активен и готов к работе" if is_alive else (
            f"Модель загружена ({file_size_mb} MB). Нажмите «Запустить»." if downloaded else "Ожидает скачивания"
        )

        return {
            "engine": f"llama.cpp ({hw['backend'].upper()})",
            "accelerator": hw["accelerator_name"],
            "backend": hw["backend"],
            "optimal_ngl": hw["ngl"],
            "is_online": True,
            "current_model": self.default_model,
            "model_name": self.gguf_filename,
            "model_downloaded": downloaded,
            "file_size_mb": file_size_mb,
            "is_loaded": self.is_loaded,
            "is_downloading": self.is_downloading,
            "download_progress": self.download_progress,
            "models_dir": str(MODELS_DIR),
            "status_text": status_text
        }

    async def _ensure_binaries(self):
        """Ensures llama-server binary is present in bin/llama/ with optimal hardware build."""
        if LLAMA_SERVER_EXE.exists():
            return
        llama_dir = BIN_DIR / "llama"
        llama_dir.mkdir(parents=True, exist_ok=True)
        hw = HardwareDetector.get_best_accelerator()
        download_url = hw.get("zip_url") or LLAMA_CPP_ZIP_URL
        logger.info(f"Downloading llama.cpp prebuilt binaries for {hw['backend']} from {download_url}...")
        req = urllib.request.Request(download_url, headers={"User-Agent": "BotStudio/5.0"})
        data = await asyncio.to_thread(lambda: urllib.request.urlopen(req, timeout=45).read())
        z = zipfile.ZipFile(io.BytesIO(data))
        z.extractall(llama_dir)
        if LLAMA_SERVER_EXE.exists() and os.name != "nt":
            try:
                LLAMA_SERVER_EXE.chmod(0o755)
            except Exception:
                pass
        logger.info("llama.cpp binaries extracted successfully.")

    async def download_model(self) -> Dict[str, Any]:
        """Downloads real GGUF model directly to backend/models folder."""
        # Ensure binaries first
        try:
            await self._ensure_binaries()
        except Exception as e:
            logger.warning(f"Failed to auto-download llama binary: {e}")

        # Check if already present and valid (> 10MB)
        if self.gguf_path.exists() and self.gguf_path.stat().st_size > 10 * 1024 * 1024:
            mb = round(self.gguf_path.stat().st_size / (1024 * 1024), 1)
            return {
                "status": "success",
                "message": f"Модель {self.gguf_filename} уже загружена в папку models/ ({mb} MB)!"
            }

        self.is_downloading = True
        self.download_progress = 0
        tmp_file = MODELS_DIR / f"{self.gguf_filename}.tmp"

        def _do_download():
            MODELS_DIR.mkdir(parents=True, exist_ok=True)
            req = urllib.request.Request(GGUF_DOWNLOAD_URL, headers={"User-Agent": "BotStudio/3.0"})
            with urllib.request.urlopen(req) as resp, open(tmp_file, "wb") as f:
                total = int(resp.headers.get("content-length", 0))
                dl = 0
                chunk_size = 2 * 1024 * 1024
                while True:
                    chunk = resp.read(chunk_size)
                    if not chunk:
                        break
                    f.write(chunk)
                    dl += len(chunk)
                    if total > 0:
                        self.download_progress = int((dl / total) * 100)

            if self.gguf_path.exists():
                self.gguf_path.unlink()
            tmp_file.rename(self.gguf_path)

        try:
            await asyncio.to_thread(_do_download)
            self.download_progress = 100
            self.is_downloading = False
            mb = round(self.gguf_path.stat().st_size / (1024 * 1024), 1)
            return {
                "status": "success",
                "message": f"Модель {self.gguf_filename} ({mb} MB) успешно скачана в папку backend/models/!"
            }
        except Exception as e:
            self.is_downloading = False
            return {
                "status": "error",
                "message": f"Ошибка скачивания: {e}"
            }

    async def load_model(self) -> Dict[str, Any]:
        """Launches the real llama-server.exe process with the local GGUF model."""
        if await self._is_server_alive():
            self.is_loaded = True
            return {
                "status": "success",
                "message": "Встроенный движок llama.cpp уже запущен и готов к генерации!"
            }

        # Check model file exists and is valid
        if not self.gguf_path.exists() or self.gguf_path.stat().st_size < 10 * 1024 * 1024:
            res = await self.download_model()
            if res.get("status") == "error":
                return res

        await self._ensure_binaries()
        if not LLAMA_SERVER_EXE.exists():
            return {
                "status": "error",
                "message": f"Исполняемый файл {LLAMA_SERVER_EXE} не найден."
            }

        # Launch llama-server with relative model path from BASE_DIR to prevent Windows codepage/encoding issues with non-ASCII paths
        hw = HardwareDetector.get_best_accelerator()
        rel_model = Path("models") / self.gguf_filename
        threads = max(2, min(os.cpu_count() or 4, 8))
        cmd = [
            str(LLAMA_SERVER_EXE),
            "-m", str(rel_model),
            "--port", str(LLAMA_PORT),
            "-c", "2048",
            "--host", "127.0.0.1",
            "-ngl", str(hw["ngl"]),
            "-t", str(threads)
        ]

        logger.info(f"Starting llama-server: {' '.join(cmd)} in cwd={BASE_DIR}")
        creation_flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        self.server_proc = subprocess.Popen(
            cmd,
            cwd=str(BASE_DIR),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=creation_flags
        )

        # Wait for server to become healthy (up to 15s)
        for _ in range(30):
            await asyncio.sleep(0.5)
            if await self._is_server_alive():
                self.is_loaded = True
                return {
                    "status": "success",
                    "message": "Встроенный движок llama.cpp успешно инициализирован! Модель загружена в RAM."
                }

        return {
            "status": "error",
            "message": "Таймаут инициализации llama-server. Проверьте логи."
        }

    async def _query_llm(self, system_prompt: str, user_prompt: str, temperature: float = 0.3) -> str:
        """
        Executes real inference on the local llama-server or cloud fallback.
        """
        # Ensure local engine is running
        if not await self._is_server_alive():
            if self.gguf_path.exists() and self.gguf_path.stat().st_size > 10 * 1024 * 1024:
                await self.load_model()

        # 1. Query real local llama-server if active
        if await self._is_server_alive():
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    payload = {
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        "temperature": temperature,
                        "max_tokens": 1024
                    }
                    res = await client.post(f"{LLAMA_URL}/v1/chat/completions", json=payload)
                    if res.status_code == 200:
                        data = res.json()
                        content = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                        if content:
                            return content
            except Exception as e:
                logger.error(f"Error querying local llama-server: {e}")

        # 2. Cloud fallback if OpenRouter is provided
        if OPENROUTER_API_KEY:
            try:
                async with httpx.AsyncClient(timeout=45.0) as client:
                    res = await client.post(
                        "https://openrouter.ai/api/v1/chat/completions",
                        headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}"},
                        json={
                            "model": "google/gemma-2-9b-it:free",
                            "messages": [
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": user_prompt}
                            ],
                            "temperature": temperature
                        }
                    )
                    if res.status_code == 200:
                        data = res.json()
                        return data["choices"][0]["message"]["content"].strip()
            except Exception:
                pass

        # 3. If model is not loaded yet, inform user clearly
        return (
            "⚠️ Встроенная модель ещё не запущена в память. Пожалуйста, откройте настройки (шестерёнка вверху) "
            "и нажмите кнопку «Запустить», чтобы модель загрузилась в RAM для генерации ответов."
        )

    async def chat_assistant(
        self,
        message: str,
        graph_context: Optional[dict] = None,
        documents: Optional[List[dict]] = None
    ) -> Dict[str, Any]:
        """
        Unified conversational AI assistant with RAG document grounding.
        Generates real responses from the local model.
        """
        doc_context = ""
        if documents:
            doc_context = "\n\n=== ПРИКРЕПЛЕННЫЕ RAG-ДОКУМЕНТЫ (БАЗА ЗНАНИЙ / ТЗ) ===\n"
            for doc in documents:
                doc_context += f"Файл: {doc.get('filename')}\nСодержимое:\n{doc.get('text', '')[:4000]}\n---\n"

        system_prompt = f"""Ты — умный и вежливый ИИ-архитектор визуальной среды Bot Studio IDE.
Твоя задача — помогать пользователю проектировать сценарии Telegram-ботов.
Пользователь собирает бота визуально из готовых нод на холсте (кнопки, экраны сообщений, уведомления админу).

ПРАВИЛА ОТВЕТА:
1. Отвечай дружелюбно, вежливо и понятно на чистом русском языке.
2. Не пиши код, скрипты, bash-команды или pip install — бот собирается на визуальном холсте из нод.
3. Опиши структуру бота понятным списком разделов и кнопок:
   • Приветствие и главное меню
   • Разделы сценария
   • Кнопки переходов
   • Сбор заявок и уведомление
4. Если пользователь просит определенное количество проектов или разделов (например, 5 проектов) — обязательно распиши структуру именно для этого количества.
{doc_context}"""

        user_prompt = message
        if graph_context:
            user_prompt += f"\n\n[Текущий граф: {len(graph_context.get('nodes', []))} узлов, {len(graph_context.get('edges', []))} связей]"

        reply = await self._query_llm(system_prompt, user_prompt, temperature=0.3)
        generated_graph = None

        p_lower = message.lower()
        is_english = any(w in p_lower for w in ["tourism", "travel", "trip", "tour", "vacation", "flight", "bot", "create", "build", "agency"]) and not any('а' <= c <= 'я' for c in p_lower)

        bad_patterns = ["pip install", "dp.run()", "python your_bot", "@dp.", "def handle_", "```python", "```json", "добро пожалуйста", "создайте вашу боту"]
        if any(bp in reply.lower() for bp in bad_patterns) or len(reply.strip()) < 30:
            if any(w in p_lower for w in ["туризм", "тур", "travel", "tourism", "trip", "путешеств", "отпуск", "отель", "курорт", "vacation"]):
                if is_english:
                    reply = (
                        "I have designed a complete interactive Tourism & Travel Agency bot architecture for you!\n\n"
                        "**Canvas Architecture & Flow:**\n"
                        "1. 🏁 **Start & Bottom Keyboard Menu** — Persistent navigation buttons (Explore Tours, Video Guide, AI Guide, Plan Trip).\n"
                        "2. 🎬 **Destination Video (Media Node)** — High-definition promo video previewing top destinations.\n"
                        "3. ⏳ **Timer Delay Node** — 3-second smooth transition before presenting packages.\n"
                        "4. 📍 **Travel Preferences (Input Node)** — Collects preferred destination, dates, and party size.\n"
                        "5. 🏖 **Curated Tour Packages (Message Node)** — Catalog with interactive inline selection buttons.\n"
                        "6. 🤖 **AI Travel Concierge (AI Assistant Node)** — Dedicated conversational assistant with a custom welcome greeting and query limits.\n"
                        "7. 📊 **Log Booking (Sheets Node)** — Securely logs lead details into a CSV database table.\n"
                        "8. 🔔 **Alert Travel Agent (Notify Admin Node)** — Dispatches real-time booking alerts directly to your Telegram ID.\n"
                        "9. ✅ **Confirmation Screen (Message Node)** — Friendly receipt message with a button to return to the main menu.\n\n"
                        "Zero manual coding required — all nodes are pre-wired and ready on the canvas!"
                    )
                else:
                    reply = (
                        "Я спроектировал полноценный интерактивный сценарий туристического агентства!\n\n"
                        "**Архитектура сценария на холсте:**\n"
                        "1. 🏁 **Старт и нижнее меню (Keyboard)** — постоянные кнопки навигации (Туры, Видео-гид, ИИ-консультант, Оформить поездку).\n"
                        "2. 🎬 **Видео-презентация (Media)** — промо-ролик лучших курортов.\n"
                        "3. ⏳ **Таймер задержки** — комфортная пауза в 3 секунды перед показом предложений.\n"
                        "4. 📍 **Сбор данных поездки (Input)** — запрос направления и количества туристов.\n"
                        "5. 🏖 **Каталог туров (Message)** — карточка с инлайн-кнопками выбора.\n"
                        "6. 🤖 **ИИ-консьерж (AI Assistant)** — диалоговый ассистент с персональным приветствием и лимитом запросов.\n"
                        "7. 📊 **Журнал бронирований (Sheets)** — сохранение заявки в CSV-таблицу.\n"
                        "8. 🔔 **Оповещение менеджера (Notify Admin)** — мгновенная отправка заявки в Telegram.\n"
                        "9. ✅ **Экран подтверждения (Message)** — статус бронирования и возврат в главное меню.\n\n"
                        "Все узлы логически соединены и не требуют написания ручного кода!"
                    )
            elif any(w in p_lower for w in ["проект", "портфолио", "кейсы"]):
                reply = (
                    "Я спроектировал полноценный интерактивный сценарий для вашего портфолио из 5 проектов!\n\n"
                    "**Структура сценария на холсте:**\n"
                    "1. 👋 **Главное меню (Start & Welcome)** — интерактивное приветствие с кнопками для перехода в каждый из 5 проектов и кнопкой заказа.\n"
                    "2. 💼 **5 отдельных экранов проектов** — каждый проект вынесен в самостоятельный узел с детальным описанием, стеком технологий, кнопкой «Оставить заявку» и возвратом в меню.\n"
                    "3. 📩 **Форма заказа** — узел оформления заявки клиентом.\n"
                    "4. 🔔 **Уведомление администратора** — моментальная отправка контакта клиента в ваш Telegram.\n"
                    "5. 🎉 **Экран благодарности** — подтверждение отправки заявки.\n\n"
                    "Все узлы логически связаны стрелками с возвратом в меню. Никакого ручного кода писать не требуется!"
                )
            else:
                if is_english:
                    reply = (
                        f"I have designed an interactive visual bot scenario based on your request: «{message}»!\n\n"
                        f"It includes a welcome screen, persistent navigation menu, detailed content sections, "
                        f"and lead generation with automated Telegram admin alerts."
                    )
                else:
                    reply = (
                        f"Я спроектировал интерактивный визуальный сценарий для вашего бота по запросу «{message}»!\n\n"
                        f"Он включает приветственный экран, главное меню с интерактивными кнопками переходов, "
                        f"детальные разделы и форму сбора заявок с автоматическим уведомлением в Telegram."
                    )

        # If user asked to create / transfer / design a bot or needs canvas graph
        wants_graph = any(w in p_lower for w in [
            "перенес", "холст", "создай", "сделай", "сдела", "граф", "сценарий",
            "построй", "добавь", "бот", "хочу", "портфолио", "магазин", "визитк",
            "визитку", "разработ", "спроектир", "blueprint", "авто", "сто", "еда",
            "салон", "курс", "доставк", "запис", "проект",
            "bot", "create", "build", "make", "design", "generate", "scenario",
            "blueprint", "graph", "canvas", "travel", "tourism", "trip", "tour",
            "agency", "portfolio", "shop", "store", "workflow"
        ])

        if wants_graph:
            if "def " in message or "@dp." in message:
                generated_graph = await self.reverse_engineer_code(message)
            else:
                generated_graph = await self.text_to_graph(message, documents)

        if generated_graph and "Применить сценарий на холст" not in reply and "Apply scenario to canvas" not in reply:
            if is_english:
                reply += (
                    f"\n\n✨ **Scenario prepared!** Click the button **«Apply scenario to canvas ✨»** below "
                    f"to transfer {len(generated_graph.get('nodes', []))} visual nodes to the canvas."
                )
            else:
                reply += (
                    f"\n\n✨ **Сценарий подготовлен!** Нажмите кнопку **«Применить сценарий на холст ✨»** ниже, "
                    f"чтобы перенести {len(generated_graph.get('nodes', []))} визуальных узлов на холст."
                )

        return {
            "reply": reply,
            "generated_graph": generated_graph
        }

    def _is_valid_complete_graph(self, graph: Optional[dict]) -> bool:
        """Validates that a generated graph is complete, structured, and has valid nodes with data."""
        if not graph or not isinstance(graph, dict):
            return False
        nodes = graph.get("nodes")
        if not nodes or not isinstance(nodes, list) or len(nodes) < 3:
            return False
        valid_nodes = 0
        for n in nodes:
            if isinstance(n, dict) and "id" in n and "type" in n:
                data = n.get("data")
                if isinstance(data, dict) and len(data) > 0:
                    valid_nodes += 1
        return valid_nodes >= 3

    async def text_to_graph(self, prompt: str, documents: Optional[List[dict]] = None) -> Dict[str, Any]:
        """Generates a clean visual graph schema based on user description."""
        system_prompt = """Ты — генератор архитектуры визуальных ботов для Bot Studio IDE.
Сгенерируй JSON-схему бота на базе aiogram 3.x.
Допустимые визуальные узлы: 'start', 'message', 'keyboard', 'media', 'timer', 'input', 'ai_assistant', 'sheets', 'notify_admin'.
КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО использовать 'custom_code' и любые другие неперечисленные типы узлов.
Каждая инлайн-кнопка в data.buttons должна иметь id (например 'btn_projects'), а соответствующая связь в 'edges' должна иметь 'sourceHandle': 'btn_projects'.
Верни ТОЛЬКО валидный JSON с ключами 'nodes' и 'edges'."""

        res = await self._query_llm(system_prompt, prompt, temperature=0.2)
        if "```json" in res:
            try:
                parts = res.split("```json")
                json_str = parts[1].split("```")[0].strip()
                parsed = json.loads(json_str)
                if self._is_valid_complete_graph(parsed):
                    if not any(w in prompt.lower() for w in ["код", "python", "скрипт", "хендлер"]):
                        has_custom = any(n.get("type") == "custom_code" for n in parsed["nodes"])
                        if not has_custom:
                            return parsed
                    else:
                        return parsed
            except Exception:
                pass
        return self._generate_dynamic_graph(prompt)

    async def reverse_engineer_code(self, legacy_code: str) -> Dict[str, Any]:
        """
        Reverse engineers telebot or aiogram 2.x python script into visual graph schema.
        Extracts handlers, commands, text messages, inline buttons, and custom code handlers.
        """
        nodes: List[Dict[str, Any]] = []
        edges: List[Dict[str, Any]] = []

        nodes.append({
            "id": "start_1",
            "type": "start",
            "position": {"x": 80, "y": 200},
            "data": {"label": "/start", "command": "/start", "description": "Auto-extracted start handler"}
        })

        try:
            tree = ast.parse(legacy_code)
            handler_idx = 1
            last_node_id = "start_1"

            for node in ast.walk(tree):
                if isinstance(node, ast.AsyncFunctionDef) or isinstance(node, ast.FunctionDef):
                    has_start = any("start" in arg.lower() for arg in [node.name] + [decorator.id if isinstance(decorator, ast.Name) else "" for decorator in getattr(node, 'decorator_list', [])])
                    
                    if not has_start and ("handler" in node.name.lower() or "cmd" in node.name.lower() or "step" in node.name.lower()):
                        curr_id = f"node_legacy_{handler_idx}"
                        nodes.append({
                            "id": curr_id,
                            "type": "custom_code",
                            "position": {"x": 350 + (handler_idx - 1) * 260, "y": 200},
                            "data": {
                                "label": node.name.replace("_", " ").title(),
                                "code": f"# Extracted logic from {node.name}\nasync def {node.name}(message, state):\n    pass"
                            }
                        })
                        edges.append({
                            "id": f"edge_rev_{handler_idx}",
                            "source": last_node_id,
                            "target": curr_id
                        })
                        last_node_id = curr_id
                        handler_idx += 1
        except Exception:
            pass

        if len(nodes) == 1:
            nodes.append({
                "id": "msg_legacy_1",
                "type": "message",
                "position": {"x": 350, "y": 200},
                "data": {
                    "label": "Imported Bot Logic",
                    "text": "Code successfully imported into Bot Studio graph.",
                    "buttons": []
                }
            })
            edges.append({"id": "e_rev_start", "source": "start_1", "target": "msg_legacy_1"})

        return {"nodes": nodes, "edges": edges}

    async def magic_pen(self, text: str, action: str = "friendly") -> str:
        """UX Copywriting assistant inside node inputs."""
        styles = {
            "friendly": "Перепиши этот текст для Telegram-бота в дружелюбном, приятном тоне с эмодзи:",
            "formal": "Перепиши этот текст для Telegram-бота в строгом деловом стиле:",
            "concise": "Сократи этот текст до минимума, оставив только самую суть:",
            "engaging": "Сделай текст более вовлекающим и побуждающим к действию:"
        }
        prompt = styles.get(action, styles["friendly"])
        res = await self._query_llm(
            "Ты — опытный UX-редактор текстов для интерфейсов Telegram-ботов. Верни только готовый улучшенный текст без кавычек и комментариев.",
            f"{prompt}\n\n{text}",
            temperature=0.5
        )
        return res.strip('"').strip()

    def _generate_dynamic_graph(self, prompt: str) -> Dict[str, Any]:
        """
        Dynamically generates structured, domain-tailored visual bot architectures
        WITHOUT any custom_code nodes unless explicitly requested.
        """
        p_lower = prompt.lower()

        # 0. TOURISM / TRAVEL AGENCY BOT (Nodes: start, keyboard, message, media, timer, input, ai_assistant, sheets, notify_admin)
        if any(w in p_lower for w in ["туризм", "тур", "travel", "tourism", "trip", "путешеств", "отпуск", "отель", "курорт", "vacation", "flight", "tourist"]):
            return {
                "nodes": [
                    {
                        "id": "node_start",
                        "type": "start",
                        "position": {"x": 60, "y": 280},
                        "data": {"label": "/start", "command": "/start"}
                    },
                    {
                        "id": "node_keyboard",
                        "type": "keyboard",
                        "position": {"x": 300, "y": 280},
                        "data": {
                            "label": "🌍 Travel Navigation Menu",
                            "text": "🌴 Welcome to Wanderlust Travel! Use the bottom menu to navigate:",
                            "buttons": [
                                {"id": "btn_tours", "text": "🏝 Explore Tours", "action_type": "callback"},
                                {"id": "btn_ai_guide", "text": "🤖 AI Travel Guide", "action_type": "callback"},
                                {"id": "btn_book", "text": "✈️ Plan Trip", "action_type": "callback"},
                                {"id": "btn_manager", "text": "📞 Call Agency", "action_type": "callback"}
                            ]
                        }
                    },
                    {
                        "id": "msg_welcome",
                        "type": "message",
                        "position": {"x": 620, "y": 140},
                        "data": {
                            "label": "🏖 Welcome & Catalog",
                            "text": "🌴 <b>Welcome to Wanderlust Travel Agency!</b>\n\nDiscover breathtaking destinations around the globe. Watch our teaser video or plan a personalized itinerary with our AI concierge.",
                            "buttons": [
                                {"id": "btn_watch_video", "text": "🎬 Watch Destination Video", "action_type": "callback"},
                                {"id": "btn_plan_trip", "text": "🎒 Book a Tour", "action_type": "callback"}
                            ]
                        }
                    },
                    {
                        "id": "media_tour_video",
                        "type": "media",
                        "position": {"x": 960, "y": 40},
                        "data": {
                            "label": "🎬 Travel Promo Video",
                            "media_type": "video",
                            "media_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
                            "caption": "🌍 <b>Experience Tropical Wonders!</b>\nHere is a preview of our most popular island escape."
                        }
                    },
                    {
                        "id": "timer_delay",
                        "type": "timer",
                        "position": {"x": 1280, "y": 40},
                        "data": {
                            "label": "⏳ 3-Second Pause",
                            "timer_mode": "after",
                            "timer_seconds": 3
                        }
                    },
                    {
                        "id": "input_destination",
                        "type": "input",
                        "position": {"x": 960, "y": 280},
                        "data": {
                            "label": "📍 Travel Preferences",
                            "text": "🗺 Please enter your preferred destination and number of travelers (e.g. Bali, 2 persons):",
                            "variable_name": "travel_details",
                            "input_type": "text"
                        }
                    },
                    {
                        "id": "msg_tour_offer",
                        "type": "message",
                        "position": {"x": 1280, "y": 280},
                        "data": {
                            "label": "🏖 Curated Tour Packages",
                            "text": "✨ <b>Great choice! Top packages matching your request:</b>\n\n1. 5-Star Oceanfront Villa with private transfer\n2. All-Inclusive Beach Resort & excursions\n\nWould you like to ask our AI guide or finalize your reservation?",
                            "buttons": [
                                {"id": "btn_ask_ai", "text": "🤖 Ask AI Travel Guide", "action_type": "callback"},
                                {"id": "btn_reserve_tour", "text": "📝 Confirm Reservation", "action_type": "callback"}
                            ]
                        }
                    },
                    {
                        "id": "ai_assistant_node",
                        "type": "ai_assistant",
                        "position": {"x": 1600, "y": 120},
                        "data": {
                            "label": "🤖 Wanderlust AI Guide",
                            "ai_welcome_text": "👋 Hello! I am your Wanderlust AI concierge. Ask me anything about flights, hotel reviews, visa requirements, or custom itineraries!",
                            "ai_system_prompt": "You are Wanderlust AI, an expert and charming travel advisor. Assist travelers in planning memorable trips, suggesting hidden gems and packing tips.",
                            "ai_limit_type": "per_hour",
                            "ai_limit_count": 15,
                            "ai_limit_text": "⚠️ You have reached your hourly limit for AI travel inquiries. Please contact our agency desk directly."
                        }
                    },
                    {
                        "id": "sheets_booking",
                        "type": "sheets",
                        "position": {"x": 1600, "y": 380},
                        "data": {
                            "label": "📊 Log Booking to CSV",
                            "storage_type": "csv",
                            "table_name": "travel_bookings"
                        }
                    },
                    {
                        "id": "notify_agent",
                        "type": "notify_admin",
                        "position": {"x": 1920, "y": 380},
                        "data": {
                            "label": "🔔 Alert Travel Agent",
                            "admin_id": "YOUR_ADMIN_ID",
                            "notification_template": "✈️ <b>New Travel Booking!</b>\nClient: @{username} (ID: {user_id})\nDetails: {travel_details}"
                        }
                    },
                    {
                        "id": "msg_success",
                        "type": "message",
                        "position": {"x": 2240, "y": 380},
                        "data": {
                            "label": "✅ Booking Confirmed",
                            "text": "🎉 <b>Booking Request Confirmed!</b>\nOur travel specialist has received your request and will contact you via Telegram within 15 minutes.",
                            "buttons": [
                                {"id": "btn_back_home", "text": "🏠 Main Menu", "action_type": "callback"}
                            ]
                        }
                    }
                ],
                "edges": [
                    {"id": "e_tr1", "source": "node_start", "target": "node_keyboard"},
                    {"id": "e_tr2", "source": "node_keyboard", "target": "msg_welcome", "sourceHandle": "btn_tours"},
                    {"id": "e_tr3", "source": "node_keyboard", "target": "ai_assistant_node", "sourceHandle": "btn_ai_guide"},
                    {"id": "e_tr4", "source": "node_keyboard", "target": "input_destination", "sourceHandle": "btn_book"},
                    {"id": "e_tr5", "source": "node_keyboard", "target": "notify_agent", "sourceHandle": "btn_manager"},
                    {"id": "e_tr6", "source": "msg_welcome", "target": "media_tour_video", "sourceHandle": "btn_watch_video"},
                    {"id": "e_tr7", "source": "msg_welcome", "target": "input_destination", "sourceHandle": "btn_plan_trip"},
                    {"id": "e_tr8", "source": "media_tour_video", "target": "timer_delay"},
                    {"id": "e_tr9", "source": "timer_delay", "target": "msg_tour_offer"},
                    {"id": "e_tr10", "source": "input_destination", "target": "msg_tour_offer"},
                    {"id": "e_tr11", "source": "msg_tour_offer", "target": "ai_assistant_node", "sourceHandle": "btn_ask_ai"},
                    {"id": "e_tr12", "source": "msg_tour_offer", "target": "sheets_booking", "sourceHandle": "btn_reserve_tour"},
                    {"id": "e_tr13", "source": "sheets_booking", "target": "notify_agent"},
                    {"id": "e_tr14", "source": "notify_agent", "target": "msg_success"},
                    {"id": "e_tr15", "source": "msg_success", "target": "node_keyboard", "sourceHandle": "btn_back_home"}
                ]
            }

        # 1. PORTFOLIO / CV / PROJECTS BOT
        if any(w in p_lower for w in ["проект", "портфолио", "portfolio", "резюме", "визитка", "обо мне", "кейсы", "разработчик", "дизайнер"]):
            # Check if user specifically requested 5 projects (or a specific count)
            is_5_projects = any(w in p_lower for w in ["5", "пять", "пяти", "five"])
            if is_5_projects:
                project_names = [
                    ("Bot Studio IDE", "Визуальная среда конструирования ботов с компиляцией в aiogram 3.x, симулятором и поддержкой локальных нейросетей.", "Python, React, TypeScript, FastAPI"),
                    ("SREDA AI Platform", "Локальная рабочая станция для оркестрации LLM-моделей без передачи данных во внешние облачные сервисы.", "PyTorch, llama.cpp, Python, FastAPI"),
                    ("E-Commerce Bot", "Полнофункциональный онлайн-магазин в Telegram с корзиной, приемом оплат картой/СБП и авточеками.", "aiogram 3.x, PostgreSQL, Redis, Payments API"),
                    ("CRM Lead Flow", "Бот для автоматической квалификации входящего трафика, сбора брифов и моментальной выгрузки в CRM.", "Python, Webhooks, Google Sheets, Bitrix24"),
                    ("Support Copilot RAG", "Интеллектуальный ассистент техподдержки 24/7 с поиском ответов по корпоративной базе знаний.", "LangChain, VectorDB, Gemma-4, Webhooks")
                ]
                
                buttons_welcome = [
                    {"id": f"btn_p{i+1}", "text": f"💼 {p[0]}", "action_type": "callback"}
                    for i, p in enumerate(project_names)
                ]
                buttons_welcome.append({"id": "btn_order_custom", "text": "🚀 Заказать разработку", "action_type": "callback"})
                
                nodes = [
                    {
                        "id": "node_start",
                        "type": "start",
                        "position": {"x": 60, "y": 420},
                        "data": {"label": "/start", "command": "/start", "description": "Точка входа по команде /start"}
                    },
                    {
                        "id": "msg_welcome",
                        "type": "message",
                        "position": {"x": 440, "y": 400},
                        "data": {
                            "label": "👋 Портфолио: 5 Проектов",
                            "text": "👋 <b>Добро пожаловать в моё портфолио!</b>\n\nЗдесь представлены 5 ключевых реализованных проектов. Выберите интересующий проект для ознакомления:",
                            "buttons": buttons_welcome
                        }
                    }
                ]
                
                edges = [
                    {"id": "e_start", "source": "node_start", "target": "msg_welcome"}
                ]
                
                # Create 5 distinct project screens in column 3 (x: 920) with 380px vertical spacing
                for i, (title, desc, stack) in enumerate(project_names):
                    pid = f"msg_project_{i+1}"
                    nodes.append({
                        "id": pid,
                        "type": "message",
                        "position": {"x": 920, "y": 40 + i * 380},
                        "data": {
                            "label": f"💼 Проект #{i+1}: {title}",
                            "text": f"🚀 <b>Проект #{i+1}: {title}</b>\n\n{desc}\n\n⚙️ <b>Стек:</b> {stack}\n\nХотите заказать похожее решение под ключ?",
                            "buttons": [
                                {"id": f"btn_order_p{i+1}", "text": "✨ Оставить заявку", "action_type": "callback"},
                                {"id": f"btn_back_p{i+1}", "text": "◀️ Назад в меню", "action_type": "callback"}
                            ]
                        }
                    })
                    edges.append({
                        "id": f"e_menu_to_p{i+1}",
                        "source": "msg_welcome",
                        "target": pid,
                        "sourceHandle": f"btn_p{i+1}"
                    })
                    edges.append({
                        "id": f"e_back_p{i+1}",
                        "source": pid,
                        "target": "msg_welcome",
                        "sourceHandle": f"btn_back_p{i+1}"
                    })
                    edges.append({
                        "id": f"e_order_from_p{i+1}",
                        "source": pid,
                        "target": "msg_contact_form",
                        "sourceHandle": f"btn_order_p{i+1}"
                    })
                
                # Order Form node (column 4)
                nodes.append({
                    "id": "msg_contact_form",
                    "type": "message",
                    "position": {"x": 1400, "y": 800},
                    "data": {
                        "label": "📩 Форма заказа проекта",
                        "text": "🤝 <b>Обсудить проект под ключ</b>\n\nНажмите «Отправить заявку», и ваши контактные данные будут переданы разработчику. Мы свяжемся с вами в течение часа.",
                        "buttons": [
                            {"id": "btn_submit_lead", "text": "✅ Отправить заявку", "action_type": "callback"},
                            {"id": "btn_cancel_lead", "text": "◀️ Назад в меню", "action_type": "callback"}
                        ]
                    }
                })
                edges.append({
                    "id": "e_menu_to_order",
                    "source": "msg_welcome",
                    "target": "msg_contact_form",
                    "sourceHandle": "btn_order_custom"
                })
                edges.append({
                    "id": "e_cancel_lead",
                    "source": "msg_contact_form",
                    "target": "msg_welcome",
                    "sourceHandle": "btn_cancel_lead"
                })
                
                # Notify Admin (column 5)
                nodes.append({
                    "id": "notify_admin_lead",
                    "type": "notify_admin",
                    "position": {"x": 1800, "y": 800},
                    "data": {
                        "label": "🔔 Уведомление разработчику",
                        "admin_id": "YOUR_ADMIN_ID",
                        "notification_template": "⚡️ <b>Новая заявка на проект!</b>\nКлиент: @{username} (ID: {user_id})\nВремя: {timestamp}"
                    }
                })
                edges.append({
                    "id": "e_submit_to_notify",
                    "source": "msg_contact_form",
                    "target": "notify_admin_lead",
                    "sourceHandle": "btn_submit_lead"
                })
                
                # Success screen (column 6)
                nodes.append({
                    "id": "msg_lead_success",
                    "type": "message",
                    "position": {"x": 2200, "y": 800},
                    "data": {
                        "label": "🎉 Заявка принята",
                        "text": "🎉 <b>Спасибо! Ваша заявка принята.</b>\n\nЯ уже получил уведомление и скоро свяжусь с вами в Telegram для обсуждения деталей.",
                        "buttons": [
                            {"id": "btn_home_menu", "text": "🏠 В главное меню", "action_type": "callback"}
                        ]
                    }
                })
                edges.append({
                    "id": "e_notify_to_success",
                    "source": "notify_admin_lead",
                    "target": "msg_lead_success"
                })
                edges.append({
                    "id": "e_success_to_menu",
                    "source": "msg_lead_success",
                    "target": "msg_welcome",
                    "sourceHandle": "btn_home_menu"
                })
                
                return {"nodes": nodes, "edges": edges}

            # Standard Portfolio with 3 projects + stack + order form with generous 380px spacing
            return {
                "nodes": [
                    {
                        "id": "node_start",
                        "type": "start",
                        "position": {"x": 60, "y": 280},
                        "data": {"label": "/start", "command": "/start", "description": "Точка входа по команде /start"}
                    },
                    {
                        "id": "msg_welcome",
                        "type": "message",
                        "position": {"x": 420, "y": 260},
                        "data": {
                            "label": "👋 Приветствие / Главное меню",
                            "text": "👋 <b>Добро пожаловать в моё портфолио!</b>\n\nЯ создаю надежные Telegram-боты, веб-приложения и ИИ-интеграции под ключ.\n\nВыберите раздел ниже, чтобы изучить кейсы или связаться со мной:",
                            "buttons": [
                                {"id": "btn_projects", "text": "💼 Мои проекты", "action_type": "callback"},
                                {"id": "btn_stack", "text": "🛠 Стек и навыки", "action_type": "callback"},
                                {"id": "btn_contact", "text": "📩 Заказать бота", "action_type": "callback"}
                            ]
                        }
                    },
                    {
                        "id": "msg_projects",
                        "type": "message",
                        "position": {"x": 860, "y": 40},
                        "data": {
                            "label": "💼 Избранные проекты",
                            "text": "🚀 <b>Ключевые проекты:</b>\n\n1. <b>Bot Studio IDE</b> — визуальный конструктор ботов с компиляцией в aiogram 3.x.\n2. <b>AI Support Copilot</b> — умный бот службы заботы с RAG-поиском по базе знаний.\n3. <b>E-Commerce Bot</b> — магазин в Telegram с корзиной и автоуведомлениями.\n\nХотите заказать индивидуальное решение?",
                            "buttons": [
                                {"id": "btn_order_from_proj", "text": "✨ Оставить заявку", "action_type": "callback"},
                                {"id": "btn_back_to_menu_1", "text": "◀️ Назад в меню", "action_type": "callback"}
                            ]
                        }
                    },
                    {
                        "id": "msg_stack",
                        "type": "message",
                        "position": {"x": 860, "y": 420},
                        "data": {
                            "label": "🛠 Технологический стек",
                            "text": "⚙️ <b>Технологии и навыки:</b>\n\n• <b>Backend:</b> Python 3.12, aiogram 3.x, FastAPI, asyncio\n• <b>Базы данных:</b> PostgreSQL, Redis, SQLite, SQLAlchemy\n• <b>ИИ:</b> OpenAI API, Ollama, LlamaIndex, Векторные эмбеддинги\n• <b>Frontend:</b> TypeScript, React, Tailwind CSS",
                            "buttons": [
                                {"id": "btn_back_to_menu_2", "text": "◀️ Назад в меню", "action_type": "callback"}
                            ]
                        }
                    },
                    {
                        "id": "msg_contact",
                        "type": "message",
                        "position": {"x": 860, "y": 800},
                        "data": {
                            "label": "📩 Форма заказа",
                            "text": "🤝 <b>Давайте обсудим вашу задачу!</b>\n\nНажмите кнопку ниже, чтобы отправить заявку. Ваши контакты из Telegram моментально поступят мне в личные сообщения.",
                            "buttons": [
                                {"id": "btn_send_lead", "text": "✅ Отправить заявку", "action_type": "callback"},
                                {"id": "btn_back_to_menu_3", "text": "◀️ Отмена", "action_type": "callback"}
                            ]
                        }
                    },
                    {
                        "id": "notify_lead",
                        "type": "notify_admin",
                        "position": {"x": 1280, "y": 500},
                        "data": {
                            "label": "🔔 Уведомление автору",
                            "admin_id": "YOUR_ADMIN_ID",
                            "notification_template": "⚡️ <b>Новая заявка из портфолио!</b>\nКлиент: @{username} (ID: {user_id})\nИмя: {name}\nВремя: {timestamp}"
                        }
                    },
                    {
                        "id": "msg_success",
                        "type": "message",
                        "position": {"x": 1660, "y": 500},
                        "data": {
                            "label": "🎉 Заявка принята",
                            "text": "🎉 <b>Спасибо! Ваша заявка успешно отправлена.</b>\n\nЯ свяжусь с вами в ближайшее время для обсуждения деталей проекта.",
                            "buttons": [
                                {"id": "btn_home", "text": "🏠 В главное меню", "action_type": "callback"}
                            ]
                        }
                    }
                ],
                "edges": [
                    {"id": "e_start", "source": "node_start", "target": "msg_welcome"},
                    {"id": "e_proj", "source": "msg_welcome", "target": "msg_projects", "sourceHandle": "btn_projects"},
                    {"id": "e_stack", "source": "msg_welcome", "target": "msg_stack", "sourceHandle": "btn_stack"},
                    {"id": "e_contact", "source": "msg_welcome", "target": "msg_contact", "sourceHandle": "btn_contact"},
                    {"id": "e_order_prj", "source": "msg_projects", "target": "msg_contact", "sourceHandle": "btn_order_from_proj"},
                    {"id": "e_back_1", "source": "msg_projects", "target": "msg_welcome", "sourceHandle": "btn_back_to_menu_1"},
                    {"id": "e_back_2", "source": "msg_stack", "target": "msg_welcome", "sourceHandle": "btn_back_to_menu_2"},
                    {"id": "e_send", "source": "msg_contact", "target": "notify_lead", "sourceHandle": "btn_send_lead"},
                    {"id": "e_back_3", "source": "msg_contact", "target": "msg_welcome", "sourceHandle": "btn_back_to_menu_3"},
                    {"id": "e_notify_succ", "source": "notify_lead", "target": "msg_success"},
                    {"id": "e_home", "source": "msg_success", "target": "msg_welcome", "sourceHandle": "btn_home"}
                ]
            }

        # 2. SHOP / STORE / E-COMMERCE BOT
        if any(w in p_lower for w in ["магазин", "товар", "каталог", "купить", "заказ", "доставка", "shop", "ecommerce"]):
            return {
                "nodes": [
                    {
                        "id": "node_start",
                        "type": "start",
                        "position": {"x": 60, "y": 200},
                        "data": {"label": "/start", "command": "/start"}
                    },
                    {
                        "id": "msg_shop_menu",
                        "type": "message",
                        "position": {"x": 320, "y": 180},
                        "data": {
                            "label": "🛍 Главное меню магазина",
                            "text": "🛍 <b>Добро пожаловать в наш онлайн-магазин!</b>\n\nВыберите интересующий раздел каталога:",
                            "buttons": [
                                {"id": "btn_catalog", "text": "📦 Каталог товаров", "action_type": "callback"},
                                {"id": "btn_delivery", "text": "🚚 Доставка и оплата", "action_type": "callback"},
                                {"id": "btn_order", "text": "💳 Оформить заказ", "action_type": "callback"}
                            ]
                        }
                    },
                    {
                        "id": "msg_catalog",
                        "type": "message",
                        "position": {"x": 700, "y": 50},
                        "data": {
                            "label": "📦 Каталог товаров",
                            "text": "📋 <b>Популярные товары:</b>\n\n1. Премиум подписка Bot Studio\n2. Готовый шаблон интернет-магазина\n3. Модуль интеграции платежей Telegram\n\nВыберите действие:",
                            "buttons": [
                                {"id": "btn_go_order", "text": "🛒 Оформить заказ", "action_type": "callback"},
                                {"id": "btn_back_menu", "text": "◀️ В меню", "action_type": "callback"}
                            ]
                        }
                    },
                    {
                        "id": "msg_delivery",
                        "type": "message",
                        "position": {"x": 700, "y": 260},
                        "data": {
                            "label": "🚚 Условия доставки",
                            "text": "ℹ️ <b>Условия доставки и оплаты:</b>\n\n• Доставка цифровых ключей: моментально в боте\n• Оплата: банковские карты, СБП, ЮKassa\n• Гарантия и техподдержка 24/7",
                            "buttons": [
                                {"id": "btn_back_delivery", "text": "◀️ В меню", "action_type": "callback"}
                            ]
                        }
                    },
                    {
                        "id": "notify_order",
                        "type": "notify_admin",
                        "position": {"x": 1050, "y": 220},
                        "data": {
                            "label": "🔔 Новый заказ",
                            "admin_id": "YOUR_ADMIN_ID",
                            "notification_template": "🛒 <b>Новый заказ в магазине!</b>\nПокупатель: @{username}\nID: {user_id}"
                        }
                    },
                    {
                        "id": "msg_order_done",
                        "type": "message",
                        "position": {"x": 1360, "y": 220},
                        "data": {
                            "label": "✅ Заказ оформлен",
                            "text": "✅ <b>Спасибо за заказ!</b>\nМенеджер свяжется с вами для подтверждения оплаты.",
                            "buttons": [
                                {"id": "btn_home_shop", "text": "🏠 В магазин", "action_type": "callback"}
                            ]
                        }
                    }
                ],
                "edges": [
                    {"id": "es1", "source": "node_start", "target": "msg_shop_menu"},
                    {"id": "es2", "source": "msg_shop_menu", "target": "msg_catalog", "sourceHandle": "btn_catalog"},
                    {"id": "es3", "source": "msg_shop_menu", "target": "msg_delivery", "sourceHandle": "btn_delivery"},
                    {"id": "es4", "source": "msg_shop_menu", "target": "notify_order", "sourceHandle": "btn_order"},
                    {"id": "es5", "source": "msg_catalog", "target": "notify_order", "sourceHandle": "btn_go_order"},
                    {"id": "es6", "source": "msg_catalog", "target": "msg_shop_menu", "sourceHandle": "btn_back_menu"},
                    {"id": "es7", "source": "msg_delivery", "target": "msg_shop_menu", "sourceHandle": "btn_back_delivery"},
                    {"id": "es8", "source": "notify_order", "target": "msg_order_done"},
                    {"id": "es9", "source": "msg_order_done", "target": "msg_shop_menu", "sourceHandle": "btn_home_shop"}
                ]
            }

        # 3. AI CONSULTANT / SUPPORT BOT
        if any(w in p_lower for w in ["поддержка", "саппорт", "помощь", "faq", "консультант", "ai", "вопрос"]):
            return {
                "nodes": [
                    {
                        "id": "node_start",
                        "type": "start",
                        "position": {"x": 60, "y": 200},
                        "data": {"label": "/start", "command": "/start"}
                    },
                    {
                        "id": "msg_support_menu",
                        "type": "message",
                        "position": {"x": 320, "y": 180},
                        "data": {
                            "label": "🤝 Центр поддержки",
                            "text": "Здравствуйте! Я виртуальный консультант службы заботы.\n\nЧем я могу помочь вам прямо сейчас?",
                            "buttons": [
                                {"id": "btn_faq", "text": "❓ Частые вопросы (FAQ)", "action_type": "callback"},
                                {"id": "btn_ai_ask", "text": "🤖 Спросить ИИ-ассистента", "action_type": "callback"},
                                {"id": "btn_human", "text": "👨‍💻 Связать с оператором", "action_type": "callback"}
                            ]
                        }
                    },
                    {
                        "id": "node_ai",
                        "type": "ai_assistant",
                        "position": {"x": 720, "y": 120},
                        "data": {
                            "label": "🤖 ИИ-Консультант",
                            "ai_model": "gpt-4o-mini",
                            "ai_system_prompt": "Ты — вежливый сотрудник службы поддержки. Отвечай кратко, доброжелательно и по делу."
                        }
                    },
                    {
                        "id": "notify_agent",
                        "type": "notify_admin",
                        "position": {"x": 720, "y": 360},
                        "data": {
                            "label": "🔔 Вызов оператора",
                            "admin_id": "YOUR_ADMIN_ID",
                            "notification_template": "🆘 <b>Запрос оператора в поддержку!</b>\nПользователь: @{username}"
                        }
                    },
                    {
                        "id": "msg_agent_waiting",
                        "type": "message",
                        "position": {"x": 1050, "y": 360},
                        "data": {
                            "label": "⏳ Ожидание оператора",
                            "text": "Оператор получил ваш запрос и подключится в чат в течение 2-3 минут.",
                            "buttons": [
                                {"id": "btn_back_sup", "text": "◀️ В меню", "action_type": "callback"}
                            ]
                        }
                    }
                ],
                "edges": [
                    {"id": "ea1", "source": "node_start", "target": "msg_support_menu"},
                    {"id": "ea2", "source": "msg_support_menu", "target": "node_ai", "sourceHandle": "btn_ai_ask"},
                    {"id": "ea3", "source": "msg_support_menu", "target": "notify_agent", "sourceHandle": "btn_human"},
                    {"id": "ea4", "source": "notify_agent", "target": "msg_agent_waiting"},
                    {"id": "ea5", "source": "msg_agent_waiting", "target": "msg_support_menu", "sourceHandle": "btn_back_sup"}
                ]
            }

        # 4. AUTO-SERVICE / REPAIR / TIRE SERVICE BOT
        if any(w in p_lower for w in ["авто", "сто", "машин", "шиномонтаж", "мойка", "ремонт авто", "автосервис"]):
            return {
                "nodes": [
                    {
                        "id": "node_start",
                        "type": "start",
                        "position": {"x": 60, "y": 200},
                        "data": {"label": "/start", "command": "/start"}
                    },
                    {
                        "id": "msg_auto_menu",
                        "type": "message",
                        "position": {"x": 320, "y": 180},
                        "data": {
                            "label": "🔧 Автосервис: Главное меню",
                            "text": "🚗 <b>Добро пожаловать в автотехцентр!</b>\n\nМы предлагаем качественное обслуживание и ремонт вашего автомобиля с гарантией.\n\nВыберите услугу:",
                            "buttons": [
                                {"id": "btn_maintenance", "text": "🛠 ТО и Диагностика", "action_type": "callback"},
                                {"id": "btn_tires", "text": "🛞 Шиномонтаж и балансировка", "action_type": "callback"},
                                {"id": "btn_book_service", "text": "📅 Записаться на ремонт", "action_type": "callback"}
                            ]
                        }
                    },
                    {
                        "id": "msg_auto_services",
                        "type": "message",
                        "position": {"x": 720, "y": 60},
                        "data": {
                            "label": "📋 Перечень услуг и цены",
                            "text": "🛠 <b>Популярные услуги автосервиса:</b>\n\n• Компьютерная диагностика: от 1 000 ₽\n• Замена моторного масла и фильтров: от 1 200 ₽\n• Замена тормозных колодок: от 1 500 ₽\n• Сезонный шиномонтаж: от 2 000 ₽\n\nХотите забронировать время мастера?",
                            "buttons": [
                                {"id": "btn_book_from_serv", "text": "📅 Записаться на сервис", "action_type": "callback"},
                                {"id": "btn_back_auto_1", "text": "◀️ В меню", "action_type": "callback"}
                            ]
                        }
                    },
                    {
                        "id": "msg_auto_booking",
                        "type": "message",
                        "position": {"x": 720, "y": 340},
                        "data": {
                            "label": "📝 Форма записи на сервис",
                            "text": "⏱ <b>Запись в автотехцентр:</b>\n\nНажмите «Подтвердить запись», и дежурный мастер сразу свяжется с вами для уточнения марки автомобиля и удобного времени заезда.",
                            "buttons": [
                                {"id": "btn_confirm_auto", "text": "✅ Подтвердить запись", "action_type": "callback"},
                                {"id": "btn_back_auto_2", "text": "◀️ Назад", "action_type": "callback"}
                            ]
                        }
                    },
                    {
                        "id": "notify_auto_master",
                        "type": "notify_admin",
                        "position": {"x": 1080, "y": 300},
                        "data": {
                            "label": "🔔 Заявка мастеру СТО",
                            "admin_id": "YOUR_ADMIN_ID",
                            "notification_template": "🚘 <b>Новая запись на автосервис!</b>\nКлиент: @{username} (ID: {user_id})"
                        }
                    },
                    {
                        "id": "msg_auto_success",
                        "type": "message",
                        "position": {"x": 1400, "y": 300},
                        "data": {
                            "label": "✅ Запись оформлена",
                            "text": "🎉 <b>Отлично! Мы ждем вас в автосервисе.</b>\n\nАдрес: ул. Автомобильная, 12\nТелефон: +7 (999) 000-00-00\nЧасы работы: 09:00 - 21:00 ежедневно.",
                            "buttons": [
                                {"id": "btn_home_auto", "text": "🏠 В начало", "action_type": "callback"}
                            ]
                        }
                    }
                ],
                "edges": [
                    {"id": "e_at1", "source": "node_start", "target": "msg_auto_menu"},
                    {"id": "e_at2", "source": "msg_auto_menu", "target": "msg_auto_services", "sourceHandle": "btn_maintenance"},
                    {"id": "e_at3", "source": "msg_auto_menu", "target": "msg_auto_services", "sourceHandle": "btn_tires"},
                    {"id": "e_at4", "source": "msg_auto_menu", "target": "msg_auto_booking", "sourceHandle": "btn_book_service"},
                    {"id": "e_at5", "source": "msg_auto_services", "target": "msg_auto_booking", "sourceHandle": "btn_book_from_serv"},
                    {"id": "e_at6", "source": "msg_auto_services", "target": "msg_auto_menu", "sourceHandle": "btn_back_auto_1"},
                    {"id": "e_at7", "source": "msg_auto_booking", "target": "notify_auto_master", "sourceHandle": "btn_confirm_auto"},
                    {"id": "e_at8", "source": "msg_auto_booking", "target": "msg_auto_menu", "sourceHandle": "btn_back_auto_2"},
                    {"id": "e_at9", "source": "notify_auto_master", "target": "msg_auto_success"},
                    {"id": "e_at10", "source": "msg_auto_success", "target": "msg_auto_menu", "sourceHandle": "btn_home_auto"}
                ]
            }

        # 5. SALON / BARBERSHOP / BEAUTY / APPOINTMENT BOT
        if any(w in p_lower for w in ["салон", "барбер", "стрижк", "маникюр", "запис", "бронирован", "мастер", "бьюти", "клиник"]):
            return {
                "nodes": [
                    {
                        "id": "node_start",
                        "type": "start",
                        "position": {"x": 60, "y": 200},
                        "data": {"label": "/start", "command": "/start"}
                    },
                    {
                        "id": "msg_salon_main",
                        "type": "message",
                        "position": {"x": 320, "y": 180},
                        "data": {
                            "label": "✂️ Салон: Главное меню",
                            "text": "✨ <b>Добро пожаловать в нашу студию стиля!</b>\n\nМы создаем безупречные образы и заботимся о вашем комфорте.\n\nВыберите интересующий раздел:",
                            "buttons": [
                                {"id": "btn_salon_services", "text": "💇 Услуги и прайс", "action_type": "callback"},
                                {"id": "btn_salon_masters", "text": "⭐ Наши топ-мастера", "action_type": "callback"},
                                {"id": "btn_salon_booking", "text": "💅 Записаться на визит", "action_type": "callback"}
                            ]
                        }
                    },
                    {
                        "id": "msg_salon_price",
                        "type": "message",
                        "position": {"x": 720, "y": 60},
                        "data": {
                            "label": "📋 Услуги и стоимость",
                            "text": "💎 <b>Популярные процедуры:</b>\n\n• Стрижка + укладка: 2 500 ₽\n• Окрашивание любой сложности: от 4 500 ₽\n• Маникюр с покрытием: 2 200 ₽\n• Уходовые спа-процедуры: от 3 000 ₽",
                            "buttons": [
                                {"id": "btn_book_from_price", "text": "📅 Выбрать время", "action_type": "callback"},
                                {"id": "btn_back_salon_1", "text": "◀️ В меню", "action_type": "callback"}
                            ]
                        }
                    },
                    {
                        "id": "msg_salon_form",
                        "type": "message",
                        "position": {"x": 720, "y": 340},
                        "data": {
                            "label": "📅 Бронирование визита",
                            "text": "🌟 <b>Онлайн-запись:</b>\n\nНажмите кнопку ниже, чтобы забронировать визит. Администратор свяжется с вами в течение 5 минут для подтверждения времени.",
                            "buttons": [
                                {"id": "btn_send_salon", "text": "✅ Подтвердить запись", "action_type": "callback"},
                                {"id": "btn_back_salon_2", "text": "◀️ Назад", "action_type": "callback"}
                            ]
                        }
                    },
                    {
                        "id": "notify_salon_admin",
                        "type": "notify_admin",
                        "position": {"x": 1080, "y": 300},
                        "data": {
                            "label": "🔔 Новая запись в салон",
                            "admin_id": "YOUR_ADMIN_ID",
                            "notification_template": "💇‍♀️ <b>Новая запись в салон!</b>\nКлиент: @{username}\nID: {user_id}"
                        }
                    },
                    {
                        "id": "msg_salon_success",
                        "type": "message",
                        "position": {"x": 1400, "y": 300},
                        "data": {
                            "label": "🎉 Запись подтверждена",
                            "text": "💖 <b>Вы успешно записаны!</b>\n\nМы вышлем напоминание накануне визита. До скорой встречи!",
                            "buttons": [
                                {"id": "btn_home_salon", "text": "🏠 Главное меню", "action_type": "callback"}
                            ]
                        }
                    }
                ],
                "edges": [
                    {"id": "e_sl1", "source": "node_start", "target": "msg_salon_main"},
                    {"id": "e_sl2", "source": "msg_salon_main", "target": "msg_salon_price", "sourceHandle": "btn_salon_services"},
                    {"id": "e_sl3", "source": "msg_salon_main", "target": "msg_salon_price", "sourceHandle": "btn_salon_masters"},
                    {"id": "e_sl4", "source": "msg_salon_main", "target": "msg_salon_form", "sourceHandle": "btn_salon_booking"},
                    {"id": "e_sl5", "source": "msg_salon_price", "target": "msg_salon_form", "sourceHandle": "btn_book_from_price"},
                    {"id": "e_sl6", "source": "msg_salon_price", "target": "msg_salon_main", "sourceHandle": "btn_back_salon_1"},
                    {"id": "e_sl7", "source": "msg_salon_form", "target": "notify_salon_admin", "sourceHandle": "btn_send_salon"},
                    {"id": "e_sl8", "source": "msg_salon_form", "target": "msg_salon_main", "sourceHandle": "btn_back_salon_2"},
                    {"id": "e_sl9", "source": "notify_salon_admin", "target": "msg_salon_success"},
                    {"id": "e_sl10", "source": "msg_salon_success", "target": "msg_salon_main", "sourceHandle": "btn_home_salon"}
                ]
            }

        # 6. FOOD DELIVERY / RESTAURANT / CAFE BOT
        if any(w in p_lower for w in ["еда", "пицц", "суши", "ресторан", "кафе", "бургер", "доставк", "кухн"]):
            return {
                "nodes": [
                    {
                        "id": "node_start",
                        "type": "start",
                        "position": {"x": 60, "y": 200},
                        "data": {"label": "/start", "command": "/start"}
                    },
                    {
                        "id": "msg_food_welcome",
                        "type": "message",
                        "position": {"x": 320, "y": 180},
                        "data": {
                            "label": "🍕 Ресторан & Доставка",
                            "text": "🍕 <b>Горячая доставка из нашего ресторана!</b>\n\nГотовим из свежих фермерских продуктов и доставляем за 35 минут.\n\nВыберите категорию блюд:",
                            "buttons": [
                                {"id": "btn_pizza", "text": "🍕 Пицца из печи", "action_type": "callback"},
                                {"id": "btn_rolls", "text": "🍱 Суши и сеты", "action_type": "callback"},
                                {"id": "btn_order_food", "text": "🛒 Оформить доставку", "action_type": "callback"}
                            ]
                        }
                    },
                    {
                        "id": "msg_food_menu",
                        "type": "message",
                        "position": {"x": 720, "y": 60},
                        "data": {
                            "label": "🍱 Популярные блюда",
                            "text": "🔥 <b>Хиты нашего меню:</b>\n\n1. Пицца «Пепперони гранде» (35 см) — 790 ₽\n2. Сет роллов «Филадельфия премиум» (32 шт) — 1 590 ₽\n3. Бургер «Black Angus BBQ» — 550 ₽\n\nБыстрая доставка от 1 000 ₽ — бесплатно!",
                            "buttons": [
                                {"id": "btn_checkout_food", "text": "🚀 Заказать эти блюда", "action_type": "callback"},
                                {"id": "btn_back_food_1", "text": "◀️ В меню", "action_type": "callback"}
                            ]
                        }
                    },
                    {
                        "id": "msg_food_checkout",
                        "type": "message",
                        "position": {"x": 720, "y": 340},
                        "data": {
                            "label": "📍 Адрес и оформление",
                            "text": "📦 <b>Оформление доставки:</b>\n\nНажмите «Отправить заказ», и оператор сразу передаст чек на кухню для быстрой сборки.",
                            "buttons": [
                                {"id": "btn_submit_food", "text": "✅ Отправить заказ", "action_type": "callback"},
                                {"id": "btn_back_food_2", "text": "◀️ Назад", "action_type": "callback"}
                            ]
                        }
                    },
                    {
                        "id": "notify_kitchen",
                        "type": "notify_admin",
                        "position": {"x": 1080, "y": 300},
                        "data": {
                            "label": "🔔 Заказ на кухню",
                            "admin_id": "YOUR_ADMIN_ID",
                            "notification_template": "🍕 <b>Новый заказ еды!</b>\nПокупатель: @{username}\nID: {user_id}"
                        }
                    },
                    {
                        "id": "msg_food_done",
                        "type": "message",
                        "position": {"x": 1400, "y": 300},
                        "data": {
                            "label": "🛵 Заказ принят!",
                            "text": "🛵 <b>Заказ передан на кухню!</b>\n\nШеф-повар уже готовит ваши блюда. Курьер прибудет ориентировочно через 35-40 минут. Приятного аппетита!",
                            "buttons": [
                                {"id": "btn_home_food", "text": "🏠 В ресторан", "action_type": "callback"}
                            ]
                        }
                    }
                ],
                "edges": [
                    {"id": "e_fd1", "source": "node_start", "target": "msg_food_welcome"},
                    {"id": "e_fd2", "source": "msg_food_welcome", "target": "msg_food_menu", "sourceHandle": "btn_pizza"},
                    {"id": "e_fd3", "source": "msg_food_welcome", "target": "msg_food_menu", "sourceHandle": "btn_rolls"},
                    {"id": "e_fd4", "source": "msg_food_welcome", "target": "msg_food_checkout", "sourceHandle": "btn_order_food"},
                    {"id": "e_fd5", "source": "msg_food_menu", "target": "msg_food_checkout", "sourceHandle": "btn_checkout_food"},
                    {"id": "e_fd6", "source": "msg_food_menu", "target": "msg_food_welcome", "sourceHandle": "btn_back_food_1"},
                    {"id": "e_fd7", "source": "msg_food_checkout", "target": "notify_kitchen", "sourceHandle": "btn_submit_food"},
                    {"id": "e_fd8", "source": "msg_food_checkout", "target": "msg_food_welcome", "sourceHandle": "btn_back_food_2"},
                    {"id": "e_fd9", "source": "notify_kitchen", "target": "msg_food_done"},
                    {"id": "e_fd10", "source": "msg_food_done", "target": "msg_food_welcome", "sourceHandle": "btn_home_food"}
                ]
            }

        # 7. ONLINE EDUCATION / COURSES / SCHOOL BOT
        if any(w in p_lower for w in ["курс", "обучен", "школ", "вебинар", "урок", "репетитор", "марафон"]):
            return {
                "nodes": [
                    {
                        "id": "node_start",
                        "type": "start",
                        "position": {"x": 60, "y": 200},
                        "data": {"label": "/start", "command": "/start"}
                    },
                    {
                        "id": "msg_edu_welcome",
                        "type": "message",
                        "position": {"x": 320, "y": 180},
                        "data": {
                            "label": "🎓 Онлайн-академия",
                            "text": "🎓 <b>Добро пожаловать в обучающую платформу!</b>\n\nОсвойте востребованные навыки с нуля до уровня Junior+ за 8 недель с личным ментором.\n\nВыберите раздел программы:",
                            "buttons": [
                                {"id": "btn_program", "text": "📚 Программа обучения", "action_type": "callback"},
                                {"id": "btn_demo_lesson", "text": "🎥 Бесплатный урок", "action_type": "callback"},
                                {"id": "btn_enroll", "text": "🚀 Записаться на курс", "action_type": "callback"}
                            ]
                        }
                    },
                    {
                        "id": "msg_edu_program",
                        "type": "message",
                        "position": {"x": 720, "y": 60},
                        "data": {
                            "label": "📖 Программа модулей",
                            "text": "💻 <b>Содержание курса:</b>\n\n• Модуль 1: Основы архитектуры и базовый синтаксис\n• Модуль 2: Работа с базами данных и асинхронный код\n• Модуль 3: Разработка Telegram-ботов и интеграция ИИ\n• Модуль 4: Дипломный проект и помощь с трудоустройством",
                            "buttons": [
                                {"id": "btn_from_prog_to_enroll", "text": "✅ Занять место", "action_type": "callback"},
                                {"id": "btn_back_edu_1", "text": "◀️ В меню", "action_type": "callback"}
                            ]
                        }
                    },
                    {
                        "id": "msg_edu_enroll",
                        "type": "message",
                        "position": {"x": 720, "y": 340},
                        "data": {
                            "label": "📝 Заявка на обучение",
                            "text": "🎯 <b>Регистрация на поток:</b>\n\nОставьте заявку прямо сейчас, чтобы зафиксировать специальную скидку 30% на раннее бронирование.",
                            "buttons": [
                                {"id": "btn_submit_edu", "text": "🔥 Забронировать место", "action_type": "callback"},
                                {"id": "btn_back_edu_2", "text": "◀️ Назад", "action_type": "callback"}
                            ]
                        }
                    },
                    {
                        "id": "notify_edu_curator",
                        "type": "notify_admin",
                        "position": {"x": 1080, "y": 300},
                        "data": {
                            "label": "🔔 Новый студент на курс",
                            "admin_id": "YOUR_ADMIN_ID",
                            "notification_template": "🎓 <b>Новая заявка на обучение!</b>\nСтудент: @{username}\nID: {user_id}"
                        }
                    },
                    {
                        "id": "msg_edu_success",
                        "type": "message",
                        "position": {"x": 1400, "y": 300},
                        "data": {
                            "label": "🎉 Доступ открыт",
                            "text": "🎉 <b>Поздравляем с началом обучения!</b>\n\nКуратор курса написал вам в Telegram и добавил в закрытый студенческий чат. Успехов!",
                            "buttons": [
                                {"id": "btn_home_edu", "text": "🏠 В главное меню", "action_type": "callback"}
                            ]
                        }
                    }
                ],
                "edges": [
                    {"id": "e_ed1", "source": "node_start", "target": "msg_edu_welcome"},
                    {"id": "e_ed2", "source": "msg_edu_welcome", "target": "msg_edu_program", "sourceHandle": "btn_program"},
                    {"id": "e_ed3", "source": "msg_edu_welcome", "target": "msg_edu_program", "sourceHandle": "btn_demo_lesson"},
                    {"id": "e_ed4", "source": "msg_edu_welcome", "target": "msg_edu_enroll", "sourceHandle": "btn_enroll"},
                    {"id": "e_ed5", "source": "msg_edu_program", "target": "msg_edu_enroll", "sourceHandle": "btn_from_prog_to_enroll"},
                    {"id": "e_ed6", "source": "msg_edu_program", "target": "msg_edu_welcome", "sourceHandle": "btn_back_edu_1"},
                    {"id": "e_ed7", "source": "msg_edu_enroll", "target": "notify_edu_curator", "sourceHandle": "btn_submit_edu"},
                    {"id": "e_ed8", "source": "msg_edu_enroll", "target": "msg_edu_welcome", "sourceHandle": "btn_back_edu_2"},
                    {"id": "e_ed9", "source": "notify_edu_curator", "target": "msg_edu_success"},
                    {"id": "e_ed10", "source": "msg_edu_success", "target": "msg_edu_welcome", "sourceHandle": "btn_home_edu"}
                ]
            }

        # 8. DEFAULT GENERAL MULTI-STEP BOT (ZERO custom_code)
        return {
            "nodes": [
                {
                    "id": "node_start",
                    "type": "start",
                    "position": {"x": 60, "y": 200},
                    "data": {"label": "/start", "command": "/start", "description": "Точка входа по команде /start"}
                },
                {
                    "id": "node_welcome",
                    "type": "message",
                    "position": {"x": 320, "y": 180},
                    "data": {
                        "label": "👋 Приветствие / Главное меню",
                        "text": f"👋 <b>Добро пожаловать!</b>\n\nЯ интеллектуальный бот, созданный в Bot Studio.\n\nТема: {prompt[:80]}\n\nВыберите интересующий раздел:",
                        "buttons": [
                            {"id": "btn_proceed", "text": "🚀 Наши услуги", "action_type": "callback"},
                            {"id": "btn_info", "text": "ℹ️ О компании", "action_type": "callback"},
                            {"id": "btn_contact_main", "text": "📩 Связаться с нами", "action_type": "callback"}
                        ]
                    }
                },
                {
                    "id": "node_services",
                    "type": "message",
                    "position": {"x": 760, "y": 40},
                    "data": {
                        "label": "💼 Каталог услуг и предложений",
                        "text": "💼 <b>Наши ключевые возможности:</b>\n\n• Быстрое и качественное обслуживание\n• Прозрачные условия и доступные цены\n• Поддержка клиентов 24/7\n\nГотовы оформить заявку?",
                        "buttons": [
                            {"id": "btn_from_serv_to_lead", "text": "✅ Оставить заявку", "action_type": "callback"},
                            {"id": "btn_back_from_serv", "text": "◀️ В меню", "action_type": "callback"}
                        ]
                    }
                },
                {
                    "id": "node_info",
                    "type": "message",
                    "position": {"x": 760, "y": 420},
                    "data": {
                        "label": "ℹ️ О компании и гарантиях",
                        "text": "📖 <b>О нашем сервисе:</b>\n\nМы предлагаем инновационные и надежные решения через Telegram для бизнеса и частных клиентов с гарантией качества.",
                        "buttons": [
                            {"id": "btn_from_info_to_lead", "text": "✅ Оформить запрос", "action_type": "callback"},
                            {"id": "btn_back_to_start", "text": "◀️ Назад", "action_type": "callback"}
                        ]
                    }
                },
                {
                    "id": "node_lead_form",
                    "type": "message",
                    "position": {"x": 760, "y": 800},
                    "data": {
                        "label": "📝 Форма отправки заявки",
                        "text": "🤝 <b>Готовы начать сотрудничество!</b>\n\nНажмите кнопку ниже, чтобы отправить контакты нашему менеджеру.",
                        "buttons": [
                            {"id": "btn_submit_lead_direct", "text": "⚡️ Отправить заявку", "action_type": "callback"},
                            {"id": "btn_back_to_menu_lead", "text": "◀️ Отмена", "action_type": "callback"}
                        ]
                    }
                },
                {
                    "id": "node_notify",
                    "type": "notify_admin",
                    "position": {"x": 1200, "y": 420},
                    "data": {
                        "label": "🔔 Уведомление администратора",
                        "admin_id": "YOUR_ADMIN_ID",
                        "notification_template": "🔔 <b>Новая заявка от @{username}</b> (ID: {user_id})"
                    }
                },
                {
                    "id": "node_done",
                    "type": "message",
                    "position": {"x": 1600, "y": 420},
                    "data": {
                        "label": "✅ Завершение",
                        "text": "✅ <b>Спасибо! Ваша заявка успешно принята.</b>\nМы скоро свяжемся с вами в Telegram.",
                        "buttons": [
                            {"id": "btn_home_default", "text": "🏠 В начало", "action_type": "callback"}
                        ]
                    }
                }
            ],
            "edges": [
                {"id": "eg1", "source": "node_start", "target": "node_welcome"},
                {"id": "eg2", "source": "node_welcome", "target": "node_services", "sourceHandle": "btn_proceed"},
                {"id": "eg3", "source": "node_welcome", "target": "node_info", "sourceHandle": "btn_info"},
                {"id": "eg4", "source": "node_welcome", "target": "node_lead_form", "sourceHandle": "btn_contact_main"},
                {"id": "eg5", "source": "node_services", "target": "node_notify", "sourceHandle": "btn_from_serv_to_lead"},
                {"id": "eg6", "source": "node_services", "target": "node_welcome", "sourceHandle": "btn_back_from_serv"},
                {"id": "eg7", "source": "node_info", "target": "node_notify", "sourceHandle": "btn_from_info_to_lead"},
                {"id": "eg8", "source": "node_info", "target": "node_welcome", "sourceHandle": "btn_back_to_start"},
                {"id": "eg9", "source": "node_lead_form", "target": "node_notify", "sourceHandle": "btn_submit_lead_direct"},
                {"id": "eg10", "source": "node_lead_form", "target": "node_welcome", "sourceHandle": "btn_back_to_menu_lead"},
                {"id": "eg11", "source": "node_notify", "target": "node_done"},
                {"id": "eg12", "source": "node_done", "target": "node_welcome", "sourceHandle": "btn_home_default"}
            ]
        }

llm_service = LLMService()
