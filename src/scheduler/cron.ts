import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import config from '../config';
import { getDatabase } from '../db/client';
import { GmailAccount } from '../db/schema';
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
  const runId = uuidv4();
  const startTime = Date.now();
  let status: 'success' | 'partial' | 'failure' = 'success';
  let details = '';

  try {
    // Step 1: Load all Gmail accounts from the database
    const db = getDatabase();
    const accounts = db
      .prepare('SELECT * FROM gmail_accounts')
      .all() as GmailAccount[];

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
      logRun(runId, status, details);
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
          account.refresh_token,
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

      logRun(runId, status, details);
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

  logRun(runId, status, details);
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
 * Records the digest run result in the database.
 */
function logRun(runId: string, status: string, details: string): void {
  try {
    const db = getDatabase();
    const user = db.prepare('SELECT id FROM users LIMIT 1').get() as
      | { id: string }
      | undefined;

    db.prepare(
      'INSERT INTO digest_runs (id, user_id, executed_at, status, details) VALUES (?, ?, datetime(\'now\'), ?, ?)'
    ).run(runId, user?.id || null, status, details);

    logger.info(AGENT, `Run logged: ${runId} → ${status}`);
  } catch (error) {
    logger.error(AGENT, 'Failed to log digest run to database.', error);
  }
}
