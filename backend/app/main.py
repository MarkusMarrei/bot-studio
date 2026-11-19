import os
from pathlib import Path
from fastapi import FastAPI, HTTPException, Body, Response, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import HOST, PORT, DEFAULT_LLM_MODEL
from app.models.graph import GraphSchema, AuditReport
from app.compiler.validator import audit_graph
from app.compiler.engine import CompilerEngine
from app.ai.llm_service import llm_service
from app.ai.rag_service import parse_document
from app.runner.live_bot import live_bot_runner
from app.utils.system_diag import get_system_diagnostics

app = FastAPI(
    title="Bot Studio IDE API",
    description="Engine for visual Telegram bot development and compilation (aiogram 3.x)",
    version="0.5.0-beta",
    license_info={
        "name": "Apache 2.0",
        "url": "https://www.apache.org/licenses/LICENSE-2.0.html",
    },
    contact={
        "name": "Markus Marrei (Маркус Маррей)",
    }
)

# Enable CORS for local web development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

compiler = CompilerEngine()

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "default_llm_model": DEFAULT_LLM_MODEL
    }

@app.get("/api/system/diag")
async def system_diag():
    """Hardware diagnostics (Win32 ctypes implementation without heavy dependencies)."""
    return get_system_diagnostics()

@app.post("/api/validate", response_model=AuditReport)
async def validate_graph(graph: GraphSchema):
    """Preflight logical process audit with maturity score."""
    return audit_graph(graph)

@app.post("/api/compile/preview")
async def preview_compilation(graph: GraphSchema):
    """Returns compiled file tree contents for inspection in the IDE."""
    files = compiler.compile(graph)
    return {
        "status": "success",
        "files": files
    }

@app.post("/api/compile/download")
async def download_compilation(graph: GraphSchema):
    """Downloads the standalone aiogram 3.x project as a ZIP archive."""
    zip_bytes = compiler.compile_to_zip(graph)
    filename = f"{graph.metadata.name.lower().replace(' ', '_')}_bot.zip"
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/api/media/local")
async def serve_local_media(path: str):
    """Safely serves local images, videos, and audio for in-browser Simulator previews."""
    clean_path = path.strip()
    if clean_path.startswith("file:///"):
        clean_path = clean_path[8:]
    elif clean_path.startswith("file://"):
        clean_path = clean_path[7:]
    clean_path = os.path.normpath(clean_path)

    if not os.path.isfile(clean_path):
        raise HTTPException(status_code=404, detail="Local file not found")

    return FileResponse(clean_path)

@app.get("/api/templates")
async def get_templates():
    """Built-in production ready bot blueprints."""
    return [
        {
            "id": "portfolio_lead_gen",
            "name": "Портфолио & Сбор заявок (Lead Gen)",
            "description": "Идеально для визитки: презентация навыков, кнопка заказа и сбор контакта с уведомлением в ЛС.",
            "nodes": [
                {
                    "id": "start_1",
                    "type": "start",
                    "position": {"x": 80, "y": 150},
                    "data": {"label": "/start", "command": "/start", "description": "Entry point via /start command"}
                },
                {
                    "id": "msg_welcome",
                    "type": "message",
                    "position": {"x": 340, "y": 150},
                    "data": {
                        "label": "Welcome",
                        "text": "👋 Welcome! I am the Bot Studio development bot. Here you can explore our portfolio or order a custom bot.",
                        "buttons": [
                            {"id": "btn_projects", "text": "💼 My Projects", "action_type": "callback"},
                            {"id": "btn_order", "text": "🚀 Order a Bot", "action_type": "callback"}
                        ]
                    }
                },
                {
                    "id": "msg_projects",
                    "type": "message",
                    "position": {"x": 680, "y": 60},
                    "data": {
                        "label": "Projects List",
                        "text": "🔥 <b>Featured Projects:</b>\n1. Bot Studio IDE (Visual Compiler)\n2. SREDA AI (Local Workstation)\n3. BPMN Studio (Process Modeler)",
                        "buttons": [
                            {"id": "btn_back", "text": "⬅️ Back to Menu", "action_type": "callback"}
                        ]
                    }
                },
                {
                    "id": "notify_admin_1",
                    "type": "notify_admin",
                    "position": {"x": 680, "y": 420},
                    "data": {
                        "label": "Notify Admin",
                        "admin_id": "YOUR_ADMIN_ID",
                        "notification_template": "🔔 New bot order from @{username} (ID: {user_id})"
                    }
                },
                {
                    "id": "msg_thanks",
                    "type": "message",
                    "position": {"x": 1020, "y": 420},
                    "data": {
                        "label": "Thank You",
                        "text": "✅ Thank you for your request! We will get in touch with you shortly.",
                        "buttons": [
                            {"id": "btn_home", "text": "🏠 Main Menu", "action_type": "callback"}
                        ]
                    }
                }
            ],
            "edges": [
                {"id": "e1", "source": "start_1", "target": "msg_welcome"},
                {"id": "e2", "source": "msg_welcome", "target": "msg_projects", "sourceHandle": "btn_projects"},
                {"id": "e3", "source": "msg_projects", "target": "msg_welcome", "sourceHandle": "btn_back"},
                {"id": "e4", "source": "msg_welcome", "target": "notify_admin_1", "sourceHandle": "btn_order"},
                {"id": "e5", "source": "notify_admin_1", "target": "msg_thanks"},
                {"id": "e6", "source": "msg_thanks", "target": "msg_welcome", "sourceHandle": "btn_home"}
            ]
        },
        {
            "id": "ai_assistant_bot",
            "name": "AI Assistant (Gemma-4-E4B)",
            "description": "Smart conversational bot answering user inquiries with local Gemma-4 E4B LLM.",
            "nodes": [
                {
                    "id": "s1",
                    "type": "start",
                    "position": {"x": 100, "y": 150},
                    "data": {"label": "/start", "command": "/start"}
                },
                {
                    "id": "m1",
                    "type": "message",
                    "position": {"x": 360, "y": 150},
                    "data": {
                        "label": "Welcome",
                        "text": "🤖 Hello! I am an AI consultant powered by Gemma-4-E4B. Ask me anything:",
                        "buttons": []
                    }
                },
                {
                    "id": "in1",
                    "type": "input",
                    "position": {"x": 700, "y": 150},
                    "data": {
                        "label": "User Question",
                        "text": "Please enter your question:",
                        "variable_name": "client_question"
                    }
                },
                {
                    "id": "ai1",
                    "type": "ai_assistant",
                    "position": {"x": 1040, "y": 150},
                    "data": {
                        "label": "Gemma-4 Neural Net",
                        "ai_model": "google/gemma-4-E4B-Q4_K_M",
                        "ai_system_prompt": "You are a helpful and professional consultant. Provide clear and concise answers.",
                        "ai_output_var": "ai_reply"
                    }
                }
            ],
            "edges": [
                {"id": "e_s_m", "source": "s1", "target": "m1"},
                {"id": "e_m_i", "source": "m1", "target": "in1"},
                {"id": "e_i_a", "source": "in1", "target": "ai1"}
            ]
        }
    ]

