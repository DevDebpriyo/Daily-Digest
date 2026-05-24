/**
 * Schema type definitions mirroring the SQLite tables.
 * Used across the application for type safety.
 */

export interface User {
  id: string;
  telegram_chat_id: string;
  created_at: string;
}

export interface GmailAccount {
  id: string;
  user_id: string;
  email: string;
  refresh_token: string;
  created_at: string;
}

export interface DigestRun {
  id: string;
  user_id: string | null;
  executed_at: string;
  status: 'success' | 'partial' | 'failure';
  details: string | null;
}
