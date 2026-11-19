# Bot Studio IDE (v0.5.0 Beta) 🚀

<p align="center">
  <img src="docs/BotStudio%20GitHub.jpg" alt="Bot Studio Header Banner" width="100%" />
</p>

> **Visual Node-Based IDE & Deterministic Python Compiler for Telegram Bots (`aiogram 3.x`)**  
> *Design Telegram bots visually on an infinite reactive canvas, co-pilot with local offline LLMs (Gemma / Qwen with hardware acceleration), test in a real-time simulator or directly in Telegram, and compile to clean, production-ready standalone asynchronous Python with Zero Vendor Lock-in.*

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/Status-Beta_(Early_Development)-yellow.svg" alt="Beta Release" /></a>
  <a href="https://img.shields.io/badge/OS-Windows%2010%2F11%20%7C%20Linux%20%7C%20macOS-blue.svg"><img src="https://img.shields.io/badge/OS-Windows%2010%2F11%20%7C%20Linux%20%7C%20macOS-blue.svg" alt="Cross-Platform OS" /></a>
  <a href="https://img.shields.io/badge/Hardware-AMD%20Vulkan%20%7C%20NVIDIA%20CUDA%20%7C%20Apple%20Metal%20%7C%20Intel-purple.svg"><img src="https://img.shields.io/badge/Hardware-AMD%20Vulkan%20%7C%20NVIDIA%20CUDA%20%7C%20Apple%20Metal%20%7C%20Intel-purple.svg" alt="Hardware Acceleration" /></a>
  <a href="https://www.python.org/"><img src="https://img.shields.io/badge/Python-3.10%20%7C%203.11%20%7C%203.12%20%7C%203.14-emerald.svg" alt="Python Version" /></a>
  <a href="https://docs.aiogram.dev/"><img src="https://img.shields.io/badge/aiogram-3.x-red.svg" alt="aiogram 3.x" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19%20%7C%20Vite-61dafb.svg" alt="React 19" /></a>
  <a href="#"><img src="https://img.shields.io/badge/i18n-9_Languages-orange.svg" alt="9 Languages" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-lightgrey.svg" alt="License" /></a>
</p>

> [!NOTE]
> **Project Status: Public Beta (Early Development Stage)**  
> *Bot Studio is currently in its early beta phase. Core components — including the visual node canvas, deterministic aiogram 3.x compiler, offline simulator, live Telegram runner, and hardware-accelerated local LLM copilot — are active and functional. Because the project is at an early stage, APIs, schema, and UI layouts may evolve. We actively welcome feedback, suggestions, and GitHub Issues!*

---

## ⚡ Cross-Platform & Hardware Acceleration Matrix

Bot Studio includes an embedded high-performance **`llama.cpp`** local inference engine. It automatically identifies your operating system, CPU architecture, and graphics hardware to select the optimal acceleration backend:

| Hardware & Platform | Acceleration Engine | Offload Mode | Performance |
| :--- | :--- | :--- | :--- |
| **AMD (Radeon 780M / 680M / Vega iGPU & RX dGPU)** | **Vulkan API** (`llama-vulkan`) | Fully offloaded (`-ngl 99`) | ⚡ High |
| **NVIDIA (GeForce GTX / RTX 20/30/40/50-series)** | **CUDA** (`llama-cuda` cu12) | Fully offloaded (`-ngl 99`) | 🚀 Ultra |
| **Intel (Iris Xe / UHD Graphics & Arc dGPU)** | **Vulkan API** (`llama-vulkan`) | Fully offloaded (`-ngl 99`) | ⚡ High |
| **Apple Silicon (Mac M1, M2, M3, M4)** | **Metal API** (`llama-metal`) | Unified Memory offload | 🚀 Ultra |
| **CPU Only (Any AMD Ryzen, Intel Core, ARM)** | **AVX2 / AVX-512 / NEON** | Multithreaded CPU (`-t 8`) | 🟢 Efficient (~2.5 GB RAM) |

### Supported Operating Systems:
- **Windows 11 / Windows 10 (64-bit)**: 100% native support (Vulkan, CUDA, CPU).
- **Linux (Ubuntu, Debian, Fedora, Arch, etc.)**: 100% native support (Vulkan, CUDA, ROCm, CPU).
- **macOS (Apple Silicon & Intel)**: 100% native support (Metal & AVX2).
- *Legacy Windows Note:* Windows 7 is officially unsupported by Python (>=3.9) and Node.js. For Windows 7 machines, we recommend compiling the bot on a modern machine or running the generated bot in Docker / cloud.

---

## 🚀 1-Click Launch (Быстрый старт)

### 🪟 Windows (10 / 11)
Simply double-click **`start_windows.bat`** (or `start.bat`).  
The launcher will automatically:
1. Verify Python 3.10+ and Node.js.
2. Install any missing dependencies.
3. Auto-detect your GPU (AMD, NVIDIA, Intel).
4. Launch the Backend (`http://127.0.0.1:8000`) & Frontend (`http://127.0.0.1:5173`).
5. Open your default web browser directly into Bot Studio!

