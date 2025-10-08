-- Anonymous lists table (for HTTP polling-based collaborative editing)
CREATE TABLE anonymous_lists (
  id TEXT PRIMARY KEY,
  list_name TEXT DEFAULT 'Untitled List',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Anonymous tasks table (separate from authenticated tasks)
CREATE TABLE anonymous_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT FALSE,
  attachments TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (list_id) REFERENCES anonymous_lists(id) ON DELETE CASCADE
);

-- Index for faster queries
CREATE INDEX idx_anonymous_tasks_list ON anonymous_tasks(list_id);
CREATE INDEX idx_anonymous_lists_updated ON anonymous_lists(updated_at);