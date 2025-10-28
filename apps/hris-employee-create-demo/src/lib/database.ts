import sqlite3 from 'sqlite3';
import { join } from 'path';
import { promisify } from 'util';

const dbPath = join(process.cwd(), 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Promisify database methods for easier async/await usage
const dbRun = promisify(db.run.bind(db)) as (sql: string, ...params: any[]) => Promise<any>;
const dbGet = promisify(db.get.bind(db)) as (sql: string, ...params: any[]) => Promise<any>;
const dbAll = promisify(db.all.bind(db)) as (sql: string, ...params: any[]) => Promise<any>;

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Create tables
const createTables = async () => {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS integrations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider_key TEXT NOT NULL,
      provider_name TEXT NOT NULL,
      account_id TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      integration_id TEXT,
      operation TEXT NOT NULL,
      status TEXT NOT NULL,
      request_data TEXT,
      response_data TEXT,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (integration_id) REFERENCES integrations (id) ON DELETE SET NULL
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Insert demo user
  await dbRun(`
    INSERT OR IGNORE INTO users (id, username, password) 
    VALUES (?, ?, ?)
  `, ['demo-user-id', 'demo-user', 'demo']);
};

// Initialize database
createTables().catch(console.error);

// Export database methods
export const dbMethods = {
  run: dbRun,
  get: dbGet,
  all: dbAll
};

export default db;