# AI Endpoints (Embedded llama.cpp Engine)
@app.get("/api/ai/status")
async def get_ai_status():
    """Returns embedded llama.cpp engine status and local GGUF model information."""
    return await llm_service.get_engine_status()

@app.post("/api/ai/pull")
async def pull_ai_model(payload: dict = Body({})):
    """Downloads Gemma-4-E4B Q4 GGUF directly to local models folder."""
    return await llm_service.download_model()

@app.post("/api/ai/launch")
async def launch_ai_daemon():
    """Loads embedded llama.cpp runtime into memory."""
    return await llm_service.load_model()

@app.post("/api/ai/upload-rag")
async def upload_rag_file(file: UploadFile = File(...)):
    """Uploads and parses a knowledge file (.md, .txt, .pdf, .docx, .xlsx, .csv) for RAG."""
    contents = await file.read()
    doc_info = parse_document(file.filename or "uploaded_file", contents)
    return doc_info

@app.post("/api/ai/chat")
async def ai_chat(payload: dict = Body(...)):
    """Interactive copilot chat message with optional RAG documents."""
    message = payload.get("message", "")
    graph = payload.get("graph")
    documents = payload.get("documents", [])
    return await llm_service.chat_assistant(message, graph, documents)

@app.post("/api/ai/text-to-graph")
async def ai_text_to_graph(payload: dict = Body(...)):
    """Dual-engine text to graph generator."""
    prompt = payload.get("prompt", "")
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")
    result = await llm_service.text_to_graph(prompt)
    return result

@app.post("/api/ai/reverse-engineer")
async def ai_reverse_engineer(payload: dict = Body(...)):
    """Reverse-engineers legacy Python bot scripts into visual graph."""
    code = payload.get("code", "")
    if not code:
        raise HTTPException(status_code=400, detail="Python code is required")
    result = await llm_service.reverse_engineer_code(code)
    return result

@app.post("/api/ai/magic-pen")
async def ai_magic_pen(payload: dict = Body(...)):
    """UX Copywriting assistant inside node inputs."""
    text = payload.get("text", "")
    action = payload.get("action", "friendly")
    new_text = await llm_service.magic_pen(text, action)
    return {"result": new_text}

# Live Runner Endpoints
@app.post("/api/live/start")
async def start_live_runner(payload: dict = Body(...)):
    token = payload.get("token", "")
    graph_data = payload.get("graph")
    if not token or not graph_data:
        raise HTTPException(status_code=400, detail="Token and GraphSchema are required")
    
    graph = GraphSchema(**graph_data)
    try:
        await live_bot_runner.start(token, graph)
        return {"status": "started", "info": live_bot_runner.get_status()}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/live/stop")
async def stop_live_runner():
    await live_bot_runner.stop()
    return {"status": "stopped"}

@app.get("/api/live/status")
async def get_live_runner_status():
    return live_bot_runner.get_status()

# Static distribution mounting for single-page app
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = FRONTEND_DIST / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIST / "index.html")
