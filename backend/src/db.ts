import { D1Database } from '@cloudflare/workers-types';

export function getDB(env: { DB: D1Database }): D1Database {
  return env.DB;
}