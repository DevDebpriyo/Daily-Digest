import { ParsedEmail } from './fetcher';
import { logger } from '../utils/logger';

const AGENT = 'Bouncer';

/**
 * Gmail category labels to exclude.
 * Emails with any of these categories are considered noise.
 */
const EXCLUDED_CATEGORIES = new Set([
  'promotions',
  'social',
  'forums',
]);

/**
 * Label IDs to exclude — Gmail marks these directly on messages.
 */
const EXCLUDED_LABEL_IDS = new Set([
  'CATEGORY_PROMOTIONS',
  'CATEGORY_SOCIAL',
  'CATEGORY_FORUMS',
  'SPAM',
  'TRASH',
]);

/**
 * Keywords in the sender or subject that indicate a newsletter or automated email.
 * Case-insensitive matching.
 */
const NEWSLETTER_PATTERNS = [
  'unsubscribe',
  'no-reply',
  'noreply',
  'newsletter',
  'digest',
  'notification@',
  'updates@',
  'marketing@',
  'promo@',
  'bulk@',
  'mailer-daemon',
];

/**
 * The Bouncer Agent — applies deterministic filtering rules to remove noise.
 * 
 * Filtering strategy:
 * 1. Exclude emails with Gmail promotional/social/forum categories.
 * 2. Exclude emails with SPAM or TRASH labels.
 * 3. Exclude emails matching newsletter-like sender/subject patterns.
 * 
 * @param emails - Array of parsed emails from the Fetcher Agent
 * @returns Filtered array containing only meaningful emails
 */
export function filterEmails(emails: ParsedEmail[]): ParsedEmail[] {
  const before = emails.length;

  const filtered = emails.filter((email) => {
    // Rule 1: Exclude by Gmail category
    if (email.categories.some((cat) => EXCLUDED_CATEGORIES.has(cat))) {
      logger.debug(AGENT, `Excluded (category): "${email.subject}" from ${email.from}`);
      return false;
    }

    // Rule 2: Exclude by label ID
    if (email.labelIds.some((label) => EXCLUDED_LABEL_IDS.has(label))) {
      logger.debug(AGENT, `Excluded (label): "${email.subject}" from ${email.from}`);
      return false;
    }

    // Rule 3: Exclude by newsletter/automated sender patterns
    const fromLower = email.from.toLowerCase();
    const subjectLower = email.subject.toLowerCase();
    const snippetLower = email.snippet.toLowerCase();

    for (const pattern of NEWSLETTER_PATTERNS) {
      if (
        fromLower.includes(pattern) ||
        subjectLower.includes(pattern) ||
        snippetLower.includes(pattern)
      ) {
        logger.debug(
          AGENT,
          `Excluded (pattern: "${pattern}"): "${email.subject}" from ${email.from}`
        );
        return false;
      }
    }

    return true;
  });

  const after = filtered.length;
  logger.info(AGENT, `Filtered ${before} → ${after} emails (${before - after} removed)`);

  return filtered;
}
