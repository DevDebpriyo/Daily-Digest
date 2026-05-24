import { DiscordEmbed } from '../digest/formatter';
import { logger } from '../utils/logger';

const AGENT = 'Discord-Courier';

/**
 * Discord allows a maximum of 10 embeds per webhook request.
 */
const MAX_EMBEDS_PER_REQUEST = 10;

/**
 * Sends the formatted digest to Discord via an Incoming Webhook using embeds.
 *
 * Uses a simple HTTP POST with fetch (no discord.js, no bot, no OAuth).
 * Implements a single retry on failure with a 3-second delay.
 * Batches embeds into groups of 10 (Discord's per-message limit).
 *
 * @param webhookUrl - Discord Incoming Webhook URL
 * @param embeds - Array of Discord embed objects from the formatter
 */
export async function sendDiscordDigest(
  webhookUrl: string,
  embeds: DiscordEmbed[]
): Promise<void> {
  logger.info(AGENT, `Sending digest to Discord (${embeds.length} embed${embeds.length !== 1 ? 's' : ''}).`);

  // Batch embeds into groups of MAX_EMBEDS_PER_REQUEST
  const batches = batchEmbeds(embeds, MAX_EMBEDS_PER_REQUEST);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchLabel = `${i + 1}/${batches.length}`;

    try {
      await postToDiscord(webhookUrl, batch);
      logger.info(AGENT, `Discord batch ${batchLabel} sent successfully.`);
    } catch (firstError) {
      logger.warn(
        AGENT,
        `Discord batch ${batchLabel} failed. Retrying in 3 seconds...`
      );

      // Wait 3 seconds before retrying
      await sleep(3000);

      try {
        await postToDiscord(webhookUrl, batch);
        logger.info(AGENT, `Discord retry succeeded for batch ${batchLabel}.`);
      } catch (retryError) {
        logger.error(
          AGENT,
          `Discord retry also failed for batch ${batchLabel}. Delivery failed.`,
          retryError
        );
        throw retryError;
      }
    }

    // Small delay between batches to avoid rate limiting
    if (i < batches.length - 1) {
      await sleep(1000);
    }
  }

  logger.info(AGENT, 'Discord digest sent successfully.');
}

/**
 * Posts embeds to the Discord webhook using fetch.
 */
async function postToDiscord(
  webhookUrl: string,
  embeds: DiscordEmbed[]
): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ embeds }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord webhook error (${response.status}): ${body}`);
  }
}

/**
 * Splits an array of embeds into batches respecting the per-request limit.
 */
function batchEmbeds(embeds: DiscordEmbed[], maxPerBatch: number): DiscordEmbed[][] {
  if (embeds.length <= maxPerBatch) {
    return [embeds];
  }

  const batches: DiscordEmbed[][] = [];
  for (let i = 0; i < embeds.length; i += maxPerBatch) {
    batches.push(embeds.slice(i, i + maxPerBatch));
  }
  return batches;
}

/**
 * Simple sleep utility.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
