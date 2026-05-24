# Daily Gmail Digest - Technical Architecture

## System Components
1. **Cron Scheduler Module**: The heartbeat of the system. Triggered once a day based on user configuration, orchestrating the entire digest generation process.
2. **Auth Module**: Handles OAuth 2.0 handshake with Google, requesting `gmail.readonly` scope, and storing refresh tokens securely in the database.
3. **Gmail Integration Module**: Connects to the Gmail API using stored refresh tokens. Executes queries like `is:unread newer_than:1d` to retrieve relevant emails.
4. **Filtering Module**: A deterministic processing layer that strips out emails matching `category:promotions`, `category:social`, or specific heuristic patterns (e.g., "unsubscribe").
5. **Digest Formatter Module**: Transforms raw email data (Sender, Subject, Time) into a grouped, chronological, human-readable text string.
6. **Telegram Delivery Module**: Pushes the finalized text string to the configured Telegram Chat ID using the Telegram Bot API.

## Data Flow
1. **Trigger**: `node-cron` fires at the scheduled time.
2. **Load Accounts**: System queries the database for all active Gmail accounts and their refresh tokens.
3. **Fetch & Filter Loop**: 
   - For each account, generate a new access token.
   - Fetch max 100 recent/unread emails.
   - Pass emails through the filtering module to drop spam.
4. **Aggregate**: Combine valid emails from all accounts into a single data structure.
5. **Format**: Pass data structure to the Digest Formatter.
6. **Deliver**: Post the formatted string to Telegram.
7. **Log**: Record the run status in the `digest_runs` table.

## Reliability & Security
- **Stateless Execution**: The cron job relies purely on the database state. If the server restarts, the cron simply waits for its next scheduled time.
- **Token Security**: Refresh tokens are isolated in the backend database.
- **Rate Limiting**: Bounded fetching (max 100 emails per account) ensures the system doesn't hit API limits or create overly large Telegram payloads.
