import Database from 'better-sqlite3';
import path from 'path';
import { logger } from '../utils/logger';

const AGENT = 'Database';

/**
 * Resolves the database file path from the DATABASE_URL env var.
 * Supports the `file:./path` syntax used by Prisma and friends.
 */
function resolveDatabasePath(): string {
  const raw = process.env.DATABASE_URL || 'file:./dev.db';
  const filePath = raw.replace(/^file:/, '');
  return path.resolve(process.cwd(), filePath);
}

let db: Database.Database | null = null;

/**
 * Returns a singleton SQLite database connection.
 * Creates the database file and initializes the schema on first call.
 */
export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = resolveDatabasePath();
    logger.info(AGENT, `Opening database at: ${dbPath}`);
    db = new Database(dbPath);

    // Enable WAL mode for better concurrent read performance
    db.pragma('journal_mode = WAL');

    initializeSchema(db);
    logger.info(AGENT, 'Database initialized successfully.');
  }
  return db;
}

/**
 * Closes the database connection gracefully.
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    logger.info(AGENT, 'Database connection closed.');
  }
}

/**
 * Creates the initial schema if the tables do not exist yet.
 */
function initializeSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      telegram_chat_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS gmail_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS digest_runs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      executed_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL,
      details TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
}
