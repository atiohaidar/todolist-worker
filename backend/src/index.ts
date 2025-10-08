/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { swaggerUI } from '@hono/swagger-ui';
import { getDB } from './db';
import { registerUser, loginUser, verifyJWT } from './auth';
import { Task, TaskResponse } from './types';

const app = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string; KV: KVNamespace }, Variables: { user: { userId: number; username: string } } }>();

app.use('*', cors());

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

export default app;