# 📬 Daily Gmail Digest

A lightweight, fully autonomous automation service that connects multiple Gmail accounts, fetches unread emails daily, filters out noise, and delivers a clean aggregated digest to **Telegram** and **Discord** — completely hands-free.

---

## ✨ Features

- **Multi-Account Support** — Connect multiple Gmail accounts via Google OAuth 2.0
- **Daily Automated Digest** — Runs on a configurable cron schedule (default: 6:00 AM daily)
- **Deterministic Filtering** — Strips out promotions, social updates, newsletters, and spam without AI/NLP
- **Dual Delivery** — Sends digest to both Telegram and Discord simultaneously
- **Rich Discord Embeds** — Each account gets a color-coded embed card for instant visual differentiation
- **Telegram HTML Formatting** — Clean, structured digest with emoji and grouped sections
- **Failure Isolation** — If one delivery channel fails, the other still works
- **Retry Logic** — Automatic retry with 3-second delay on delivery failures
- **Manual Trigger** — Run the digest pipeline anytime via a simple API call
- **Run History** — Track past digest executions via the API
- **Graceful Error Handling** — Partial failures, expired tokens, and empty inboxes are all handled cleanly

---

## 🏗️ Architecture

The system operates as **5 autonomous agents** coordinating through a pipeline:

| # | Agent | Role | Module |
|---|-------|------|--------|
| 1 | **Orchestrator** | Timekeeper & process manager | `src/scheduler/cron.ts` |
| 2 | **Fetcher** | Gmail API data retriever | `src/gmail/fetcher.ts` |
| 3 | **Bouncer** | Deterministic noise filter | `src/gmail/filter.ts` |
| 4 | **Editor** | Digest formatter (Telegram + Discord) | `src/digest/formatter.ts` |
| 5 | **Courier** | Delivery to Telegram & Discord | `src/telegram/sender.ts`, `src/discord/sender.ts` |

### Pipeline Flow

```
Cron Trigger (daily)
  → Load Gmail accounts from DB
  → For each account: Authenticate → Fetch unread emails → Filter noise
  → Format digest (Telegram HTML + Discord Embeds)
  → Deliver to Discord
  → Deliver to Telegram
  → Log run result to DB
```

---

## 📁 Project Structure

```
daily-gmail-digest/
├── src/
│   ├── auth/              # Google OAuth 2.0 flows
│   │   ├── oauth.ts       # OAuth client, auth URL, token exchange & refresh
│   │   └── routes.ts      # Express routes: /auth/google, /auth/google/callback
│   ├── config/            # Environment variable validation
│   │   └── index.ts       # Typed config with startup validation
│   ├── db/                # Database layer
│   │   ├── client.ts      # SQLite singleton with auto-schema initialization
│   │   └── schema.ts      # TypeScript type definitions for DB tables
│   ├── digest/            # Digest formatting
│   │   └── formatter.ts   # Telegram (HTML) and Discord (embeds) formatters
│   ├── discord/           # Discord delivery
│   │   └── sender.ts      # Webhook-based delivery with retry & embed batching
│   ├── gmail/             # Gmail integration
│   │   ├── fetcher.ts     # Fetches unread emails via Gmail API
│   │   └── filter.ts      # Deterministic spam/promo filtering
│   ├── scheduler/         # Cron orchestration
│   │   └── cron.ts        # Daily pipeline coordinator
│   ├── telegram/          # Telegram delivery
│   │   └── sender.ts      # Bot API delivery with retry & message chunking
│   ├── utils/             # Shared utilities
│   │   └── logger.ts      # Structured logging with agent tags
│   └── server.ts          # Main entry point (Express + cron startup)
├── docs/                  # Project planning documents
│   ├── AGENTS.md
│   ├── ARCHITECTURE.md
│   ├── IDEA.md
│   ├── IMPLEMENTATION.md
│   └── PLAN.md
├── .env.example           # Template for environment variables
├── .gitignore
├── LICENSE
├── package.json
├── package-lock.json
├── tsconfig.json
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+ (required for native `fetch` support)
- **npm** v8+
- A **Google Cloud Project** with Gmail API enabled
- A **Telegram Bot** (created via [@BotFather](https://t.me/BotFather))
- A **Discord Webhook URL** (optional — created in Discord channel settings)

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/daily-gmail-digest.git
cd daily-gmail-digest
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:

```env
# Google OAuth 2.0 Credentials
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id

# Discord Webhook (optional — skip to disable Discord delivery)
DISCORD_WEBHOOK_URL=your_discord_webhook_url

# Database
DATABASE_URL=file:./dev.db

# Scheduler (cron expression — default: every day at 6:00 AM)
CRON_SCHEDULE=0 6 * * *

# Server
PORT=3000
```

### 4. Build & Start

```bash
# Build TypeScript → JavaScript
npm run build

# Start the production server
npm start
```

Or run directly in development mode:

```bash
npm run dev
```

### 5. Connect Gmail Accounts

1. Open your browser and navigate to: `http://localhost:3000/auth/google`
2. Sign in with your Google account and grant **Gmail read-only** access
3. You'll receive a confirmation with the connected email address
4. Repeat for each Gmail account you want to monitor

---

