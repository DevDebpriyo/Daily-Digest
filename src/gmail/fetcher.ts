import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { logger } from '../utils/logger';

const AGENT = 'Fetcher';

/**
 * Represents a single parsed email from Gmail.
 */
export interface ParsedEmail {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  labelIds: string[];
  categories: string[];
}

/**
 * Fetches unread emails from the last 24 hours for a given authenticated Gmail account.
 * Bounded to a maximum of 100 emails per account to avoid API limits and large payloads.
 * 
 * @param authClient - An authenticated OAuth2 client
 * @param email - The email address (for logging)
 * @returns Array of parsed emails
 */
export async function fetchUnreadEmails(
  authClient: OAuth2Client,
  email: string
): Promise<ParsedEmail[]> {
  const gmail = google.gmail({ version: 'v1', auth: authClient });

  try {
    logger.info(AGENT, `Fetching unread emails for: ${email}`);

    // Fetch unread messages from the last day
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread newer_than:1d',
      maxResults: 100,
    });

    const messages = listResponse.data.messages || [];
    logger.info(AGENT, `Found ${messages.length} unread messages for ${email}`);

    if (messages.length === 0) {
      return [];
    }

    // Fetch full details for each message
    const parsedEmails: ParsedEmail[] = [];

    for (const msg of messages) {
      if (!msg.id) continue;

      try {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });

        const parsed = parseMessage(detail.data);
        if (parsed) {
          parsedEmails.push(parsed);
        }
      } catch (err) {
        logger.warn(AGENT, `Failed to fetch message ${msg.id} for ${email}. Skipping.`);
      }
    }

    logger.info(AGENT, `Parsed ${parsedEmails.length} emails for ${email}`);
    return parsedEmails;
  } catch (error) {
    logger.error(AGENT, `Failed to fetch emails for ${email}`, error);
    throw error;
  }
}

/**
 * Extracts relevant fields from a raw Gmail message payload.
 */
function parseMessage(message: gmail_v1.Schema$Message): ParsedEmail | null {
  if (!message.id || !message.threadId) return null;

  const headers = message.payload?.headers || [];

  const from = getHeader(headers, 'From') || 'Unknown Sender';
  const subject = getHeader(headers, 'Subject') || '(No Subject)';
  const date = getHeader(headers, 'Date') || new Date().toISOString();
  const snippet = message.snippet || '';
  const labelIds = message.labelIds || [];

  // Extract Gmail categories from label IDs
  // Labels like CATEGORY_PROMOTIONS, CATEGORY_SOCIAL, CATEGORY_UPDATES, etc.
  const categories = labelIds
    .filter((label) => label.startsWith('CATEGORY_'))
    .map((label) => label.replace('CATEGORY_', '').toLowerCase());

  return {
    id: message.id,
    threadId: message.threadId,
    from,
    subject,
    snippet,
    date,
    labelIds,
    categories,
  };
}

/**
 * Retrieves a header value by name from a list of Gmail headers.
 */
function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[],
  name: string
): string | undefined {
  const header = headers.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase()
  );
  return header?.value || undefined;
}
