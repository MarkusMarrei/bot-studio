export type NodeType =
  | 'start'
  | 'message'
  | 'keyboard'
  | 'timer'
  | 'media'
  | 'ai_assistant'
  | 'notify_admin'
  | 'custom_code'
  | 'input'
  | 'sheets';

export interface ButtonItem {
  id: string;
  text: string;
  action_type: 'callback' | 'url';
  target_handle?: string;
  url?: string;
}

export interface NodeData extends Record<string, unknown> {
  label?: string;
  command?: string;
  description?: string;
  text?: string;
  text_key?: string;
  buttons?: ButtonItem[];
  image_path?: string;
  parse_mode?: 'HTML' | 'MarkdownV2' | 'plain';
  variable_name?: string;
  input_type?: 'text' | 'number' | 'phone' | 'email';
  validation_error_text?: string;
  ai_provider?: 'ollama' | 'openai' | 'groq' | 'openrouter' | 'custom';
  ai_base_url?: string;
  ai_model?: string;
  ai_api_key?: string;
  ai_system_prompt?: string;
  ai_welcome_text?: string;
  ai_limit_text?: string;
  ai_user_prompt?: string;
  ai_output_var?: string;
  ai_limit_type?: 'none' | 'total' | 'per_hour';
  ai_limit_count?: number;
  ai_limit_message?: string;
  storage_type?: 'csv' | 'sqlite' | 'google_sheets';
  table_name?: string;
  column_mapping?: Record<string, string>;
  admin_id?: string;
  notification_template?: string;
  code?: string;
  review_status?: 'verified' | 'needs_review';
  // Timer Node
  timer_mode?: 'inactivity' | 'after' | 'date';
  timer_days?: number;
  timer_hours?: number;
  timer_minutes?: number;
  timer_seconds?: number;
  timer_date?: string;
  timer_text?: string;
  // Keyboard / Reply Menu Node
  one_time_keyboard?: boolean;
  resize_keyboard?: boolean;
  // Multimedia Node
  media_type?: 'photo' | 'video' | 'audio';
  media_source?: 'url' | 'upload';
  media_url?: string;
  media_file_name?: string;
  caption?: string;
}

export interface AuditIssue {
  severity: 'error' | 'warning' | 'info';
  node_id?: string;
  title: string;
  message: string;
}

export interface AuditReport {
  is_valid: boolean;
  maturity_score: number;
  issues: AuditIssue[];
}

export interface GraphMetadata {
  name: string;
  version: string;
  author?: string;
  bot_token?: string;
  description?: string;
}