## 🔑 Setup Guides

### Google Cloud Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Enable the **Gmail API** under **APIs & Services → Library**
4. Go to **APIs & Services → Credentials**
5. Click **Create Credentials → OAuth 2.0 Client ID**
6. Set **Application type** to **Web application**
7. Add `http://localhost:3000/auth/google/callback` as an **Authorized redirect URI**
8. Copy the **Client ID** and **Client Secret** into your `.env` file

### Telegram Bot Setup

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts to create your bot
3. Copy the **bot token** into your `.env` as `TELEGRAM_BOT_TOKEN`
4. To get your **Chat ID**:
   - Message your bot, then visit: `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
   - Find the `chat.id` value in the response
5. Copy the **chat ID** into your `.env` as `TELEGRAM_CHAT_ID`

### Discord Webhook Setup

1. Open **Discord** and go to the channel where you want digests delivered
2. Click the **gear icon** (Edit Channel) → **Integrations** → **Webhooks**
3. Click **New Webhook**, name it (e.g., "Daily Digest"), and copy the **Webhook URL**
4. Paste the URL into your `.env` as `DISCORD_WEBHOOK_URL`

> **Note:** Discord delivery is optional. If `DISCORD_WEBHOOK_URL` is not set, the system will skip Discord and still deliver to Telegram.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check — returns service status |
| `GET` | `/auth/google` | Initiates Google OAuth flow (redirects to Google) |
| `GET` | `/auth/google/callback` | OAuth callback — exchanges code for tokens |
| `GET` | `/auth/accounts` | Lists all connected Gmail accounts |
| `DELETE` | `/auth/accounts/:id` | Removes a connected Gmail account |
| `POST` | `/digest/run` | Manually triggers the digest pipeline |
| `GET` | `/digest/history` | Returns the last 20 digest run records |

### Quick Manual Test

```bash
# Trigger a digest run manually
curl -X POST http://localhost:3000/digest/run

# Check run history
curl http://localhost:3000/digest/history

# List connected accounts
curl http://localhost:3000/auth/accounts
```

---

## 🗃️ Database

SQLite is used for local persistence with the following tables:

| Table | Purpose |
|-------|---------|
| `users` | User records with Telegram chat IDs |
| `gmail_accounts` | Connected Gmail accounts with encrypted refresh tokens |
| `digest_runs` | Audit log of every pipeline execution (time, status, details) |

The database file is created automatically on first startup.

---

## 🔧 Configuration

### Cron Schedule

The `CRON_SCHEDULE` environment variable accepts standard cron expressions:

| Expression | Schedule |
|------------|----------|
| `0 6 * * *` | Every day at 6:00 AM (default) |
| `0 8 * * *` | Every day at 8:00 AM |
| `0 */6 * * *` | Every 6 hours |
| `*/30 * * * *` | Every 30 minutes (for testing) |

### Filtering Rules

The Bouncer agent filters emails using deterministic rules — no AI required:

1. **Gmail Categories** — Excludes `CATEGORY_PROMOTIONS`, `CATEGORY_SOCIAL`, `CATEGORY_FORUMS`
2. **Label IDs** — Excludes `SPAM` and `TRASH`
3. **Keyword Patterns** — Filters senders/subjects containing: `unsubscribe`, `no-reply`, `noreply`, `newsletter`, `notification@`, `updates@`, `marketing@`, `promo@`, `bulk@`, `mailer-daemon`

---

## ⚠️ Error Handling

| Scenario | Behavior |
|----------|----------|
| Gmail auth failure for one account | Skips the failed account, processes remaining, notes error in digest |
| All Gmail accounts fail | Sends a failure notification to Telegram & Discord |
| Telegram delivery fails | Retries once after 3 seconds; logs failure if retry also fails |
| Discord delivery fails | Retries once after 3 seconds; logged only, never crashes pipeline |
| Empty inbox (no new emails) | Sends a "No new emails today" confirmation digest |
| Missing Discord webhook | Silently skips Discord delivery, Telegram still works |
| Long message exceeds limits | Telegram: auto-splits at 4096 chars; Discord: batches at 10 embeds |

---

## 🚢 Deployment

This service requires **24/7 uptime** for the cron scheduler. Recommended platforms:

- [Railway](https://railway.app/)
- [Render](https://render.com/)
- [Fly.io](https://fly.io/)
- Any VPS (e.g., DigitalOcean, Linode, Hetzner)

### Deploy Checklist

1. Set all environment variables on your hosting platform
2. Ensure Node.js v18+ is available
3. Run `npm install && npm run build`
4. Start with `npm start`
5. Verify health: `curl https://your-domain.com/`

> **Security Reminder:** Never commit your `.env` file. All secrets should be configured via your hosting platform's environment variable management.

---

## 🛡️ Security

- **OAuth Tokens** — Refresh tokens are stored in the SQLite database on the server; never exposed to any frontend
- **Secrets** — All credentials live in `.env` which is excluded from version control via `.gitignore`
- **Gmail Scope** — Only `gmail.readonly` is requested — the app cannot send, delete, or modify emails
- **No External Dependencies for HTTP** — Telegram and Discord delivery use native `fetch` — no third-party HTTP libraries

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).
