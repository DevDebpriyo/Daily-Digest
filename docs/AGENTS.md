# Daily Gmail Digest - Agentic/Automation Breakdown

*Note: While the PRD explicitly excludes AI summarization and NLP (relying instead on deterministic filters), the system operates as a set of autonomous "Agents" or background workers that handle specific responsibilities.*

## 1. The Orchestrator Agent (Scheduler)
- **Role**: Timekeeper and process manager.
- **Responsibility**: Wakes up daily at the designated time, initiates the digest pipeline, and logs the final success/failure state of the run.

## 2. The Fetcher Agent (Gmail API Handler)
- **Role**: Data retriever.
- **Responsibility**: Takes a refresh token, negotiates a fresh access token with Google, and pulls down raw unread emails within the 24-hour window. Operates independently for each connected account to ensure failures are isolated.

## 3. The Bouncer Agent (Filtering Logic)
- **Role**: Noise reduction.
- **Responsibility**: Strictly applies deterministic rules to discard promotions, newsletters, and social updates. It ensures the user only sees signal, no noise.

## 4. The Editor Agent (Digest Formatter)
- **Role**: Content presentation.
- **Responsibility**: Takes the chaotic pile of valid emails and structures them neatly. It groups them by account, orders them by time, and ensures the output fits nicely within Telegram's message formatting.

## 5. The Courier Agent (Telegram Delivery)
- **Role**: Final delivery.
- **Responsibility**: Connects to the Telegram Bot API, handles network retries if delivery fails, and ensures the user receives their morning digest right on their phone.
