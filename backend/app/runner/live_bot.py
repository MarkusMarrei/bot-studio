import asyncio
import logging
from typing import Optional, Dict, Any, List
import httpx
from aiogram import Bot, Dispatcher, Router, types, F
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.client.default import DefaultBotProperties
from aiogram.filters import CommandStart
from aiogram.types import (
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    ReplyKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardRemove,
    BufferedInputFile,
    FSInputFile,
    URLInputFile
)
import base64
import os

from app.models.graph import GraphSchema, NodeModel, EdgeModel

logger = logging.getLogger("live_runner")

class LiveBotRunner:
    def __init__(self):
        self._current_task: Optional[asyncio.Task] = None
        self._bot_instance: Optional[Bot] = None
        self._dp_instance: Optional[Dispatcher] = None
        self._is_running: bool = False
        self._active_token_preview: str = ""
        self._logs: list[str] = []
        self._user_context: Dict[int, Dict[str, Any]] = {}
        self._graph: Optional[GraphSchema] = None

    def get_status(self) -> Dict[str, Any]:
        return {
            "is_running": self._is_running,
            "active_token_preview": self._active_token_preview,
            "log_lines": self._logs[-20:]
        }

    async def _resolve_media_input(self, media_src: str, default_ext: str = "bin"):
        """Resolves Base64 DataURLs, local file paths, and HTTP(S) URLs into aiogram InputFiles."""
        if not media_src or not isinstance(media_src, str):
            return None
        media_src = media_src.strip()

        # 1. Base64 Data URL (e.g. data:image/png;base64,... or data:video/mp4;base64,...)
        if media_src.startswith("data:"):
            try:
                parts = media_src.split(";base64,")
                if len(parts) == 2:
                    header, b64_str = parts
                    mime = header.replace("data:", "")
                    ext = default_ext
                    if "/" in mime:
                        ext = mime.split("/")[1].split("+")[0]
                    data_bytes = base64.b64decode(b64_str)
                    return BufferedInputFile(data_bytes, filename=f"upload_{int(asyncio.get_event_loop().time())}.{ext}")
            except Exception as e:
                self._logs.append(f"Failed to decode base64 media: {e}")
                return None

        # 2. Local file path (e.g. C:\Users\... or file:///... or assets/...)
        clean_path = media_src
        if clean_path.startswith("file:///"):
            clean_path = clean_path[8:]
        elif clean_path.startswith("file://"):
            clean_path = clean_path[7:]
        clean_path = os.path.normpath(clean_path)

        if os.path.isfile(clean_path):
            filename = os.path.basename(clean_path) or f"file.{default_ext}"
            return FSInputFile(clean_path, filename=filename)

        # 3. HTTP / HTTPS URL
        if media_src.startswith("http://") or media_src.startswith("https://"):
            # Attempt to fetch directly via httpx so that firewall or Telegram download blocks don't fail
            try:
                async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                    resp = await client.get(media_src)
                    if resp.status_code == 200:
                        ct = resp.headers.get("content-type", "")
                        ext = default_ext
                        if "/" in ct:
                            ext = ct.split("/")[1].split(";")[0]
                        filename = f"media_{int(asyncio.get_event_loop().time())}.{ext}"
                        return BufferedInputFile(resp.content, filename=filename)
            except Exception as fetch_err:
                self._logs.append(f"Direct stream download fallback for {media_src[:60]}: {fetch_err}")
            # Fallback to passing raw URL string to Telegram
            return media_src

        return None

    def _find_node(self, node_id: str) -> Optional[NodeModel]:
        if not self._graph:
            return None
        return next((n for n in self._graph.nodes if n.id == node_id), None)

    def _find_target_for_callback(self, callback_data: str) -> Optional[NodeModel]:
        if not self._graph:
            return None

        # 1. Direct edge with sourceHandle == callback_data
        edge = next((e for e in self._graph.edges if e.sourceHandle == callback_data), None)
        if edge:
            return self._find_node(edge.target)

        # 2. Edge with source == callback_data
        edge = next((e for e in self._graph.edges if e.source == callback_data), None)
        if edge:
            return self._find_node(edge.target)

        # 3. Search node containing button with id == callback_data
        for node in self._graph.nodes:
            buttons = getattr(node.data, 'buttons', []) or []
            if any(b.id == callback_data for b in buttons):
                node_edges = [e for e in self._graph.edges if e.source == node.id]
                handle_edge = next((e for e in node_edges if e.sourceHandle == callback_data), None)
                if handle_edge:
                    return self._find_node(handle_edge.target)
                if len(node_edges) == 1:
                    return self._find_node(node_edges[0].target)

        return None

    def _find_target_for_reply_text(self, text: str) -> Optional[NodeModel]:
        if not self._graph:
            return None
        text_clean = text.strip()
        for node in self._graph.nodes:
            if node.type == "keyboard":
                buttons = getattr(node.data, 'buttons', []) or []
                for b in buttons:
                    if b.text.strip().lower() == text_clean.lower():
                        edge = next((e for e in self._graph.edges if e.sourceHandle == b.id), None)
                        if edge:
                            return self._find_node(edge.target)
                        node_edges = [e for e in self._graph.edges if e.source == node.id]
                        if len(node_edges) == 1:
                            return self._find_node(node_edges[0].target)
        return None

    async def _execute_node(self, bot: Bot, chat_id: int, node: NodeModel, user: Optional[types.User] = None):
        if not node:
            return

        self._logs.append(f"Executing [{node.type}] {node.id} ({node.data.label or 'Unnamed'})")
        username = user.username if user and user.username else "User"
        user_id = str(user.id if user else chat_id)
        first_name = user.first_name if user and user.first_name else "Friend"

        ctx = self._user_context.setdefault(chat_id, {})
        ctx["active_node_id"] = node.id

        try:
            if node.type == "message":
                raw_text = node.data.text or node.data.label or "..."
                text = (
                    raw_text.replace("{username}", username)
                    .replace("{user_id}", user_id)
                    .replace("{name}", first_name)
                    .replace("{first_name}", first_name)
                )
                for k, v in ctx.items():
                    if isinstance(v, str):
                        text = text.replace(f"{{{k}}}", v)

                kb = None
                if node.data.buttons:
                    inline_keyboard = [
                        [InlineKeyboardButton(text=b.text, callback_data=b.id)]
                        for b in node.data.buttons
                    ]
                    kb = InlineKeyboardMarkup(inline_keyboard=inline_keyboard)

                # Check for attached image
                img_path = getattr(node.data, 'image_path', None)
                sent = False
                if img_path:
                    media_input = await self._resolve_media_input(img_path, default_ext="jpg")
                    if media_input:
                        try:
                            await bot.send_photo(
                                chat_id=chat_id,
                                photo=media_input,
                                caption=text or None,
                                reply_markup=kb,
                                parse_mode=ParseMode.HTML
                            )
                            sent = True
                        except Exception as e:
                            self._logs.append(f"Photo send error in message node: {e}")

                if not sent:
                    await bot.send_message(
                        chat_id=chat_id,
                        text=text,
                        reply_markup=kb,
                        parse_mode=ParseMode.HTML
                    )

            elif node.type == "keyboard":
                raw_text = node.data.text or "Выберите действие:"
                text = (
                    raw_text.replace("{username}", username)
                    .replace("{user_id}", user_id)
                    .replace("{name}", first_name)
                )
                for k, v in ctx.items():
                    if isinstance(v, str):
                        text = text.replace(f"{{{k}}}", v)

                if node.data.buttons:
                    buttons = node.data.buttons
                    rows = []
                    if len(buttons) == 1:
                        rows = [[KeyboardButton(text=buttons[0].text)]]
                    elif len(buttons) == 2:
                        rows = [[KeyboardButton(text=buttons[0].text), KeyboardButton(text=buttons[1].text)]]
                    elif len(buttons) == 4:
                        rows = [
                            [KeyboardButton(text=buttons[0].text), KeyboardButton(text=buttons[1].text)],
                            [KeyboardButton(text=buttons[2].text), KeyboardButton(text=buttons[3].text)]
                        ]
                    else:
                        curr = []
                        for b in buttons:
                            curr.append(KeyboardButton(text=b.text))
                            if len(curr) >= 2:
                                rows.append(curr)
                                curr = []
                        if curr:
                            rows.append(curr)

                    reply_kb = ReplyKeyboardMarkup(
                        keyboard=rows,
                        resize_keyboard=node.data.resize_keyboard if node.data.resize_keyboard is not None else True,
                        one_time_keyboard=node.data.one_time_keyboard if node.data.one_time_keyboard is not None else False
                    )
                    await bot.send_message(chat_id=chat_id, text=text, reply_markup=reply_kb, parse_mode=ParseMode.HTML)
                else:
                    await bot.send_message(chat_id=chat_id, text=text, parse_mode=ParseMode.HTML)

            elif node.type == "media":
                media_type = node.data.media_type or "photo"
                caption = node.data.caption or ""
                media_url = node.data.media_url or ""

                caption = (
                    caption.replace("{username}", username)
                    .replace("{user_id}", user_id)
                    .replace("{name}", first_name)
                )

                sent = False
                if media_url:
                    default_ext = "jpg" if media_type == "photo" else ("mp4" if media_type == "video" else "mp3")
                    media_input = await self._resolve_media_input(media_url, default_ext=default_ext)
                    if media_input:
                        try:
                            if media_type == "photo":
                                await bot.send_photo(chat_id=chat_id, photo=media_input, caption=caption or None, parse_mode=ParseMode.HTML)
                                sent = True
                            elif media_type == "video":
                                await bot.send_video(chat_id=chat_id, video=media_input, caption=caption or None, parse_mode=ParseMode.HTML)
                                sent = True
                            elif media_type == "audio":
                                await bot.send_audio(chat_id=chat_id, audio=media_input, caption=caption or None, parse_mode=ParseMode.HTML)
                                sent = True
                        except Exception as e:
                            self._logs.append(f"Media send error ({media_type}): {e}")

                if not sent:
                    await bot.send_message(
                        chat_id=chat_id,
                        text=f"📁 [{media_type.upper()}] {caption or 'Медиафайл'}",
                        parse_mode=ParseMode.HTML
                    )

                out_edge = next((e for e in self._graph.edges if e.source == node.id), None)
                if out_edge:
                    next_node = self._find_node(out_edge.target)
                    if next_node:
                        await asyncio.sleep(0.3)
                        await self._execute_node(bot, chat_id, next_node, user)

            elif node.type == "notify_admin":
                admin_id_raw = node.data.admin_id
                template = node.data.notification_template or "🔔 Новая заявка от @{username}"
                formatted = (
                    template.replace("{username}", username)
                    .replace("{user_id}", user_id)
                    .replace("{name}", first_name)
                )
                for k, v in ctx.items():
                    if isinstance(v, str):
                        formatted = formatted.replace(f"{{{k}}}", v)

                if admin_id_raw and admin_id_raw != "YOUR_ADMIN_ID":
                    try:
                        admin_id_int = int(admin_id_raw.strip())
                        await bot.send_message(chat_id=admin_id_int, text=formatted)
                        self._logs.append(f"Notification delivered to admin ({admin_id_int})")
                    except Exception as e:
                        self._logs.append(f"Admin dispatch warning: {e}")
                else:
                    self._logs.append(f"Admin alert simulated: {formatted}")

                out_edge = next((e for e in self._graph.edges if e.source == node.id), None)
                if out_edge:
                    next_node = self._find_node(out_edge.target)
                    if next_node:
                        await asyncio.sleep(0.3)
                        await self._execute_node(bot, chat_id, next_node, user)

            elif node.type == "timer":
                d = node.data.timer_days or 0
                h = node.data.timer_hours or 0
                m = node.data.timer_minutes or 0
                s = node.data.timer_seconds or 0
                total_sec = d * 86400 + h * 3600 + m * 60 + s
                self._logs.append(f"Timer step ({total_sec}s, mode: {node.data.timer_mode or 'after'})")

                if 0 < total_sec <= 3:
                    await asyncio.sleep(total_sec)
                else:
                    await asyncio.sleep(0.4)

                timer_msg = getattr(node.data, 'timer_text', None)
                if timer_msg and timer_msg.strip():
                    await bot.send_message(
                        chat_id=chat_id,
                        text=timer_msg.strip(),
                        parse_mode=ParseMode.HTML
                    )

                out_edge = next((e for e in self._graph.edges if e.source == node.id), None)
                if out_edge:
                    next_node = self._find_node(out_edge.target)
                    if next_node:
                        await self._execute_node(bot, chat_id, next_node, user)

            elif node.type == "ai_assistant":
                welcome_text = getattr(node.data, 'ai_welcome_text', None) or f"👋 Здравствуйте, {first_name}! Я ИИ-ассистент. Чем я могу вам помочь? Напишите ваш вопрос прямо в чат."
                ctx["active_ai_node"] = node.id
                ctx["waiting_input_for"] = None
                await bot.send_message(
                    chat_id=chat_id,
                    text=welcome_text
                )
                # DO NOT automatically follow out_edge! User stays in interactive dialogue with AI.

            elif node.type == "input":
                prompt_text = node.data.text or f"Пожалуйста, введите {node.data.variable_name or 'данные'}:"
                ctx["waiting_input_for"] = node.id
                ctx["waiting_var"] = node.data.variable_name or "user_input"
                await bot.send_message(chat_id=chat_id, text=prompt_text)

            elif node.type == "custom_code":
                self._logs.append(f"Custom code node executed: {node.data.label or node.id}")
                out_edge = next((e for e in self._graph.edges if e.source == node.id), None)
                if out_edge:
                    next_node = self._find_node(out_edge.target)
                    if next_node:
                        await asyncio.sleep(0.3)
                        await self._execute_node(bot, chat_id, next_node, user)

            elif node.type == "sheets":
                table_name = node.data.table_name or "leads"
                csv_file = f"leads_{table_name}.csv"
                file_exists = os.path.exists(csv_file)
                try:
                    import csv
                    from datetime import datetime
                    with open(csv_file, "a", newline="", encoding="utf-8") as f:
                        writer = csv.writer(f)
                        if not file_exists:
                            writer.writerow(["timestamp", "user_id", "username", "data"])
                        writer.writerow([datetime.now().isoformat(), user_id, username, str(ctx)])
                    self._logs.append(f"Row saved to {csv_file}")
                except Exception as e:
                    self._logs.append(f"Sheets write error: {e}")

                out_edge = next((e for e in self._graph.edges if e.source == node.id), None)
                if out_edge:
                    next_node = self._find_node(out_edge.target)
                    if next_node:
                        await asyncio.sleep(0.3)
                        await self._execute_node(bot, chat_id, next_node, user)

        except Exception as err:
            self._logs.append(f"Execution error on node {node.id}: {err}")
            logger.error(f"Error executing node {node.id}: {err}")

    async def start(self, token: str, graph: GraphSchema):
        """Starts live polling for the given bot token in the background."""
        if self._is_running:
            await self.stop()

        self._logs.clear()
        self._logs.append("Initializing Live Bot runner...")
        self._graph = graph
        self._user_context.clear()

        clean_token = token.strip()
        if not clean_token or ":" not in clean_token:
            raise ValueError("Invalid Telegram Bot Token format. It must look like '123456789:ABCdef...'")

        self._active_token_preview = f"{clean_token[:6]}...{clean_token[-4:]}"

        bot = Bot(
            token=clean_token,
            default=DefaultBotProperties(parse_mode=ParseMode.HTML)
        )
        dp = Dispatcher(storage=MemoryStorage())
        router = Router()

        @router.message(CommandStart())
        async def live_handle_start(message: types.Message):
            chat_id = message.chat.id
            ctx = self._user_context.setdefault(chat_id, {})
            ctx["active_ai_node"] = None
            ctx["waiting_input_for"] = None
            self._logs.append(f"Received /start from @{message.from_user.username or message.from_user.id}")
            start_node = next((n for n in self._graph.nodes if n.type == "start"), None)
            if not start_node:
                await message.answer("✅ Bot Studio Live Test is connected! (No start node found in graph)")
                return

            out_edge = next((e for e in self._graph.edges if e.source == start_node.id), None)
            if out_edge:
                target_node = self._find_node(out_edge.target)
                if target_node:
                    await self._execute_node(bot, message.chat.id, target_node, message.from_user)
                else:
                    await message.answer("✅ Bot connected! First step node target not found.")
            else:
                first_msg = next((n for n in self._graph.nodes if n.type == "message"), None)
                if first_msg:
                    await self._execute_node(bot, message.chat.id, first_msg, message.from_user)
                else:
                    await message.answer("✅ Bot Studio Live Test is connected and active!")

        @router.callback_query()
        async def live_handle_cb(callback: types.CallbackQuery):
            chat_id = callback.message.chat.id
            ctx = self._user_context.setdefault(chat_id, {})
            self._logs.append(f"Callback button clicked: {callback.data}")
            target_node = self._find_target_for_callback(callback.data)
            await callback.answer()
            if target_node:
                if target_node.type != "ai_assistant":
                    ctx["active_ai_node"] = None
                await self._execute_node(bot, callback.message.chat.id, target_node, callback.from_user)
            else:
                self._logs.append(f"Warning: No target node linked to button '{callback.data}'")

        @router.message(F.text)
        async def live_handle_text(message: types.Message):
            text = message.text.strip()
            chat_id = message.chat.id
            ctx = self._user_context.setdefault(chat_id, {})

            # 1. Check if user is responding to an input node
            waiting_node_id = ctx.get("waiting_input_for")
            if waiting_node_id:
                var_name = ctx.get("waiting_var", "user_input")
                ctx[var_name] = text
                ctx["waiting_input_for"] = None
                self._logs.append(f"Recorded input for '{var_name}': {text}")
                out_edge = next((e for e in self._graph.edges if e.source == waiting_node_id), None)
                if out_edge:
                    target_node = self._find_node(out_edge.target)
                    if target_node:
                        await self._execute_node(bot, chat_id, target_node, message.from_user)
                        return

            # 2. Check if text matches reply keyboard buttons
            target_node = self._find_target_for_reply_text(text)
            if target_node:
                ctx["active_ai_node"] = None
                self._logs.append(f"Reply keyboard button matched: '{text}' -> node {target_node.id}")
                await self._execute_node(bot, chat_id, target_node, message.from_user)
                return

            # 3. Check if user is actively chatting with an AI Assistant node
            active_ai_node_id = ctx.get("active_ai_node")
            if active_ai_node_id:
                ai_node = self._find_node(active_ai_node_id)
                if ai_node:
                    limit_type = getattr(ai_node.data, 'ai_limit_type', 'none') or 'none'
                    limit_count = getattr(ai_node.data, 'ai_limit_count', 15) or 15
                    count_key = f"ai_count_{ai_node.id}"
                    curr_count = ctx.get(count_key, 0)

                    if limit_type != "none" and curr_count >= limit_count:
                        limit_text = getattr(ai_node.data, 'ai_limit_text', None) or getattr(ai_node.data, 'ai_limit_message', None) or "⚠️ Вы достигли лимита бесплатных сообщений к ИИ-ассистенту. Пожалуйста, обратитесь к администратору или вернитесь в главное меню."
                        await bot.send_message(chat_id=chat_id, text=limit_text)
                        return  # Do not transition anywhere! User stays in current view.

                    ctx[count_key] = curr_count + 1
                    base_url = (getattr(ai_node.data, 'ai_base_url', '') or 'https://api.openai.com/v1').rstrip('/')
                    api_key = getattr(ai_node.data, 'ai_api_key', '') or ''
                    model = getattr(ai_node.data, 'ai_model', '') or 'gpt-4o-mini'
                    system_prompt = getattr(ai_node.data, 'ai_system_prompt', '') or 'You are a helpful and smart AI assistant in Telegram.'

                    endpoint = base_url
                    if not endpoint.endswith('/chat/completions'):
                        endpoint = f"{endpoint}/chat/completions"

                    await bot.send_chat_action(chat_id=chat_id, action="typing")
                    ai_reply = "Извините, не удалось связаться с сервером AI."
                    try:
                        headers = {"Content-Type": "application/json"}
                        if api_key:
                            headers["Authorization"] = f"Bearer {api_key}"
                        async with httpx.AsyncClient(timeout=45.0) as client:
                            resp = await client.post(
                                endpoint,
                                headers=headers,
                                json={
                                    "model": model,
                                    "messages": [
                                        {"role": "system", "content": system_prompt},
                                        {"role": "user", "content": text}
                                    ],
                                    "temperature": 0.7
                                }
                            )
                            if resp.status_code == 200:
                                res_json = resp.json()
                                ai_reply = res_json.get("choices", [{}])[0].get("message", {}).get("content", ai_reply)
                            else:
                                ai_reply = f"Ошибка API ({resp.status_code}). Пожалуйста, проверьте API-ключ или параметры подключения."
                    except Exception as err:
                        logger.error(f"Error querying AI API: {err}")
                        ai_reply = f"Не удалось выполнить запрос к ИИ: {err}"

                    await bot.send_message(chat_id=chat_id, text=ai_reply)
                    return  # User stays in AI node!

            self._logs.append(f"Received message from @{message.from_user.username or chat_id}: {text}")

        dp.include_router(router)

        self._bot_instance = bot
        self._dp_instance = dp
        self._is_running = True

        async def _run_polling():
            try:
                self._logs.append("Deleting webhook and starting long polling...")
                await bot.delete_webhook(drop_pending_updates=True)
                await dp.start_polling(bot)
            except Exception as e:
                self._logs.append(f"Live Bot Polling Error: {e}")
                logger.error(f"Polling error: {e}")
            finally:
                self._is_running = False
                await bot.session.close()

        self._current_task = asyncio.create_task(_run_polling())
        self._logs.append("Live Bot is NOW ACTIVE in Telegram! Open your bot and send /start.")

    async def stop(self):
        """Stops the active live bot session."""
        if not self._is_running:
            return

        self._logs.append("Stopping Live Bot session...")
        if self._dp_instance:
            await self._dp_instance.stop_polling()
        if self._bot_instance:
            await self._bot_instance.session.close()
        if self._current_task and not self._current_task.done():
            self._current_task.cancel()

        self._is_running = False
        self._active_token_preview = ""
        self._logs.append("Live Bot session stopped.")

live_bot_runner = LiveBotRunner()
