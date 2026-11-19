import os
import io
import zipfile
import yaml
from pathlib import Path
from typing import Dict, Any, List
from jinja2 import Environment, DictLoader

from app.models.graph import GraphSchema, NodeModel, EdgeModel
from app.compiler.validator import audit_graph

TEMPLATES = {
    "bot.py": '''"""
Automated generation by Bot Studio IDE (aiogram 3.x)
Project: {{ metadata.name }} v{{ metadata.version }}
Zero Vendor Lock-in: 100% standalone asynchronous Python code.
"""
import asyncio
import logging
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

import yaml
from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.client.default import DefaultBotProperties

from handlers import router, set_bot_texts

# Load environment configuration
load_dotenv()
BOT_TOKEN = os.getenv("BOT_TOKEN", "{{ metadata.bot_token or '' }}")

if not BOT_TOKEN or BOT_TOKEN == "YOUR_BOT_TOKEN_HERE":
    print("❌ ERROR: BOT_TOKEN is missing! Please configure it in .env file.", file=sys.stderr)
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("{{ metadata.name }}")

def load_texts() -> dict:
    texts_path = Path(__file__).parent / "texts.yaml"
    if texts_path.exists():
        with open(texts_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    return {}

async def main():
    logger.info("Starting {{ metadata.name }}...")
    texts = load_texts()
    set_bot_texts(texts)

    bot = Bot(
        token=BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML)
    )
    dp = Dispatcher(storage=MemoryStorage())
    dp.include_router(router)

    try:
        await bot.delete_webhook(drop_pending_updates=True)
        await dp.start_polling(bot)
    finally:
        await bot.session.close()

if __name__ == "__main__":
    asyncio.run(main())
''',

    "states.py": '''"""
FSM States definitions for {{ metadata.name }}
"""
from aiogram.fsm.state import State, StatesGroup

class BotStates(StatesGroup):
{% for node in input_nodes %}
    {{ node.data.variable_name or node.id }} = State()
{% endfor %}
{% for node in ai_nodes %}
    ai_chat_{{ node.id | replace('-', '_') }} = State()
{% endfor %}
''',

    "keyboards.py": '''"""
Inline & Reply keyboards with typed CallbackData factories
Protects against the 64-byte Telegram callback_data limitation.
"""
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton
from aiogram.filters.callback_data import CallbackData

class NavigationCallback(CallbackData, prefix="nav"):
    node_id: str
    action: str

{% for node in message_nodes %}
{% if node.data.buttons %}
def get_kb_{{ node.id | replace('-', '_') }}() -> InlineKeyboardMarkup:
    buttons = [
    {% for btn in node.data.buttons %}
        [InlineKeyboardButton(
            text="{{ btn.text }}",
            {% if btn.action_type == 'url' and btn.url %}
            url="{{ btn.url }}"
            {% else %}
            callback_data=NavigationCallback(node_id="{{ node.id }}", action="{{ btn.id }}").pack()
            {% endif %}
        )],
    {% endfor %}
    ]
    return InlineKeyboardMarkup(inline_keyboard=buttons)
{% endif %}
{% endfor %}

{% for node in keyboard_nodes %}
def get_reply_kb_{{ node.id | replace('-', '_') }}() -> ReplyKeyboardMarkup:
    {% set btns = node.data.buttons %}
    buttons = [
    {% if btns | length == 1 %}
        [KeyboardButton(text="{{ btns[0].text }}")]
    {% elif btns | length == 2 %}
        [KeyboardButton(text="{{ btns[0].text }}"), KeyboardButton(text="{{ btns[1].text }}")]
    {% elif btns | length == 4 %}
        [KeyboardButton(text="{{ btns[0].text }}"), KeyboardButton(text="{{ btns[1].text }}")],
        [KeyboardButton(text="{{ btns[2].text }}"), KeyboardButton(text="{{ btns[3].text }}")]
    {% else %}
        {% for i in range(0, btns | length, 2) %}
        [
            KeyboardButton(text="{{ btns[i].text }}"),
            {% if i + 1 < btns | length %}
            KeyboardButton(text="{{ btns[i + 1].text }}")
            {% endif %}
        ],
        {% endfor %}
    {% endif %}
    ]
    return ReplyKeyboardMarkup(keyboard=buttons, resize_keyboard=True, one_time_keyboard={{ node.data.one_time_keyboard or False }})
{% endfor %}
''',

    "handlers.py": '''"""
Core event handlers, command routers and logic transitions
"""
import os
import csv
import logging
from datetime import datetime
from typing import Dict, Any

from aiogram import Router, F, types, Bot
from aiogram.filters import CommandStart, Command
from aiogram.fsm.context import FSMContext
import httpx

from states import BotStates
from keyboards import NavigationCallback{% for node in message_nodes %}{% if node.data.buttons %}, get_kb_{{ node.id | replace('-', '_') }}{% endif %}{% endfor %}{% for node in keyboard_nodes %}, get_reply_kb_{{ node.id | replace('-', '_') }}{% endfor %}

logger = logging.getLogger("handlers")
router = Router()
BOT_TEXTS: Dict[str, str] = {}

def set_bot_texts(texts: dict):
    global BOT_TEXTS
    BOT_TEXTS = texts

def t(key: str, default: str = "") -> str:
    return BOT_TEXTS.get(key, default)

{% for node in start_nodes %}
@router.message(CommandStart())
async def handle_start_{{ node.id | replace('-', '_') }}(message: types.Message, state: FSMContext):
    await state.clear()
    {% set next_target = edge_map.get(node.id) %}
    {% if next_target %}
    await trigger_node_{{ next_target | replace('-', '_') }}(message, state)
    {% else %}
    await message.answer("Hello! Bot started.")
    {% endif %}
{% endfor %}

{% for node in message_nodes %}
async def trigger_node_{{ node.id | replace('-', '_') }}(message_or_event: types.Message | types.CallbackQuery, state: FSMContext):
    text = t("{{ node.data.text_key or node.id }}", """{{ node.data.text }}""")
    {% if node.data.buttons %}
    kb = get_kb_{{ node.id | replace('-', '_') }}()
    {% else %}
    kb = None
    {% endif %}

    target_msg = message_or_event.message if isinstance(message_or_event, types.CallbackQuery) else message_or_event
    {% if node.data.image_path %}
    try:
        await target_msg.answer_photo(photo="{{ node.data.image_path }}", caption=text, reply_markup=kb)
    except Exception:
        await target_msg.answer(text, reply_markup=kb)
    {% else %}
    await target_msg.answer(text, reply_markup=kb)
    {% endif %}

    {% set next_target = edge_map.get(node.id) %}
    {% if next_target and not node.data.buttons %}
    await trigger_node_{{ next_target | replace('-', '_') }}(message_or_event, state)
    {% endif %}
{% endfor %}

{% for node in keyboard_nodes %}
async def trigger_node_{{ node.id | replace('-', '_') }}(message_or_event: types.Message | types.CallbackQuery, state: FSMContext):
    text = """{{ node.data.text or 'Выберите пункт меню:' }}"""
    kb = get_reply_kb_{{ node.id | replace('-', '_') }}()
    target_msg = message_or_event.message if isinstance(message_or_event, types.CallbackQuery) else message_or_event
    {% if node.data.image_path %}
    try:
        await target_msg.answer_photo(photo="{{ node.data.image_path }}", caption=text, reply_markup=kb)
    except Exception:
        await target_msg.answer(text, reply_markup=kb)
    {% else %}
    await target_msg.answer(text, reply_markup=kb)
    {% endif %}

{% for btn in node.data.buttons %}
{% set next_target = button_edge_map.get((node.id, btn.id)) %}
{% if next_target %}
@router.message(F.text == "{{ btn.text }}")
async def handle_reply_btn_{{ node.id | replace('-', '_') }}_{{ btn.id | replace('-', '_') }}(message: types.Message, state: FSMContext):
    await trigger_node_{{ next_target | replace('-', '_') }}(message, state)
{% endif %}
{% endfor %}
{% endfor %}

{% for node in input_nodes %}
async def trigger_node_{{ node.id | replace('-', '_') }}(message_or_event: types.Message | types.CallbackQuery, state: FSMContext):
    prompt_text = t("prompt_{{ node.id }}", """{{ node.data.text or 'Please enter your ' + (node.data.variable_name or 'data') + ':' }}""")
    target_msg = message_or_event.message if isinstance(message_or_event, types.CallbackQuery) else message_or_event
    await target_msg.answer(prompt_text)
    await state.set_state(BotStates.{{ node.data.variable_name or node.id }})

@router.message(BotStates.{{ node.data.variable_name or node.id }})
async def process_input_{{ node.id | replace('-', '_') }}(message: types.Message, state: FSMContext):
    user_val = message.text or ""
    {% if node.data.input_type == 'number' %}
    if not user_val.strip().isdigit():
        await message.answer("⚠️ {{ node.data.validation_error_text or 'Please enter a valid number.' }}")
        return
    {% endif %}

    await state.update_data({{ node.data.variable_name or node.id }}=user_val)
    {% set next_target = edge_map.get(node.id) %}
    {% if next_target %}
    await trigger_node_{{ next_target | replace('-', '_') }}(message, state)
    {% else %}
    await message.answer("✅ Thank you, your input was recorded!")
    await state.clear()
    {% endif %}
{% endfor %}

{% for node in ai_nodes %}
USER_MSG_LOG_{{ node.id | replace('-', '_') }} = {}

async def trigger_node_{{ node.id | replace('-', '_') }}(message_or_event: types.Message | types.CallbackQuery, state: FSMContext):
    target_msg = message_or_event.message if isinstance(message_or_event, types.CallbackQuery) else message_or_event
    welcome_text = """{{ node.data.ai_welcome_text or "👋 Здравствуйте! Я ИИ-ассистент. Чем я могу вам помочь? Напишите ваш вопрос прямо в чат." }}"""
    await state.set_state(BotStates.ai_chat_{{ node.id | replace('-', '_') }})
    await target_msg.answer(welcome_text)
    # User is now in dialogue with the AI. No auto-transition.

@router.message(BotStates.ai_chat_{{ node.id | replace('-', '_') }})
async def handle_ai_chat_{{ node.id | replace('-', '_') }}(message: types.Message, state: FSMContext):
    user_id = message.from_user.id
    now_ts = datetime.now().timestamp()
    user_input = message.text or ""

    # Rate limiting & Anti-spam checks
    limit_type = "{{ node.data.ai_limit_type or 'none' }}"
    limit_count = {{ node.data.ai_limit_count or 15 }}

    if limit_type != "none":
        history = USER_MSG_LOG_{{ node.id | replace('-', '_') }}.setdefault(user_id, [])
        if limit_type == "per_hour":
            history = [ts for ts in history if now_ts - ts < 3600]
            USER_MSG_LOG_{{ node.id | replace('-', '_') }}[user_id] = history
            if len(history) >= limit_count:
                limit_text = """{{ node.data.ai_limit_text or "⚠️ Превышен лимит сообщений (" ~ (node.data.ai_limit_count or 15) ~ " в час). Пожалуйста, подождите." }}"""
                await message.answer(limit_text)
                return
        elif limit_type == "total":
            if len(history) >= limit_count:
                limit_text = """{{ node.data.ai_limit_text or "⚠️ Достигнут лимит запросов к AI (" ~ (node.data.ai_limit_count or 15) ~ " сообщений). Доступ заблокирован." }}"""
                await message.answer(limit_text)
                return
        USER_MSG_LOG_{{ node.id | replace('-', '_') }}[user_id].append(now_ts)

    await message.bot.send_chat_action(message.chat.id, "typing")
    system_prompt = """{{ node.data.ai_system_prompt or 'You are a helpful and smart AI assistant in Telegram.' }}"""
    base_url = "{{ node.data.ai_base_url or 'https://api.openai.com/v1' }}".rstrip('/')
    api_key = "{{ node.data.ai_api_key or '' }}"
    model = "{{ node.data.ai_model or 'gpt-4o-mini' }}"
    endpoint = base_url if base_url.endswith('/chat/completions') else f"{base_url}/chat/completions"

    ai_reply = "Извините, не удалось связаться с сервером AI."
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(
                endpoint,
                headers=headers,
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_input}
                    ],
                    "temperature": 0.7
                }
            )
            if resp.status_code == 200:
                json_data = resp.json()
                ai_reply = json_data.get("choices", [{}])[0].get("message", {}).get("content", ai_reply)
            else:
                logger.error(f"AI API error ({resp.status_code}): {resp.text}")
                ai_reply = f"Ошибка API ({resp.status_code}). Пожалуйста, проверьте настройки подключения."
    except Exception as e:
        logger.error(f"AI Call failed: {e}")
        ai_reply = "Извините, не удалось связаться с сервером AI."

    await state.update_data({{ node.data.ai_output_var or 'ai_reply' }}=ai_reply)
    await message.answer(ai_reply)
    # User remains in BotStates.ai_chat_{{ node.id | replace('-', '_') }} to continue dialogue!
{% endfor %}

{% for node in notify_admin_nodes %}
async def trigger_node_{{ node.id | replace('-', '_') }}(message_or_event: types.Message | types.CallbackQuery, state: FSMContext):
    target_msg = message_or_event.message if isinstance(message_or_event, types.CallbackQuery) else message_or_event
    data = await state.get_data()
    admin_id = os.getenv("ADMIN_ID", "{{ node.data.admin_id or '' }}")
    
    username = target_msg.from_user.username or target_msg.from_user.first_name or "Anonymous"
    details = ", ".join([f"{k}: {v}" for k, v in data.items()])
    alert_text = f"🔔 <b>New Lead from @{username}:</b>\\n{details}"

    if admin_id and admin_id != "YOUR_ADMIN_ID":
        try:
            await target_msg.bot.send_message(chat_id=int(admin_id), text=alert_text)
        except Exception as e:
            logger.error(f"Failed to notify admin: {e}")

    {% set next_target = edge_map.get(node.id) %}
    {% if next_target %}
    await trigger_node_{{ next_target | replace('-', '_') }}(message_or_event, state)
    {% endif %}
{% endfor %}

{% for node in sheets_nodes %}
async def trigger_node_{{ node.id | replace('-', '_') }}(message_or_event: types.Message | types.CallbackQuery, state: FSMContext):
    target_msg = message_or_event.message if isinstance(message_or_event, types.CallbackQuery) else message_or_event
    data = await state.get_data()
    username = target_msg.from_user.username or "Anonymous"
    user_id = str(target_msg.from_user.id)

    # Save to local CSV leads store
    csv_file = "leads_{{ node.data.table_name or 'data' }}.csv"
    file_exists = os.path.exists(csv_file)
    with open(csv_file, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(["timestamp", "user_id", "username", "data"])
        writer.writerow([datetime.now().isoformat(), user_id, username, str(data)])

    {% set next_target = edge_map.get(node.id) %}
    {% if next_target %}
    await trigger_node_{{ next_target | replace('-', '_') }}(message_or_event, state)
    {% endif %}
{% endfor %}

{% for node in custom_code_nodes %}
async def trigger_node_{{ node.id | replace('-', '_') }}(message_or_event: types.Message | types.CallbackQuery, state: FSMContext):
    target_msg = message_or_event.message if isinstance(message_or_event, types.CallbackQuery) else message_or_event
    # Executing embedded custom logic:
    {{ node.data.code | indent(4) }}

    {% set next_target = edge_map.get(node.id) %}
    {% if next_target %}
    await trigger_node_{{ next_target | replace('-', '_') }}(message_or_event, state)
    {% endif %}
{% endfor %}

{% for node in media_nodes %}
async def trigger_node_{{ node.id | replace('-', '_') }}(message_or_event: types.Message | types.CallbackQuery, state: FSMContext):
    target_msg = message_or_event.message if isinstance(message_or_event, types.CallbackQuery) else message_or_event
    media_url = "{{ node.data.media_url or '' }}"
    caption = "{{ node.data.caption or '' }}"
    media_type = "{{ node.data.media_type or 'photo' }}"

    if media_url:
        try:
            if media_type == 'photo':
                await target_msg.answer_photo(photo=media_url, caption=caption or None, parse_mode=ParseMode.HTML)
            elif media_type == 'video':
                await target_msg.answer_video(video=media_url, caption=caption or None, parse_mode=ParseMode.HTML)
            elif media_type == 'audio':
                await target_msg.answer_audio(audio=media_url, caption=caption or None, parse_mode=ParseMode.HTML)
        except Exception as e:
            logger.error(f"Failed to send media: {e}")
            await target_msg.answer(f"[{media_type.upper()}] {caption}")
    elif caption:
        await target_msg.answer(caption)

    {% set next_target = edge_map.get(node.id) %}
    {% if next_target %}
    await trigger_node_{{ next_target | replace('-', '_') }}(message_or_event, state)
    {% endif %}
{% endfor %}

{% for node in timer_nodes %}
async def trigger_node_{{ node.id | replace('-', '_') }}(message_or_event: types.Message | types.CallbackQuery, state: FSMContext):
    target_msg = message_or_event.message if isinstance(message_or_event, types.CallbackQuery) else message_or_event
    timer_mode = "{{ node.data.timer_mode or 'after' }}"
    days = {{ node.data.timer_days or 0 }}
    hours = {{ node.data.timer_hours or 0 }}
    minutes = {{ node.data.timer_minutes or 0 }}
    seconds = {{ node.data.timer_seconds or 0 }}
    total_seconds = days * 86400 + hours * 3600 + minutes * 60 + seconds

    if timer_mode in ('after', 'inactivity') and total_seconds > 0:
        logger.info(f"Timer {timer_mode}: sleeping for {total_seconds}s...")
        await asyncio.sleep(min(total_seconds, 300))  # Async delay
    elif timer_mode == 'date':
        logger.info("Timer scheduled date: {{ node.data.timer_date or '' }}")

    {% if node.data.timer_text %}
    await target_msg.answer("""{{ node.data.timer_text | replace('"', '\\"') }}""")
    {% endif %}

    {% set next_target = edge_map.get(node.id) %}
    {% if next_target %}
    await trigger_node_{{ next_target | replace('-', '_') }}(message_or_event, state)
    {% endif %}
{% endfor %}

@router.callback_query(NavigationCallback.filter())
async def handle_navigation(callback: types.CallbackQuery, callback_data: NavigationCallback, state: FSMContext):
    await callback.answer()
    node_id = callback_data.node_id
    action = callback_data.action

    target_map = {
    {% for edge in button_edges %}
        ("{{ edge.source }}", "{{ edge.sourceHandle }}"): trigger_node_{{ edge.target | replace('-', '_') }},
    {% endfor %}
    }

    handler = target_map.get((node_id, action))
    if handler:
        await handler(callback, state)
    else:
        logger.warning(f"No route found for node {node_id} action {action}")
''',

    "requirements.txt": '''aiogram>=3.14.0
pyyaml>=6.0.0
httpx>=0.28.0
python-dotenv>=1.0.0
''',

    ".env.example": '''# Telegram Bot Configuration
BOT_TOKEN=YOUR_BOT_TOKEN_HERE
ADMIN_ID=YOUR_TELEGRAM_USER_ID

# Optional AI Integration
OPENAI_API_KEY=
OLLAMA_BASE_URL=http://localhost:11434
''',

    "Dockerfile": '''FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "bot.py"]
''',

    "render.yaml": '''services:
  - type: worker
    name: {{ metadata.name | lower | replace(' ', '-') }}
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: python bot.py
    autoDeploy: false
    envVars:
      - key: BOT_TOKEN
        sync: false
      - key: ADMIN_ID
        sync: false
''',

    "README.md": '''# {{ metadata.name }}

> Asynchronous Telegram Bot compiled with **Bot Studio IDE**.  
> **100% Standalone `aiogram 3.x` code** with zero vendor lock-in.

---

## 🚀 Quick Start (Local Run)

1. Clone or extract this directory.
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Copy `.env.example` to `.env` and fill in your Bot Token:
   ```bash
   cp .env.example .env
   ```
4. Run the bot:
   ```bash
   python bot.py
   ```

---

## 🌐 1-Click Free Cloud Deployment (Render.com)

1. Upload this folder to your GitHub repository.
2. Go to [Render.com](https://render.com) and create a **New Background Worker**.
3. Select your repository. Render automatically reads `render.yaml`.
4. Add your `BOT_TOKEN` in the Environment Variables dashboard.
5. Done! Your bot is live 24/7 for free.

---

## 📊 Visual Dialogue Flow (Mermaid Diagram)

```mermaid
flowchart TD
{% for node in graph.nodes %}
    {{ node.id | replace('-', '_') }}["{{ node.data.label or node.data.text or node.type }}"]
{% endfor %}

{% for edge in graph.edges %}
    {{ edge.source | replace('-', '_') }} --> {{ edge.target | replace('-', '_') }}
{% endfor %}
```
'''
}

