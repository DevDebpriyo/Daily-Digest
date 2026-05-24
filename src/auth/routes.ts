import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import config from '../config';
import { getAuthUrl, exchangeCodeForTokens, createOAuth2Client } from './oauth';
import { GmailAccount } from '../db/schema';
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

    // Upsert: update if exists, create if not
    const existingAccount = await GmailAccount.findOne({ email });

    if (existingAccount) {
      existingAccount.refreshToken = tokens.refresh_token;
      await existingAccount.save();
      logger.info(AGENT, `Updated refresh token for existing account: ${email}`);
    } else {
      await GmailAccount.create({
        email,
        refreshToken: tokens.refresh_token,
      });
      logger.info(AGENT, `Stored new Gmail account: ${email}`);
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
router.get('/auth/accounts', async (_req: Request, res: Response) => {
  try {
    const accounts = await GmailAccount.find({}, 'email createdAt').lean();
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
router.delete('/auth/accounts/:id', async (req: Request, res: Response) => {
  try {
    const result = await GmailAccount.deleteOne({ _id: req.params.id });

    if (result.deletedCount === 0) {
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
