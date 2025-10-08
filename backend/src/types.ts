export interface User {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
}

export interface Task {
  id: number;
  user_id: number;
  title: string;
  description?: string;
  completed: boolean;
  created_at: string;
  attachments: string; // JSON string in database
}

export interface TaskResponse {
  id: number;
  user_id: number;
  title: string;
  description?: string;
  completed: boolean;
  created_at: string;
  attachments: string[]; // Array of KV keys
}

// Anonymous list types (for HTTP polling-based collaborative editing)
export interface AnonymousList {
  id: string;
  list_name: string;
  created_at: string;
  updated_at: string;
}

export interface AnonymousTask {
  id: number;
  list_id: string;
  title: string;
  description?: string;
  completed: boolean;
  attachments: string; // JSON string in database
  created_at: string;
  updated_at: string;
}

export interface AnonymousTaskResponse {
  id: number;
  list_id: string;
  title: string;
  description?: string;
  completed: boolean;
  attachments: string[]; // Array of KV keys
  created_at: string;
  updated_at: string;
}

export interface AuthRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: number;
    username: string;
  };
}

export interface Attachment {
  key: string;
  filename: string;
  size: number;
  type: string;
}