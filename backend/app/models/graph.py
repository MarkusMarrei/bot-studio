from __future__ import annotations
from typing import List, Dict, Optional, Any, Literal
from pydantic import BaseModel, Field

NodeType = Literal[
    "start",
    "message",
    "keyboard",
    "timer",
    "media",
    "input",
    "ai_assistant",
    "sheets",
    "notify_admin",
    "custom_code"
]

class ButtonItem(BaseModel):
    id: str
    text: str
    action_type: Literal["callback", "url"] = "callback"
    target_handle: Optional[str] = None  # Handle ID on the node (e.g., "btn_0")
    url: Optional[str] = None

class NodePosition(BaseModel):
    x: float = 0.0
    y: float = 0.0

class NodeData(BaseModel):
    label: Optional[str] = None
    
    # Start Node
    command: Optional[str] = "/start"
    description: Optional[str] = "Entry point for /start"
    
    # Message Node
    text: Optional[str] = "Hello! Welcome to the bot."
    text_key: Optional[str] = None  # Key for texts.yaml
    buttons: List[ButtonItem] = Field(default_factory=list)
    image_path: Optional[str] = None
    parse_mode: Literal["HTML", "MarkdownV2", "plain"] = "HTML"
    
    # Wait Input Node
    variable_name: Optional[str] = "user_input"
    input_type: Literal["text", "number", "phone", "email"] = "text"
    validation_error_text: Optional[str] = "Please enter a valid value."
    
    # AI Node (API Integration)
    ai_provider: Literal["ollama", "openai", "groq", "openrouter", "custom"] = "openai"
    ai_base_url: Optional[str] = "https://api.openai.com/v1"
    ai_model: Optional[str] = "gpt-4o-mini"
    ai_api_key: Optional[str] = ""
    ai_system_prompt: Optional[str] = "You are a helpful and smart AI assistant in Telegram."
    ai_welcome_text: Optional[str] = "👋 Здравствуйте! Я ИИ-ассистент. Чем я могу вам помочь? Напишите ваш вопрос прямо в чат."
    ai_limit_text: Optional[str] = "⚠️ Вы достигли лимита бесплатных сообщений к ИИ-ассистенту. Пожалуйста, обратитесь к администратору или вернитесь в главное меню."
    ai_user_prompt: Optional[str] = "{user_input}"
    ai_output_var: Optional[str] = "ai_reply"
    ai_limit_type: Optional[Literal["none", "total", "per_hour"]] = "per_hour"
    ai_limit_count: Optional[int] = 15
    ai_limit_message: Optional[str] = "⚠️ Вы достигли лимита бесплатных сообщений к ИИ-ассистенту. Пожалуйста, обратитесь к администратору или вернитесь в главное меню."
    
    # Sheets / Table Node
    storage_type: Literal["csv", "sqlite", "google_sheets"] = "csv"
    table_name: Optional[str] = "leads"
    column_mapping: Dict[str, str] = Field(default_factory=lambda: {
        "user_id": "{user_id}",
        "username": "@{username}",
        "name": "{user_name}",
        "phone": "{user_phone}",
        "created_at": "{timestamp}"
    })
    
    # Notify Admin Node
    admin_id: Optional[str] = "YOUR_ADMIN_ID"
    notification_template: Optional[str] = "🔔 New lead from @{username}: {user_input}"
    
    # Custom Python Code Node
    code: Optional[str] = "# Custom Python logic\nasync def custom_step(message, state):\n    pass"
    review_status: Literal["verified", "needs_review"] = "verified"

    # Timer Node
    timer_mode: Optional[Literal["inactivity", "after", "date"]] = "after"
    timer_days: Optional[int] = 0
    timer_hours: Optional[int] = 0
    timer_minutes: Optional[int] = 0
    timer_seconds: Optional[int] = 0
    timer_date: Optional[str] = None
    timer_text: Optional[str] = None

    # Keyboard / Reply Menu Node
    one_time_keyboard: Optional[bool] = False
    resize_keyboard: Optional[bool] = True

    # Multimedia Node
    media_type: Optional[Literal["photo", "video", "audio"]] = "photo"
    media_source: Optional[Literal["url", "upload"]] = "url"
    media_url: Optional[str] = None
    media_file_name: Optional[str] = None
    caption: Optional[str] = None

class NodeModel(BaseModel):
    id: str
    type: NodeType
    position: NodePosition = Field(default_factory=NodePosition)
    data: NodeData = Field(default_factory=NodeData)

class EdgeModel(BaseModel):
    id: str
    source: str
    target: str
    sourceHandle: Optional[str] = None
    targetHandle: Optional[str] = None
    animated: Optional[bool] = False

class GraphMetadata(BaseModel):
    name: str = "MyTelegramBot"
    version: str = "1.0.0"
    author: Optional[str] = "Bot Studio User"
    bot_token: Optional[str] = None
    description: Optional[str] = "Telegram bot generated with Bot Studio IDE"

class GraphSchema(BaseModel):
    nodes: List[NodeModel] = Field(default_factory=list)
    edges: List[EdgeModel] = Field(default_factory=list)
    metadata: GraphMetadata = Field(default_factory=GraphMetadata)

class AuditIssue(BaseModel):
    severity: Literal["error", "warning", "info"]
    node_id: Optional[str] = None
    title: str
    message: str

class AuditReport(BaseModel):
    is_valid: bool
    maturity_score: int  # 0 to 100%
    issues: List[AuditIssue] = Field(default_factory=list)
