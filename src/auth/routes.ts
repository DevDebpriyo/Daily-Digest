import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { google } from 'googleapis';
import config from '../config';
import { getAuthUrl, exchangeCodeForTokens, createOAuth2Client } from './oauth';
import { getDatabase } from '../db/client';
import { logger } from '../utils/logger';

const AGENT = 'Auth-Routes';
const router = Router();

/**
 * GET /auth/google
 * 
 * Redirects the user to Google's OAuth consent screen.
 * This is the entry point for connecting a new Gmail account.
 */
router.get('/auth/google', (_req: Request, res: Response) => {
  try {
    const url = getAuthUrl(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );
    res.redirect(url);
  } catch (error) {
    logger.error(AGENT, 'Failed to generate auth URL.', error);
    res.status(500).json({ error: 'Failed to initiate Google authentication.' });
  }
});

/**
 * GET /auth/google/callback
 * 
 * Handles the OAuth redirect from Google.
 * Exchanges the authorization code for tokens, fetches the user's email,
 * and stores the refresh token in the database.
 */
router.get('/auth/google/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;

  if (!code) {
    res.status(400).json({ error: 'Missing authorization code.' });
    return;
  }

  try {
    // Exchange the code for tokens
    const tokens = await exchangeCodeForTokens(
      code,
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );

    if (!tokens.refresh_token) {
      logger.error(AGENT, 'No refresh token received. User may need to re-consent.');
      res.status(400).json({
        error: 'No refresh token received. Please revoke access and try again.',
      });
      return;
    }

    // Get the user's email address using the access token
    const oAuth2Client = createOAuth2Client(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );
    oAuth2Client.setCredentials(tokens);

    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const email = profile.data.emailAddress;

    if (!email) {
      res.status(500).json({ error: 'Could not retrieve email address from Google.' });
      return;
    }

    logger.info(AGENT, `Authenticated Gmail account: ${email}`);

    // Store in the database
    const db = getDatabase();

    // Check if this email already exists
    const existingAccount = db
      .prepare('SELECT id FROM gmail_accounts WHERE email = ?')
      .get(email) as { id: string } | undefined;

    if (existingAccount) {
      // Update the refresh token for the existing account
      db.prepare('UPDATE gmail_accounts SET refresh_token = ? WHERE email = ?')
        .run(tokens.refresh_token, email);
      logger.info(AGENT, `Updated refresh token for existing account: ${email}`);
    } else {
      // Ensure a default user exists (single-user mode for V1)
      let user = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: string } | undefined;

      if (!user) {
        const userId = uuidv4();
        db.prepare('INSERT INTO users (id, telegram_chat_id) VALUES (?, ?)')
          .run(userId, config.telegram.chatId);
        user = { id: userId };
        logger.info(AGENT, `Created default user with id: ${userId}`);
      }

      // Insert the new Gmail account
      const accountId = uuidv4();
      db.prepare(
        'INSERT INTO gmail_accounts (id, user_id, email, refresh_token) VALUES (?, ?, ?, ?)'
      ).run(accountId, user.id, email, tokens.refresh_token);
      logger.info(AGENT, `Stored new Gmail account: ${email} (id: ${accountId})`);
    }

    res.status(200).json({
      success: true,
      message: `Successfully connected Gmail account: ${email}`,
      email,
    });
  } catch (error) {
    logger.error(AGENT, 'OAuth callback failed.', error);
    res.status(500).json({ error: 'Authentication failed. Please try again.' });
  }
});

/**
 * GET /auth/accounts
 * 
 * Lists all connected Gmail accounts (emails only, no tokens).
 */
router.get('/auth/accounts', (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const accounts = db
      .prepare('SELECT id, email, created_at FROM gmail_accounts')
      .all();
    res.json({ accounts });
  } catch (error) {
    logger.error(AGENT, 'Failed to list accounts.', error);
    res.status(500).json({ error: 'Failed to retrieve accounts.' });
  }
});

/**
 * DELETE /auth/accounts/:id
 * 
 * Removes a connected Gmail account by its ID.
 */
router.delete('/auth/accounts/:id', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const result = db
      .prepare('DELETE FROM gmail_accounts WHERE id = ?')
      .run(req.params.id);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    logger.info(AGENT, `Removed Gmail account: ${req.params.id}`);
    res.json({ success: true, message: 'Account removed.' });
  } catch (error) {
    logger.error(AGENT, 'Failed to remove account.', error);
    res.status(500).json({ error: 'Failed to remove account.' });
  }
});

export default router;
