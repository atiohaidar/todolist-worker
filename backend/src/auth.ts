import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { getDB } from './db';
import { User, AuthRequest, AuthResponse } from './types';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function generateJWT(user: User, secret: string): Promise<string> {
  const jwt = new SignJWT({ userId: user.id, username: user.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h');
  return jwt.sign(new TextEncoder().encode(secret));
}

export async function verifyJWT(token: string, secret: string): Promise<{ userId: number; username: string } | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return { userId: payload.userId as number, username: payload.username as string };
  } catch {
    return null;
  }
}

export async function registerUser(env: any, username: string, password: string): Promise<User | null> {
  const db = getDB(env);
  const passwordHash = await hashPassword(password);
  const result = await db.prepare(
    'INSERT INTO users (username, password_hash) VALUES (?, ?) RETURNING *'
  ).bind(username, passwordHash).first<User>();
  return result || null;
}

export async function loginUser(env: any, username: string, password: string): Promise<AuthResponse | null> {
  const db = getDB(env);
  const user = await db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first<User>();
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return null;
  }
  const token = await generateJWT(user, env.JWT_SECRET);
  return { token, user: { id: user.id, username: user.username } };
}