### 🐧 Linux & 🍎 macOS
Open your terminal in the project folder and run:
```bash
chmod +x start_linux_mac.sh
./start_linux_mac.sh
```

### 🐳 Docker & Docker Compose
To run Bot Studio completely containerized without installing Python or Node.js locally:
```bash
docker compose up --build
```
Open **`http://localhost:5173`** in your browser.

---

## 🌟 Ключевые возможности (Key Features)

- **Полная мультиязычность (i18n) на 9 языках:**
  - Поддержка: **Русский, English, Français, Deutsch, Español, 日本語, 한국어, Português, Italiano**.
  - Автоматическое определение языка браузера (`navigator.languages`) при первом открытии.
  - Мгновенное переключение всех элементов интерфейса, инспектора нод и системных подсказок.
- **Инлайн-редактирование нод на холсте:**
  - Тексты сообщений, кнопки, таймеры, переменные и условия редактируются прямо внутри карточек на холсте.
- **Анимированные стрелочки потока данных:**
  - Динамические маркеры-стрелочки, бегущие по ребрам графа и наглядно показывающие направление выполнения сценария.
- **Встроенный ИИ-Ассистент (Gemma-4-E4B Q4):**
  - **Автономный llama.cpp:** работает прямо из папки без необходимости устанавливать сторонние утилиты.
  - **Аппаратное ускорение:** Vulkan для AMD и Intel, CUDA для NVIDIA, Metal для Apple Silicon.
  - **✨ Генерация по тексту:** ввод текстового ТЗ и мгновенная генерация схемы нод с красивой автоматической расстановкой.
  - **📁 RAG-анализ документов:** загрузка PDF и DOCX для обучения бота на вашей документации.
- **Zero Vendor Lock-in (100% независимый код):**
  - По нажатию кнопки **Собрать (Build)** генерируется чистый автономный проект на `aiogram 3.x` (`bot.py`, `handlers.py`, `keyboards.py`, `states.py`, `texts.yaml`, `requirements.txt`, `Dockerfile`, `render.yaml`).
- **Офлайн-симулятор & Трассировка графа:**
  - Встроенный интерактивный чат Telegram с подсветкой активных узлов на графе при кликах.
- **Live Test в реальном Telegram:**
  - Запуск бота в фоне с токеном от @BotFather для мгновенного тестирования на смартфоне.
- **1-Click Деплой на Render.com:**
  - Готовый `render.yaml` позволяет запустить бота 24/7 на бесплатном облачном хостинге без терминала.

---

## 🛠 Палитра узлов (10 Core Nodes)

| Нода | Назначение | Возможности на холсте |
| :--- | :--- | :--- |
| **🚀 Старт / Команда** | Точка входа по команде (`/start`, `/help`) | Поле команды, описание, единая точка входа |
| **💬 Сообщение** | Отправка текста, картинок и инлайн-кнопок | Текст с HTML/Markdown форматированием, загрузка картинок с компьютера/URL, инлайн-кнопки, ИИ-ручка ✨ |
| **⌨️ Нижнее меню (Keyboard)** | Постоянные Reply-кнопки внизу чата | Адаптивная сетка (1 кнопка во всю ширину, 2 в ряд, сетка 2х2), порты для каждой кнопки |
| **⏳ Время / Таймер** | Паузы, задержки и расписание | Дни, часы, минуты, секунды, отложенная дата, тихий режим или опциональное кастомное сообщение |
| **🖼 Мультимедиа** | Отправка фото, видео или аудио | Загрузка файла через проводник или прямой URL, автоматическая буферизация для Telegram, подпись |
| **🤖 AI (ИИ-Ассистент)** | Интеграция с локальными или облачными нейросетями | URL шлюза, модель, API-ключ, системный промпт, приветствие, настраиваемый антиспам и лимиты |
| **📥 Ожидание ввода (FSM)** | Запрос данных от пользователя | Имя переменной, валидация типов (текст, число, телефон, email), текст ошибки |
| **📊 Таблица / Sheets** | Сохранение лидов и заявок | Запись в локальный CSV или базу данных, сохранение истории клиентов |
| **🔔 Уведомление админу** | Мгновенная пересылка заявки разработчику в ЛС | Telegram User ID администратора, шаблон уведомления с подстановкой `{variables}` |
| **🐍 Custom Python** | Вставка произвольного блока асинхронного Python-кода | Встроенный редактор кода, доступ к `state` и объектам aiogram 3.x |

---

## 👤 Авторство и Лицензия

**Автор и создатель проекта:** Markus Marrei (Маркус Маррей)  
Проект распространяется под открытой лицензией **Apache License 2.0**. См. подробнее в файле [LICENSE](LICENSE).

Copyright 2026 Markus Marrei (Маркус Маррей). All rights reserved.

> *Дисклеймер: Bot Studio является независимым проектом с открытым исходным кодом и не аффилирован, не спонсируется и не одобряется Telegram FZ-LLC, Unity Technologies или Google LLC.*
