/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { swaggerUI } from '@hono/swagger-ui';
import { getDB } from './db';
import { registerUser, loginUser, verifyJWT } from './auth';
import { Task } from './types';

const app = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET: string }, Variables: { user: { userId: number; username: string } } }>();

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

// Tasks routes
app.get('/api/tasks', async (c) => {
  const user = c.get('user') as { userId: number };
  const db = getDB(c.env);
  const tasks = await db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC').bind(user.userId).all<Task>();
  return c.json(tasks.results);
});

app.post('/api/tasks', async (c) => {
  const user = c.get('user') as { userId: number };
  const { title, description }: { title: string; description?: string } = await c.req.json();
  if (!title) {
    return c.json({ error: 'Title required' }, 400);
  }
  const db = getDB(c.env);
  const result = await db.prepare(
    'INSERT INTO tasks (user_id, title, description) VALUES (?, ?, ?) RETURNING *'
  ).bind(user.userId, title, description || '').first<Task>();
  return c.json(result);
});

app.put('/api/tasks/:id', async (c) => {
  const user = c.get('user') as { userId: number };
  const id = parseInt(c.req.param('id'));
  const { title, description, completed }: { title?: string; description?: string; completed?: boolean } = await c.req.json();
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
  return c.json(result);
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
    description: 'API for TodoList app with authentication'
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
                      completed: { type: 'boolean' }
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
                  description: { type: 'string' }
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
                  completed: { type: 'boolean' }
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