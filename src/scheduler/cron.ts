import cron from 'node-cron';
import config from '../config';
import { GmailAccount, DigestRun } from '../db/schema';
import { getAuthenticatedClient } from '../auth/oauth';
import { fetchUnreadEmails, ParsedEmail } from '../gmail/fetcher';
import { filterEmails } from '../gmail/filter';
import { formatDigest, formatDiscordEmbeds, AccountDigest, DiscordEmbed } from '../digest/formatter';
import { sendTelegramMessage } from '../telegram/sender';
import { sendDiscordDigest } from '../discord/sender';
import { logger } from '../utils/logger';

const AGENT = 'Orchestrator';

/**
 * The Orchestrator Agent — schedules and coordinates the daily digest pipeline.
 * 
 * Pipeline steps:
 * 1. Load all active Gmail accounts from the database.
 * 2. For each account, authenticate & fetch unread emails.
 * 3. Filter out promotional/spam emails.
 * 4. Format the combined digest.
 * 5. Deliver via Discord.
 * 6. Deliver via Telegram.
 * 7. Log the run result.
 */

/**
 * Starts the cron scheduler.
 * Runs the digest pipeline at the configured schedule.
 */
export function startScheduler(): void {
  const schedule = config.cron.schedule;

  if (!cron.validate(schedule)) {
    logger.error(AGENT, `Invalid cron schedule: "${schedule}". Scheduler not started.`);
    return;
  }

  logger.info(AGENT, `Scheduler started. Digest will run on schedule: "${schedule}"`);

  cron.schedule(schedule, async () => {
    logger.info(AGENT, '⏰ Cron triggered. Starting digest pipeline...');
    await runDigestPipeline();
  });
}

/**
 * Executes the full digest pipeline.
 * This can be called by the cron job or manually via an API endpoint.
 */
export async function runDigestPipeline(): Promise<void> {
  const startTime = Date.now();
  let status: 'success' | 'partial' | 'failure' = 'success';
  let details = '';

  try {
    // Step 1: Load all Gmail accounts from the database
    const accounts = await GmailAccount.find({}).lean();

    if (accounts.length === 0) {
      logger.warn(AGENT, 'No Gmail accounts configured. Sending empty digest.');
      const emptyTelegramDigest = formatDigest([]);
      const emptyDiscordEmbeds = formatDiscordEmbeds([]);

      // Discord first (isolated)
      await deliverToDiscord(emptyDiscordEmbeds);

      // Then Telegram
      await sendTelegramMessage(
        config.telegram.botToken,
        config.telegram.chatId,
        emptyTelegramDigest
      );
      details = 'No accounts configured.';
      await logRun(status, details);
      return;
    }

    logger.info(AGENT, `Found ${accounts.length} Gmail account(s). Processing...`);

    // Step 2 & 3: Fetch and filter emails for each account
    const accountDigests: AccountDigest[] = [];
    const errors: string[] = [];

    for (const account of accounts) {
      try {
        logger.info(AGENT, `Processing account: ${account.email}`);

        // Authenticate with the stored refresh token
        const authClient = await getAuthenticatedClient(
          account.refreshToken,
          config.google.clientId,
          config.google.clientSecret,
          config.google.redirectUri
        );

        // Fetch unread emails
        const rawEmails = await fetchUnreadEmails(authClient, account.email);

        // Filter out noise
        const cleanEmails = filterEmails(rawEmails);

        accountDigests.push({
          email: account.email,
          emails: cleanEmails,
        });

        logger.info(
          AGENT,
          `Account ${account.email}: ${rawEmails.length} fetched → ${cleanEmails.length} after filtering`
        );
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.error(AGENT, `Failed to process account: ${account.email}`, error);
        errors.push(`${account.email}: ${errMsg}`);
        status = 'partial';
      }
    }

    // If ALL accounts failed, mark as full failure
    if (accountDigests.length === 0 && errors.length > 0) {
      status = 'failure';
      details = `All accounts failed:\n${errors.join('\n')}`;
      logger.error(AGENT, details);

      // Still try to notify the user about the failure
      const telegramFailureMsg = `⚠️ <b>Daily Digest Failed</b>\n\nAll Gmail accounts encountered errors:\n${errors
        .map((e) => `• ${e}`)
        .join('\n')}\n\nPlease re-authenticate your accounts.`;

      const discordFailureEmbeds: DiscordEmbed[] = [{
        title: '⚠️  Daily Digest Failed',
        description: `All Gmail accounts encountered errors:\n\n${errors
          .map((e) => `• ${e}`)
          .join('\n')}\n\nPlease re-authenticate your accounts.`,
        color: 0xed4245,
      }];

      // Discord notification (isolated)
      await deliverToDiscord(discordFailureEmbeds);

      // Telegram notification (isolated)
      try {
        await sendTelegramMessage(
          config.telegram.botToken,
          config.telegram.chatId,
          telegramFailureMsg
        );
      } catch {
        logger.error(AGENT, 'Failed to send failure notification to Telegram.');
      }

      await logRun(status, details);
      return;
    }

    // Step 4: Format the digest for both platforms
    const telegramDigest = formatDigest(accountDigests);
    const discordEmbeds = formatDiscordEmbeds(accountDigests);

    // Add error notes if any accounts failed
    let finalTelegramMessage = telegramDigest;
    if (errors.length > 0) {
      finalTelegramMessage += `\n\n⚠️ <b>Errors:</b>\n`;
      for (const err of errors) {
        finalTelegramMessage += `• ${err}\n`;
      }

      // Append an error embed to the Discord embeds
      discordEmbeds.push({
        title: '⚠️  Errors',
        description: errors.map((e) => `• ${e}`).join('\n'),
        color: 0xed4245,
      });
    }

    // Step 5: Deliver via Discord (isolated — failure won't block Telegram)
    await deliverToDiscord(discordEmbeds);

    // Step 6: Deliver via Telegram
    await sendTelegramMessage(
      config.telegram.botToken,
      config.telegram.chatId,
      finalTelegramMessage
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    details = `Processed ${accountDigests.length}/${accounts.length} accounts in ${elapsed}s`;

    if (errors.length > 0) {
      details += `. Errors: ${errors.join('; ')}`;
    }

    logger.info(AGENT, `✅ Digest pipeline completed. ${details}`);
  } catch (error) {
    status = 'failure';
    details = error instanceof Error ? error.message : String(error);
    logger.error(AGENT, `❌ Digest pipeline failed: ${details}`, error);
  }

  await logRun(status, details);
}

/**
 * Attempts Discord delivery with full failure isolation.
 * If DISCORD_WEBHOOK_URL is not configured, silently skips.
 * If delivery fails, logs the error but never throws.
 */
async function deliverToDiscord(embeds: DiscordEmbed[]): Promise<void> {
  const webhookUrl = config.discord.webhookUrl;

  if (!webhookUrl) {
    logger.warn(AGENT, 'DISCORD_WEBHOOK_URL not configured. Skipping Discord delivery.');
    return;
  }

  try {
    await sendDiscordDigest(webhookUrl, embeds);
  } catch (error) {
    logger.error(AGENT, 'Discord delivery failed. Continuing pipeline.', error);
  }
}

/**
 * Records the digest run result in MongoDB.
 */
async function logRun(status: 'success' | 'partial' | 'failure', details: string): Promise<void> {
  try {
    const run = await DigestRun.create({ status, details });
    logger.info(AGENT, `Run logged: ${run.id} → ${status}`);
  } catch (error) {
    logger.error(AGENT, 'Failed to log digest run to database.', error);
  }
}