class CompilerEngine:
    def __init__(self):
        self.jinja_env = Environment(loader=DictLoader(TEMPLATES), autoescape=False)

    def compile(self, graph: GraphSchema) -> Dict[str, str]:
        """
        Compiles the visual AST graph into a complete dictionary of files.
        """
        # Node categorizations
        start_nodes = [n for n in graph.nodes if n.type == "start"]
        message_nodes = [n for n in graph.nodes if n.type == "message"]
        input_nodes = [n for n in graph.nodes if n.type == "input"]
        ai_nodes = [n for n in graph.nodes if n.type == "ai_assistant"]
        notify_admin_nodes = [n for n in graph.nodes if n.type == "notify_admin"]
        sheets_nodes = [n for n in graph.nodes if n.type == "sheets"]
        custom_code_nodes = [n for n in graph.nodes if n.type == "custom_code"]
        timer_nodes = [n for n in graph.nodes if n.type == "timer"]
        media_nodes = [n for n in graph.nodes if n.type == "media"]
        keyboard_nodes = [n for n in graph.nodes if n.type == "keyboard"]

        # Edges map (general flow: source -> target)
        edge_map: Dict[str, str] = {}
        button_edges: List[EdgeModel] = []
        button_edge_map: Dict[tuple, str] = {}

        # Collect all button IDs from message and keyboard nodes
        all_button_ids = set()
        for node in message_nodes + keyboard_nodes:
            for btn in node.data.buttons:
                all_button_ids.add(btn.id)

        for edge in graph.edges:
            if edge.sourceHandle and (edge.sourceHandle.startswith("btn_") or edge.sourceHandle in all_button_ids):
                button_edges.append(edge)
                button_edge_map[(edge.source, edge.sourceHandle)] = edge.target
            else:
                edge_map[edge.source] = edge.target

        # Generate texts.yaml content
        texts_dict = {}
        for node in message_nodes:
            key = node.data.text_key or node.id
            texts_dict[key] = node.data.text or ""
        for node in input_nodes:
            texts_dict[f"prompt_{node.id}"] = node.data.text or f"Please enter your {node.data.variable_name or 'data'}:"

        context = {
            "metadata": graph.metadata,
            "graph": graph,
            "start_nodes": start_nodes,
            "message_nodes": message_nodes,
            "input_nodes": input_nodes,
            "ai_nodes": ai_nodes,
            "notify_admin_nodes": notify_admin_nodes,
            "sheets_nodes": sheets_nodes,
            "custom_code_nodes": custom_code_nodes,
            "timer_nodes": timer_nodes,
            "media_nodes": media_nodes,
            "keyboard_nodes": keyboard_nodes,
            "edge_map": edge_map,
            "button_edges": button_edges,
            "button_edge_map": button_edge_map,
        }

        files: Dict[str, str] = {}
        for template_name in TEMPLATES.keys():
            template = self.jinja_env.get_template(template_name)
            files[template_name] = template.render(context)

        files["texts.yaml"] = yaml.dump(texts_dict, allow_unicode=True, default_flow_style=False)
        return files

    def compile_to_zip(self, graph: GraphSchema) -> bytes:
        """
        Compiles the project and packages it into an in-memory ZIP archive.
        """
        files = self.compile(graph)
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for file_name, content in files.items():
                zip_file.writestr(file_name, content)
        return zip_buffer.getvalue()
