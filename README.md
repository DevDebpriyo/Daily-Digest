# 📬 Daily Gmail Digest

A lightweight, fully autonomous automation service that connects multiple Gmail accounts, fetches unread emails daily, filters out noise, and delivers a clean aggregated digest to **Telegram** and **Discord** — completely hands-free.

Deployed on **Render** with **MongoDB Atlas** for persistent cloud storage and **cron-job.org** for external scheduling.

---

## ✨ Features

- **Multi-Account Support** — Connect multiple Gmail accounts via Google OAuth 2.0
- **Daily Automated Digest** — Runs via external cron (production) or internal scheduler (development)
- **Deterministic Filtering** — Strips out promotions, social updates, newsletters, and spam without AI/NLP
- **Dual Delivery** — Sends digest to both Telegram and Discord simultaneously
- **Rich Discord Embeds** — Each account gets a color-coded embed card for instant visual differentiation
- **Telegram HTML Formatting** — Clean, structured digest with emoji and grouped sections
- **Failure Isolation** — If one delivery channel fails, the other still works
- **Retry Logic** — Automatic retry with 3-second delay on delivery failures
- **Protected API** — `/digest/run` endpoint secured with Bearer token authentication
- **Cloud Persistence** — MongoDB Atlas ensures data survives container restarts and redeploys
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
Cron Trigger (external or internal)
  → Load Gmail accounts from MongoDB
  → For each account: Authenticate → Fetch unread emails → Filter noise
  → Format digest (Telegram HTML + Discord Embeds)
  → Deliver to Discord
  → Deliver to Telegram
  → Log run result to MongoDB
```

### Production Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js + TypeScript |
| Database | MongoDB Atlas (cloud) |
| Hosting | Render (free tier) |
| Scheduling | cron-job.org (external) |
| Delivery | Telegram Bot API + Discord Webhooks |

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
│   │   ├── client.ts      # MongoDB connection via mongoose
│   │   └── schema.ts      # Mongoose models (GmailAccount, DigestRun)
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
│   └── server.ts          # Main entry point (Express + MongoDB + cron startup)
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
- A **MongoDB Atlas** cluster ([free tier available](https://www.mongodb.com/atlas))
- A **Telegram Bot** (created via [@BotFather](https://t.me/BotFather))
- A **Discord Webhook URL** (optional — created in Discord channel settings)

### 1. Clone the Repository

```bash
git clone https://github.com/DevDebpriyo/Daily-Digest.git
cd Daily-Digest
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

# MongoDB Atlas
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/daily-digest

# Scheduler (cron expression — default: every day at 6:00 AM)
CRON_SCHEDULE=0 6 * * *

# Server
PORT=3000

# Internal / External CRON
ENABLE_INTERNAL_CRON=true  # true -> local development, false -> production

# Secret token for protecting the /digest/run endpoint
CRON_SECRET=my_super_secret_key
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

### MongoDB Atlas Setup

1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas) and create a free account
2. Create a new **Shared Cluster** (M0 free tier works fine)
3. Go to **Database Access** → Add a database user with read/write permissions
4. Go to **Network Access** → Add `0.0.0.0/0` to allow connections from anywhere (required for Render)
5. Go to **Database** → Click **Connect** → Choose **Connect your application**
6. Copy the connection string and paste it into your `.env` as `MONGODB_URI`
7. Replace `<password>` with your database user's password

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
| `POST` | `/digest/run` | Manually triggers the digest pipeline *(requires `Authorization: Bearer <CRON_SECRET>` header)* |
| `GET` | `/digest/history` | Returns the last 20 digest run records |

### Quick Manual Test

```bash
# Trigger a digest run manually (requires CRON_SECRET)
curl -X POST http://localhost:3000/digest/run \
  -H "Authorization: Bearer my_super_secret_key"

# Check run history
curl http://localhost:3000/digest/history

# List connected accounts
curl http://localhost:3000/auth/accounts
```

---

## 🗃️ Database

**MongoDB Atlas** is used for cloud persistence with the following collections:

| Collection | Purpose |
|------------|---------|
| `gmailaccounts` | Connected Gmail accounts with OAuth refresh tokens |
| `digestruns` | Audit log of every pipeline execution (time, status, details) |

Data persists permanently in the cloud — container restarts and redeploys on Render do not affect stored data.

---

## 🔧 Configuration

### Cron Scheduling

The application supports two scheduling modes:

| Mode | `ENABLE_INTERNAL_CRON` | How It Works |
|------|------------------------|--------------|
| **Production** | `false` | External service (e.g., [cron-job.org](https://cron-job.org)) calls `POST /digest/run` with the `CRON_SECRET` |
| **Development** | `true` | Internal `node-cron` runs on the `CRON_SCHEDULE` expression |

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
| MongoDB connection fails | Application logs error and exits — will be restarted by Render |

---

## 🚢 Deployment

### Render (Recommended)

1. Connect your GitHub repository to [Render](https://render.com/)
2. Create a new **Web Service**
3. Set **Build Command**: `npm install && npm run build`
4. Set **Start Command**: `npm start`
5. Add all environment variables in the Render dashboard
6. Set `ENABLE_INTERNAL_CRON=false` (use external cron)

### External Cron Setup (cron-job.org)

1. Go to [cron-job.org](https://cron-job.org) and create a free account
2. Create a new cron job:
   - **URL**: `https://your-app.onrender.com/digest/run`
   - **Method**: `POST`
   - **Schedule**: Your desired frequency (e.g., daily at 6:00 AM)
   - **Headers**: Add `Authorization: Bearer <your_CRON_SECRET>`
3. Save and enable the job

> **Why external cron?** Render free tier instances sleep after inactivity. External cron ensures the digest runs reliably even if the instance was sleeping.

### Deploy Checklist

1. ✅ MongoDB Atlas cluster created and configured
2. ✅ All environment variables set on Render
3. ✅ `ENABLE_INTERNAL_CRON=false` for production
4. ✅ External cron job configured with correct URL and Bearer token
5. ✅ Gmail accounts connected via `/auth/google`
6. ✅ Verify health: `curl https://your-app.onrender.com/`

---

## 🛡️ Security

- **OAuth Tokens** — Refresh tokens are stored in MongoDB Atlas; never exposed to any frontend
- **Secrets** — All credentials live in `.env` (local) or platform env vars (production), excluded from version control via `.gitignore`
- **Gmail Scope** — Only `gmail.readonly` is requested — the app cannot send, delete, or modify emails
- **Endpoint Protection** — `/digest/run` is protected by Bearer token authentication
- **No External Dependencies for HTTP** — Telegram and Discord delivery use native `fetch` — no third-party HTTP libraries

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).
