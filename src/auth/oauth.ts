import { google } from 'googleapis';
import { logger } from '../utils/logger';

const AGENT = 'Auth';

/**
 * Gmail readonly scope — the only permission we need.
 */
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

/**
 * Creates and returns a configured Google OAuth2 client instance.
 */
export function createOAuth2Client(
  clientId: string,
  clientSecret: string,
  redirectUri: string
) {
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generates the Google OAuth consent screen URL.
 * Uses 'offline' access type to receive a refresh token.
 * 
 * @param clientId - Google Client ID
 * @param clientSecret - Google Client Secret
 * @param redirectUri - Redirect URI after consent
 * @returns The authorization URL string
 */
export function getAuthUrl(
  clientId: string,
  clientSecret: string,
  redirectUri: string
): string {
  const oAuth2Client = createOAuth2Client(clientId, clientSecret, redirectUri);

  const url = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force consent to always receive a refresh token
  });

  logger.info(AGENT, `Generated auth URL: ${url}`);
  return url;
}

/**
 * Exchanges an authorization code for tokens (access + refresh).
 * 
 * @param code - Authorization code from Google redirect
 * @param clientId - Google Client ID
 * @param clientSecret - Google Client Secret
 * @param redirectUri - Redirect URI
 * @returns Token payload containing access_token, refresh_token, etc.
 */
export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
) {
  const oAuth2Client = createOAuth2Client(clientId, clientSecret, redirectUri);

  try {
    const { tokens } = await oAuth2Client.getToken(code);
    logger.info(AGENT, 'Successfully exchanged authorization code for tokens.');
    return tokens;
  } catch (error) {
    logger.error(AGENT, 'Failed to exchange authorization code for tokens.', error);
    throw error;
  }
}

/**
 * Creates an authenticated OAuth2 client using a stored refresh token.
 * Automatically negotiates a fresh access token from the refresh token.
 * 
 * @param refreshToken - Stored refresh token for the account
 * @param clientId - Google Client ID
 * @param clientSecret - Google Client Secret
 * @param redirectUri - Redirect URI
 * @returns An authenticated OAuth2 client ready for Gmail API calls
 */
export async function getAuthenticatedClient(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
) {
  const oAuth2Client = createOAuth2Client(clientId, clientSecret, redirectUri);
  oAuth2Client.setCredentials({ refresh_token: refreshToken });

  try {
    // Force a token refresh to validate the refresh token is still valid
    const { credentials } = await oAuth2Client.refreshAccessToken();
    oAuth2Client.setCredentials(credentials);
    logger.info(AGENT, 'Successfully refreshed access token from refresh token.');
    return oAuth2Client;
  } catch (error) {
    logger.error(AGENT, 'Failed to refresh access token. Token may be revoked.', error);
    throw error;
  }
}
