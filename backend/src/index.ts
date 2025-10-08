/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { swaggerUI } from '@hono/swagger-ui';
import { getDB } from './db';
import { registerUser, loginUser, verifyJWT, hashPassword } from './auth';
import { Task, TaskResponse, AnonymousList, AnonymousTask, AnonymousTaskResponse } from './types';

const app = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string; KV: KVNamespace }, Variables: { user: { userId: number; username: string } } }>();

app.use('*', cors());

app.get('/init-anonymous-db', async (c) => {
  try {
    const db = getDB(c.env);

    // Create anonymous lists table
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS anonymous_lists (
        id TEXT PRIMARY KEY,
        list_name TEXT DEFAULT 'Untitled List',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // Create anonymous tasks table
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS anonymous_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        list_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        completed BOOLEAN DEFAULT FALSE,
        attachments TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (list_id) REFERENCES anonymous_lists(id) ON DELETE CASCADE
      )
    `).run();

    // Create indexes
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_anonymous_tasks_list ON anonymous_tasks(list_id)').run();
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_anonymous_lists_updated ON anonymous_lists(updated_at)').run();

    return c.json({ message: 'Anonymous database initialized successfully' });
  } catch (error) {
    return c.json({ error: 'Failed to initialize anonymous database', details: (error as Error).message }, 500);
  }
});

app.get('/migrate-anonymous-db', async (c) => {
  try {
    const db = getDB(c.env);

    // Check if old tables exist
    const oldWebhookTable = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='anonymous_webhooks'").first();
    const oldTaskTable = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='anonymous_tasks'").first();

    if (!oldWebhookTable) {
      return c.json({ message: 'No old tables to migrate' });
    }

    // Migrate webhooks to lists
    await db.prepare(`
      INSERT OR IGNORE INTO anonymous_lists (id, list_name, created_at, updated_at)
      SELECT id, list_name, created_at, updated_at FROM anonymous_webhooks
    `).run();

    // Migrate tasks (if webhook_id column exists)
    const taskColumns = await db.prepare("PRAGMA table_info(anonymous_tasks)").all();
    const hasWebhookId = taskColumns.results.some(col => col.name === 'webhook_id');

    if (hasWebhookId) {
      // Add list_id column if it doesn't exist
      await db.prepare('ALTER TABLE anonymous_tasks ADD COLUMN list_id TEXT').run().catch(() => { });

      // Copy data from webhook_id to list_id
      await db.prepare('UPDATE anonymous_tasks SET list_id = webhook_id WHERE list_id IS NULL').run();

      // Drop old webhook_id column
      await db.prepare('ALTER TABLE anonymous_tasks DROP COLUMN webhook_id').run().catch(() => { });
    }

    // Update foreign key constraint
    await db.prepare('DROP TABLE IF EXISTS anonymous_webhooks').run();

    return c.json({ message: 'Migration completed successfully' });
  } catch (error) {
    return c.json({ error: 'Migration failed', details: (error as Error).message }, 500);
  }
});

app.use('/api/tasks/*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const token = authHeader.substring(7);
  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: 'Invalid token' }, 401);
  }
  c.set('user', payload);
  await next();
});

// Auth routes
app.post('/api/auth/register', async (c) => {
  const { username, password }: { username: string; password: string } = await c.req.json();
  if (!username || !password || password.length < 6) {
    return c.json({ error: 'Invalid input' }, 400);
  }
  const user = await registerUser(c.env, username, password);
  if (!user) {
    return c.json({ error: 'Username already exists' }, 409);
  }
  const token = await loginUser(c.env, username, password);
  return c.json(token);
});

app.post('/api/auth/login', async (c) => {
  const { username, password }: { username: string; password: string } = await c.req.json();
  const result = await loginUser(c.env, username, password);
  if (!result) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }
  return c.json(result);
});

app.post('/api/auth/logout', (c) => {
  return c.json({ message: 'Logged out' });
});

// File upload route
app.post('/api/upload', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const token = authHeader.substring(7);
  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  const formData = await c.req.formData();
  const file = formData.get('file') as File;
  if (!file) {
    return c.json({ error: 'No file provided' }, 400);
  }

  // Generate unique key
  const key = `${payload.userId}/${Date.now()}-${file.name}`;

  // Upload to KV
  const arrayBuffer = await file.arrayBuffer();
  await c.env.KV.put(key, arrayBuffer);

  return c.json({
    key,
    filename: file.name,
    size: file.size,
    type: file.type
  });
});

// File download route
app.get('/api/files/:key', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const token = authHeader.substring(7);
  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  const key = c.req.param('key');
  // Verify user owns this file (key starts with userId/)
  if (!key.startsWith(`${payload.userId}/`)) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const file = await c.env.KV.get(key, 'arrayBuffer');
  if (!file) {
    return c.json({ error: 'File not found' }, 404);
  }

  // Get metadata from key (filename after timestamp-)
  const filename = key.split('-').slice(1).join('-');

  return new Response(file, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
});

// Tasks routes
app.get('/api/tasks', async (c) => {
  const user = c.get('user') as { userId: number };
  const db = getDB(c.env);
  const tasks = await db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC').bind(user.userId).all<Task>();
  // Parse attachments JSON strings to arrays
  const parsedTasks: TaskResponse[] = tasks.results.map(task => ({
    ...task,
    attachments: task.attachments ? JSON.parse(task.attachments) : []
  }));
  return c.json(parsedTasks);
});

app.post('/api/tasks', async (c) => {
  const user = c.get('user') as { userId: number };
  const { title, description, attachments }: { title: string; description?: string; attachments?: string[] } = await c.req.json();
  if (!title) {
    return c.json({ error: 'Title required' }, 400);
  }
  const db = getDB(c.env);
  const result = await db.prepare(
    'INSERT INTO tasks (user_id, title, description, attachments) VALUES (?, ?, ?, ?) RETURNING *'
  ).bind(user.userId, title, description || '', JSON.stringify(attachments || [])).first<Task>();
  if (!result) {
    return c.json({ error: 'Failed to create task' }, 500);
  }
  const response: TaskResponse = {
    ...result,
    attachments: result.attachments ? JSON.parse(result.attachments) : []
  };
  return c.json(response);
});

app.put('/api/tasks/:id', async (c) => {
  const user = c.get('user') as { userId: number };
  const id = parseInt(c.req.param('id'));
  const { title, description, completed, attachments }: { title?: string; description?: string; completed?: boolean; attachments?: string[] } = await c.req.json();
  const db = getDB(c.env);
  const updates = [];
  const values = [];
  if (title !== undefined) {
    updates.push('title = ?');
    values.push(title);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }
  if (completed !== undefined) {
    updates.push('completed = ?');
    values.push(completed ? 1 : 0);
  }
  if (attachments !== undefined) {
    updates.push('attachments = ?');
    values.push(JSON.stringify(attachments));
  }
  if (updates.length === 0) {
    return c.json({ error: 'No updates provided' }, 400);
  }
  values.push(id, user.userId);
  const result = await db.prepare(
    `UPDATE tasks SET ${updates.join(', ')} WHERE id = ? AND user_id = ? RETURNING *`
  ).bind(...values).first<Task>();
  if (!result) {
    return c.json({ error: 'Task not found' }, 404);
  }
  const response: TaskResponse = {
    ...result,
    attachments: result.attachments ? JSON.parse(result.attachments) : []
  };
  return c.json(response);
});

app.delete('/api/tasks/:id', async (c) => {
  const user = c.get('user') as { userId: number };
  const id = parseInt(c.req.param('id'));
  const db = getDB(c.env);
  const result = await db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ? RETURNING *').bind(id, user.userId).first<Task>();
  if (!result) {
    return c.json({ error: 'Task not found' }, 404);
  }
  return c.json({ message: 'Deleted' });
});

const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'TodoList API',
    version: '1.0.0',
    description: 'API for TodoList app with authentication and file attachments'
  },
  servers: [
    {
      url: 'https://todolist-worker.atiohaidar.workers.dev',
      description: 'Production server'
    }
  ],
  paths: {
    '/api/auth/register': {
      post: {
        summary: 'Register new user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  username: { type: 'string' },
                  password: { type: 'string', minLength: 6 }
                },
                required: ['username', 'password']
              }
            }
          }
        },
        responses: {
          200: { description: 'User registered successfully' },
          409: { description: 'Username already exists' },
          400: { description: 'Invalid input' }
        }
      }
    },
    '/api/auth/login': {
      post: {
        summary: 'Login user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  username: { type: 'string' },
                  password: { type: 'string' }
                },
                required: ['username', 'password']
              }
            }
          }
        },
        responses: {
          200: { description: 'Login successful' },
          401: { description: 'Invalid credentials' }
        }
      }
    },
    '/api/auth/logout': {
      post: {
        summary: 'Logout user',
        responses: {
          200: { description: 'Logged out' }
        }
      }
    },
    '/api/upload': {
      post: {
        summary: 'Upload file attachment',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'File to upload'
                  }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'File uploaded successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    key: { type: 'string' },
                    filename: { type: 'string' },
                    size: { type: 'integer' },
                    type: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/files/{key}': {
      get: {
        summary: 'Download file attachment',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'key',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'File key'
          }
        ],
        responses: {
          200: { description: 'File downloaded' },
          404: { description: 'File not found' }
        }
      }
    },
    '/api/tasks': {
      get: {
        summary: 'Get user tasks',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'List of tasks',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'integer' },
                      title: { type: 'string' },
                      description: { type: 'string' },
                      completed: { type: 'boolean' },
                      attachments: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Array of file keys'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        summary: 'Create new task',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  attachments: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of file keys'
                  }
                },
                required: ['title']
              }
            }
          }
        },
        responses: {
          200: { description: 'Task created' }
        }
      }
    },
    '/api/tasks/{id}': {
      put: {
        summary: 'Update task',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  completed: { type: 'boolean' },
                  attachments: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of file keys'
                  }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Task updated' }
        }
      },
      delete: {
        summary: 'Delete task',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' }
          }
        ],
        responses: {
          200: { description: 'Task deleted' }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    }
  }
};

app.get('/spec', (c) => c.json(swaggerSpec));

app.get('/', swaggerUI({ url: '/spec' }));

// Anonymous list endpoints (no authentication required - HTTP polling based)
app.post('/api/anonymous/lists', async (c) => {
  const { list_name }: { list_name?: string } = await c.req.json().catch(() => ({}));

  // Generate unique list ID
  const listId = crypto.randomUUID();

  const db = getDB(c.env);
  const result = await db.prepare(
    'INSERT INTO anonymous_lists (id, list_name) VALUES (?, ?) RETURNING *'
  ).bind(listId, list_name || 'Untitled List').first<AnonymousList>();

  if (!result) {
    return c.json({ error: 'Failed to create list' }, 500);
  }

  return c.json({
    listId: result.id,
    list_name: result.list_name,
    share_url: `${new URL(c.req.url).origin}/public/${result.id}`
  });
});

app.get('/api/anonymous/lists/:listId', async (c) => {
  const listId = c.req.param('listId');
  const db = getDB(c.env);

  const list = await db.prepare('SELECT * FROM anonymous_lists WHERE id = ?').bind(listId).first<AnonymousList>();
  if (!list) {
    return c.json({ error: 'List not found' }, 404);
  }

  return c.json({
    id: list.id,
    list_name: list.list_name,
    created_at: list.created_at,
    updated_at: list.updated_at
  });
});

app.get('/api/anonymous/tasks/:listId', async (c) => {
  const listId = c.req.param('listId');
  const db = getDB(c.env);

  // Verify list exists
  const list = await db.prepare('SELECT id FROM anonymous_lists WHERE id = ?').bind(listId).first();
  if (!list) {
    return c.json({ error: 'List not found' }, 404);
  }

  const tasks = await db.prepare('SELECT * FROM anonymous_tasks WHERE list_id = ? ORDER BY created_at DESC').bind(listId).all<AnonymousTask>();

  // Parse attachments JSON strings to arrays
  const parsedTasks: AnonymousTaskResponse[] = tasks.results.map(task => ({
    ...task,
    attachments: task.attachments ? JSON.parse(task.attachments) : []
  }));

  return c.json(parsedTasks);
});

app.post('/api/anonymous/tasks/:listId', async (c) => {
  const listId = c.req.param('listId');
  const { title, description, attachments }: { title: string; description?: string; attachments?: string[] } = await c.req.json();

  if (!title) {
    return c.json({ error: 'Title required' }, 400);
  }

  const db = getDB(c.env);

  // Verify list exists
  const list = await db.prepare('SELECT id FROM anonymous_lists WHERE id = ?').bind(listId).first();
  if (!list) {
    return c.json({ error: 'List not found' }, 404);
  }

  const result = await db.prepare(
    'INSERT INTO anonymous_tasks (list_id, title, description, attachments) VALUES (?, ?, ?, ?) RETURNING *'
  ).bind(listId, title, description || '', JSON.stringify(attachments || [])).first<AnonymousTask>();

  if (!result) {
    return c.json({ error: 'Failed to create task' }, 500);
  }

  // Update list updated_at
  await db.prepare('UPDATE anonymous_lists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(listId).run();

  const response: AnonymousTaskResponse = {
    ...result,
    attachments: result.attachments ? JSON.parse(result.attachments) : []
  };

  return c.json(response);
});

app.put('/api/anonymous/tasks/:listId/:taskId', async (c) => {
  const listId = c.req.param('listId');
  const taskId = parseInt(c.req.param('taskId'));
  const { title, description, completed, attachments }: { title?: string; description?: string; completed?: boolean; attachments?: string[] } = await c.req.json();

  const db = getDB(c.env);

  // Verify list exists
  const list = await db.prepare('SELECT id FROM anonymous_lists WHERE id = ?').bind(listId).first();
  if (!list) {
    return c.json({ error: 'List not found' }, 404);
  }

  const updates = [];
  const values = [];

  if (title !== undefined) {
    updates.push('title = ?');
    values.push(title);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }
  if (completed !== undefined) {
    updates.push('completed = ?');
    values.push(completed ? 1 : 0);
  }
  if (attachments !== undefined) {
    updates.push('attachments = ?');
    values.push(JSON.stringify(attachments));
  }

  if (updates.length === 0) {
    return c.json({ error: 'No updates provided' }, 400);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(taskId, listId);

  const result = await db.prepare(
    `UPDATE anonymous_tasks SET ${updates.join(', ')} WHERE id = ? AND list_id = ? RETURNING *`
  ).bind(...values).first<AnonymousTask>();

  if (!result) {
    return c.json({ error: 'Task not found' }, 404);
  }

  // Update list updated_at
  await db.prepare('UPDATE anonymous_lists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(listId).run();

  const response: AnonymousTaskResponse = {
    ...result,
    attachments: result.attachments ? JSON.parse(result.attachments) : []
  };

  return c.json(response);
});

app.delete('/api/anonymous/tasks/:listId/:taskId', async (c) => {
  const listId = c.req.param('listId');
  const taskId = parseInt(c.req.param('taskId'));

  const db = getDB(c.env);

  // Verify list exists
  const list = await db.prepare('SELECT id FROM anonymous_lists WHERE id = ?').bind(listId).first();
  if (!list) {
    return c.json({ error: 'List not found' }, 404);
  }

  const result = await db.prepare('DELETE FROM anonymous_tasks WHERE id = ? AND list_id = ? RETURNING *').bind(taskId, listId).first<AnonymousTask>();

  if (!result) {
    return c.json({ error: 'Task not found' }, 404);
  }

  // Update list updated_at
  await db.prepare('UPDATE anonymous_lists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(listId).run();

  return c.json({ message: 'Task deleted' });
});

// Public page route
app.get('/public/:webhookId', async (c) => {
  const webhookId = c.req.param('webhookId');

  // Return HTML page for public anonymous todo list
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Anonymous Todo List</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }

        .header {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }

        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
        }

        .header p {
            opacity: 0.9;
            font-size: 1.1rem;
        }

        .content {
            padding: 30px;
        }

        .task-form {
            margin-bottom: 30px;
            display: flex;
            gap: 10px;
        }

        .task-input {
            flex: 1;
            padding: 15px;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.3s;
        }

        .task-input:focus {
            outline: none;
            border-color: #4facfe;
        }

        .add-btn {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: white;
            border: none;
            padding: 15px 25px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
        }

        .add-btn:hover {
            transform: translateY(-2px);
        }

        .task-list {
            list-style: none;
        }

        .task-item {
            display: flex;
            align-items: center;
            padding: 20px;
            border: 1px solid #e1e5e9;
            border-radius: 8px;
            margin-bottom: 10px;
            background: #fafbfc;
            transition: all 0.3s;
        }

        .task-item.completed {
            background: #f8fff9;
            border-color: #4caf50;
        }

        .task-item.completed .task-title {
            text-decoration: line-through;
            color: #666;
        }

        .checkbox {
            width: 20px;
            height: 20px;
            margin-right: 15px;
            cursor: pointer;
        }

        .task-content {
            flex: 1;
        }

        .task-title {
            font-size: 18px;
            font-weight: 500;
            margin-bottom: 5px;
            color: #333;
        }

        .task-desc {
            color: #666;
            font-size: 14px;
        }

        .task-actions {
            display: flex;
            gap: 10px;
        }

        .edit-btn, .delete-btn {
            padding: 8px 12px;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .edit-btn {
            background: #ffa726;
            color: white;
        }

        .edit-btn:hover {
            background: #fb8c00;
        }

        .delete-btn {
            background: #f44336;
            color: white;
        }

        .delete-btn:hover {
            background: #d32f2f;
        }

        .status {
            text-align: center;
            padding: 20px;
            color: #666;
            font-style: italic;
        }

        .loading {
            text-align: center;
            padding: 40px;
            color: #666;
        }

        .error {
            background: #ffebee;
            color: #c62828;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 4px solid #f44336;
        }

        @media (max-width: 768px) {
            .task-form {
                flex-direction: column;
            }

            .header h1 {
                font-size: 2rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌟 Anonymous Todo List</h1>
            <p>Collaborative task management with real-time polling - Anyone can edit!</p>
        </div>

        <div class="content">
            <div id="error-message" class="error" style="display: none;"></div>

            <form class="task-form" id="task-form">
                <input type="text" class="task-input" id="task-title" placeholder="Add a new task..." required>
                <button type="submit" class="add-btn">Add Task</button>
            </form>

            <div id="loading" class="loading">Loading tasks...</div>

            <ul class="task-list" id="task-list"></ul>

            <div id="status" class="status" style="display: none;"></div>
        </div>
    </div>

    <script>
        const LIST_ID = '${webhookId}';
        const API_BASE = window.location.origin;

        let tasks = [];
        let pollInterval;

        // DOM elements
        const taskForm = document.getElementById('task-form');
        const taskTitle = document.getElementById('task-title');
        const taskList = document.getElementById('task-list');
        const loading = document.getElementById('loading');
        const status = document.getElementById('status');
        const errorMessage = document.getElementById('error-message');

        // Initialize
        async function init() {
            try {
                await loadTasks();
                startPolling();
                status.textContent = 'Connected - Real-time polling enabled';
                status.style.display = 'block';
            } catch (error) {
                showError('Failed to load tasks: ' + error.message);
            }
        }

        // Load tasks
        async function loadTasks() {
            try {
                const response = await fetch(\`\${API_BASE}/api/anonymous/tasks/\${LIST_ID}\`);
                if (!response.ok) {
                    throw new Error('Failed to load tasks');
                }
                tasks = await response.json();
                renderTasks();
                loading.style.display = 'none';
            } catch (error) {
                throw error;
            }
        }

        // Render tasks
        function renderTasks() {
            taskList.innerHTML = '';

            if (tasks.length === 0) {
                const emptyMessage = document.createElement('li');
                emptyMessage.className = 'task-item';
                emptyMessage.innerHTML = '<div class="task-content"><div class="task-title">No tasks yet. Add one above!</div></div>';
                taskList.appendChild(emptyMessage);
                return;
            }

            tasks.forEach(task => {
                const li = document.createElement('li');
                li.className = \`task-item \${task.completed ? 'completed' : ''}\`;

                li.innerHTML = \`
                    <input type="checkbox" class="checkbox" \${task.completed ? 'checked' : ''} onchange="toggleComplete(\${task.id}, this.checked)">
                    <div class="task-content">
                        <div class="task-title">\${escapeHtml(task.title)}</div>
                    </div>
                    <div class="task-actions">
                        <button class="edit-btn" onclick="editTask(\${task.id}, '\${escapeHtml(task.title)}')">Edit</button>
                        <button class="delete-btn" onclick="deleteTask(\${task.id})">Delete</button>
                    </div>
                \`;

                taskList.appendChild(li);
            });
        }

        // Add task
        taskForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = taskTitle.value.trim();
            if (!title) return;

            try {
                const response = await fetch(\`\${API_BASE}/api/anonymous/tasks/\${LIST_ID}\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title })
                });

                if (!response.ok) {
                    throw new Error('Failed to add task');
                }

                taskTitle.value = '';
                await loadTasks(); // Reload to get real-time updates
            } catch (error) {
                showError('Failed to add task: ' + error.message);
            }
        });

        // Toggle complete
        async function toggleComplete(id, completed) {
            try {
                const response = await fetch(\`\${API_BASE}/api/anonymous/tasks/\${LIST_ID}/\${id}\`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ completed })
                });

                if (!response.ok) {
                    throw new Error('Failed to update task');
                }

                await loadTasks(); // Reload to get real-time updates
            } catch (error) {
                showError('Failed to update task: ' + error.message);
            }
        }

        // Edit task
        async function editTask(id, currentTitle) {
            const newTitle = prompt('Edit task:', currentTitle);
            if (newTitle !== null && newTitle.trim() !== '') {
                try {
                    const response = await fetch(\`\${API_BASE}/api/anonymous/tasks/\${LIST_ID}/\${id}\`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: newTitle.trim() })
                    });

                    if (!response.ok) {
                        throw new Error('Failed to edit task');
                    }

                    await loadTasks(); // Reload to get real-time updates
                } catch (error) {
                    showError('Failed to edit task: ' + error.message);
                }
            }
        }

        // Delete task
        async function deleteTask(id) {
            if (confirm('Delete this task?')) {
                try {
                    const response = await fetch(\`\${API_BASE}/api/anonymous/tasks/\${LIST_ID}/\${id}\`, {
                        method: 'DELETE'
                    });

                    if (!response.ok) {
                        throw new Error('Failed to delete task');
                    }

                    await loadTasks(); // Reload to get real-time updates
                } catch (error) {
                    showError('Failed to delete task: ' + error.message);
                }
            }
        }

        // Polling for real-time updates
        function startPolling() {
            pollInterval = setInterval(async () => {
                try {
                    await loadTasks();
                } catch (error) {
                    console.warn('Polling failed:', error);
                }
            }, 3000); // Poll every 3 seconds
        }

        function stopPolling() {
            if (pollInterval) {
                clearInterval(pollInterval);
            }
        }

        // Utility functions
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function showError(message) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
            setTimeout(() => {
                errorMessage.style.display = 'none';
            }, 5000);
        }

        // Cleanup on page unload
        window.addEventListener('beforeunload', stopPolling);

        // Initialize app
        init();
    </script>
</body>
</html>
  `;

  return c.html(html);
});

export default app;