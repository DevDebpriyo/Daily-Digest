import { ParsedEmail } from '../gmail/fetcher';
import { logger } from '../utils/logger';

const AGENT = 'Editor';

/**
 * Represents emails grouped by their Gmail account.
 */
export interface AccountDigest {
  email: string;
  emails: ParsedEmail[];
}

/**
 * The Editor Agent — transforms raw emails into a clean, Telegram-friendly digest.
 * 
 * Groups emails by account, orders them chronologically within each group,
 * and formats the output using Telegram-compatible HTML.
 * 
 * @param accountDigests - Array of account digests (email + emails)
 * @returns Formatted string ready for Telegram delivery
 */
export function formatDigest(accountDigests: AccountDigest[]): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let digest = `📬 <b>Daily Email Digest</b>\n`;
  digest += `📅 ${dateStr}\n`;
  digest += `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Count total emails across all accounts
  const totalEmails = accountDigests.reduce(
    (sum, ad) => sum + ad.emails.length,
    0
  );

  if (totalEmails === 0) {
    digest += `✨ <i>No new important emails found today.</i>\n`;
    digest += `\nYour inboxes are clean. Enjoy your day! 🎉`;
    logger.info(AGENT, 'Formatted empty digest (no emails to report).');
    return digest;
  }

  digest += `📊 <b>${totalEmails} email${totalEmails !== 1 ? 's' : ''}</b> across <b>${accountDigests.length} account${accountDigests.length !== 1 ? 's' : ''}</b>\n\n`;

  for (const accountDigest of accountDigests) {
    if (accountDigest.emails.length === 0) continue;

    // Sort emails by date (newest first)
    const sortedEmails = [...accountDigest.emails].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    digest += `📧 <b>${escapeHtml(accountDigest.email)}</b> (${sortedEmails.length})\n`;
    digest += `─────────────────────────\n`;

    for (const email of sortedEmails) {
      const sender = extractSenderName(email.from);
      const time = formatTime(email.date);
      const subject = email.subject || '(No Subject)';

      digest += `  ▸ <b>${escapeHtml(sender)}</b>\n`;
      digest += `    ${escapeHtml(subject)}\n`;
      digest += `    🕐 ${time}\n\n`;
    }
  }

  digest += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  digest += `🤖 <i>Daily Gmail Digest • Automated</i>`;
  digest += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  logger.info(AGENT, `Formatted Telegram digest: ${totalEmails} emails across ${accountDigests.length} accounts.`);
  return digest;
}

/**
 * Represents a single Discord embed field.
 */
interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

/**
 * Represents a Discord embed object for the webhook payload.
 */
export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: DiscordEmbedField[];
  footer?: { text: string };
  timestamp?: string;
}

/**
 * Accent colors for Discord embeds (decimal).
 * Each account gets a distinct color for easy visual differentiation.
 */
const EMBED_COLORS = [
  0x5865f2, // Blurple
  0x57f287, // Green
  0xfee75c, // Yellow
  0xeb459e, // Fuchsia
  0xed4245, // Red
  0xf47b67, // Coral
  0xe67e22, // Orange
  0x1abc9c, // Teal
];

/** Header embed color — dark charcoal-blue */
const HEADER_COLOR = 0x2b2d31;

/**
 * Formats the digest for Discord using rich embed objects.
 *
 * Produces a header embed with the date and summary stats, then one embed
 * per Gmail account with each email shown as a structured field entry.
 * This gives clear visual separation and hierarchy in Discord.
 *
 * @param accountDigests - Array of account digests (email + emails)
 * @returns Array of Discord embed objects ready for the webhook payload
 */
export function formatDiscordEmbeds(accountDigests: AccountDigest[]): DiscordEmbed[] {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const totalEmails = accountDigests.reduce(
    (sum, ad) => sum + ad.emails.length,
    0
  );

  const embeds: DiscordEmbed[] = [];

  // ─── Header Embed ───
  if (totalEmails === 0) {
    embeds.push({
      title: '📬  Daily Email Digest',
      description: `📅  ${dateStr}\n\n✨ No new important emails found today.\nYour inboxes are clean. Enjoy your day! 🎉`,
      color: HEADER_COLOR,
      footer: { text: '🤖 Daily Gmail Digest • Automated' },
      timestamp: now.toISOString(),
    });
    logger.info(AGENT, 'Formatted empty Discord embed digest.');
    return embeds;
  }

  const accountLabel = accountDigests.filter((a) => a.emails.length > 0).length;

  embeds.push({
    title: '📬  Daily Email Digest',
    description: [
      `📅  ${dateStr}`,
      '',
      `📊  **${totalEmails}** email${totalEmails !== 1 ? 's' : ''} across **${accountLabel}** account${accountLabel !== 1 ? 's' : ''}`,
    ].join('\n'),
    color: HEADER_COLOR,
    timestamp: now.toISOString(),
  });

  // ─── One embed per account ───
  let colorIndex = 0;

  for (const accountDigest of accountDigests) {
    if (accountDigest.emails.length === 0) continue;

    const sortedEmails = [...accountDigest.emails].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    const color = EMBED_COLORS[colorIndex % EMBED_COLORS.length];
    colorIndex++;

    // Build the email list as a single description block for compactness
    const lines: string[] = [];

    for (const email of sortedEmails) {
      const sender = extractSenderName(email.from);
      const time = formatTime(email.date);
      const subject = email.subject || '(No Subject)';

      lines.push(`**${sender}**`);
      lines.push(`┗ ${subject}  ·  🕐 ${time}`);
      lines.push('');
    }

    embeds.push({
      title: `📧  ${accountDigest.email}`,
      description: lines.join('\n').trimEnd(),
      color,
      footer: { text: `${sortedEmails.length} email${sortedEmails.length !== 1 ? 's' : ''}` },
    });
  }

  // ─── Footer embed ───
  embeds.push({
    description: '🤖  *Daily Gmail Digest • Automated*',
    color: HEADER_COLOR,
  });

  logger.info(AGENT, `Formatted Discord embed digest: ${totalEmails} emails across ${accountLabel} accounts.`);
  return embeds;
}

/**
 * Extracts a clean sender name from the full "From" header.
 * e.g., "John Doe <john@example.com>" → "John Doe"
 */
function extractSenderName(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*<?/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return from;
}

/**
 * Formats a date string into a human-readable time (e.g., "2:30 PM").
 */
function formatTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

/**
 * Escapes HTML special characters for Telegram's HTML parse mode.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
