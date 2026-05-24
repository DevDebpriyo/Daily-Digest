# Daily Gmail Digest - Implementation Details

## Tech Stack
- **Backend**: Node.js, TypeScript
- **APIs**: Google Gmail API (`googleapis`), Telegram Bot API (`node-telegram-bot-api` or `fetch`)
- **Scheduler**: `node-cron`
- **Database**: SQLite (local/initial), extensible to PostgreSQL.

## Folder Structure
```txt
src/
├── auth/          # Google OAuth flows
├── gmail/         # Fetching emails, API interaction, filtering logic
├── digest/        # Formatter for building the text digest
├── telegram/      # Telegram Bot API interactions
├── scheduler/     # node-cron setup and job definitions
├── db/            # Schema definitions and database client
├── config/        # Environment variable validation
├── utils/         # Helper functions
└── server.ts      # Main entry point
```

## Database Schema (SQLite)
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  telegram_chat_id TEXT,
  created_at TIMESTAMP
);

CREATE TABLE gmail_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  email TEXT,
  refresh_token TEXT,
  created_at TIMESTAMP
);

CREATE TABLE digest_runs (
  id TEXT PRIMARY KEY,
  executed_at TIMESTAMP,
  status TEXT
);
```

## Environment Variables
```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=your_redirect_uri
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
DATABASE_URL=file:./dev.db
```

## Deployment
- **Hosting**: Requires 24/7 uptime for cron jobs. Recommended: Railway, Render, VPS, or Fly.io.
- **Security**: Store all secrets in encrypted environment variables. Never expose refresh tokens to the frontend.

## Error Handling Strategies
- **Gmail Auth Failure**: Skip the failed account, process remaining, and notify the user in the digest.
- **Telegram Failure**: Retry delivery once, log the failure locally.
- **Empty Inbox**: Send a minimal "No new emails found today" digest to confirm the system is running.
