import { logger } from '../utils/logger';

const AGENT = 'Courier';

/**
 * Maximum message length for Telegram Bot API.
 * Telegram supports up to 4096 characters per message.
 */
const MAX_MESSAGE_LENGTH = 4096;

/**
 * The Courier Agent — delivers the formatted digest to Telegram.
 * 
 * Uses the Telegram Bot API directly via fetch (no external dependency).
 * Implements a single retry on failure.
 * 
 * @param botToken - Telegram Bot API token
 * @param chatId - Telegram Chat ID to send the message to
 * @param message - The formatted digest string (HTML)
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  message: string
): Promise<void> {
  logger.info(AGENT, `Sending digest to Telegram chat: ${chatId}`);

  // Split long messages if they exceed the Telegram limit
  const chunks = splitMessage(message, MAX_MESSAGE_LENGTH);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const attempt = i + 1;

    try {
      await postToTelegram(botToken, chatId, chunk);
      logger.info(
        AGENT,
        `Successfully sent message chunk ${attempt}/${chunks.length} to Telegram.`
      );
    } catch (firstError) {
      logger.warn(
        AGENT,
        `First attempt failed for chunk ${attempt}/${chunks.length}. Retrying in 3 seconds...`
      );

      // Wait 3 seconds before retrying
      await sleep(3000);

      try {
        await postToTelegram(botToken, chatId, chunk);
        logger.info(AGENT, `Retry succeeded for chunk ${attempt}/${chunks.length}.`);
      } catch (retryError) {
        logger.error(
          AGENT,
          `Retry also failed for chunk ${attempt}/${chunks.length}. Delivery failed.`,
          retryError
        );
        throw retryError;
      }
    }

    // Small delay between chunks to avoid rate limiting
    if (i < chunks.length - 1) {
      await sleep(500);
    }
  }
}

/**
 * Posts a message to the Telegram Bot API using fetch.
 */
async function postToTelegram(
  botToken: string,
  chatId: string,
  text: string
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram API error (${response.status}): ${body}`);
  }
}

/**
 * Splits a long message into chunks that fit within the Telegram message limit.
 * Tries to split at newline boundaries for cleaner output.
 */
function splitMessage(message: string, maxLength: number): string[] {
  if (message.length <= maxLength) {
    return [message];
  }

  const chunks: string[] = [];
  let remaining = message;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try to find a newline near the split point for a clean break
    let splitIndex = remaining.lastIndexOf('\n', maxLength);
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      // If no good newline found, split at the max length
      splitIndex = maxLength;
    }

    chunks.push(remaining.substring(0, splitIndex));
    remaining = remaining.substring(splitIndex);
  }

  return chunks;
}

/**
 * Simple sleep utility.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
