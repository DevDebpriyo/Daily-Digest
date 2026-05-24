# Daily Gmail Digest - Project Plan

## Scope
### Included in V1
- Multiple Gmail account connection via Google OAuth 2.0.
- Persistent token storage (access/refresh tokens).
- Daily automated cron execution (configurable time).
- Fetching unread/new emails from the past day.
- Deterministic spam/promotional filtering (using Gmail categories).
- Grouping emails chronologically by Gmail account.
- Automated delivery of a single digest via Telegram Bot API.

### Explicitly Out of Scope
- AI summarization or NLP categorization.
- Voice assistant integration.
- Email replies, sending, or attachments handling.
- Real-time syncing, push notifications, mobile app, or web dashboard.
- Outlook/Yahoo support.
- Cross-account search.

## Milestones
1. **Milestone 1: Environment & Auth Setup**
   - Initialize Node.js/TypeScript project.
   - Set up SQLite database for users and accounts.
   - Implement Google OAuth flow to securely store refresh tokens.
2. **Milestone 2: Email Fetching & Filtering**
   - Integrate Gmail API to fetch unread emails.
   - Apply deterministic filters (exclude `category:promotions`, `category:social`, etc.).
3. **Milestone 3: Digest Generation & Telegram Integration**
   - Format fetched emails into a clean text digest.
   - Integrate Telegram Bot API for message delivery.
4. **Milestone 4: Automation & Error Handling**
   - Set up `node-cron` for daily execution.
   - Implement error handling for expired tokens and API failures.
5. **Milestone 5: Testing & Deployment**
   - Test end-to-end flow with multiple accounts.
   - Deploy to a 24/7 hosting provider (e.g., Railway, Render, Fly.io).

## User Flow
1. Start application and authenticate Gmail accounts (OAuth).
2. Provide Telegram Bot Token and Chat ID.
3. Configure daily schedule (e.g., 6:00 AM IST).
4. System runs daily autonomously, fetching, filtering, grouping, and sending the digest to Telegram.

## Success Criteria
- Multiple Gmail accounts connect successfully.
- Daily cron runs automatically without manual execution.
- Promotions/newsletters are effectively excluded.
- Telegram message arrives daily, properly grouped by account.
