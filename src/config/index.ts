import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Validated application configuration.
 * Throws at startup if any required variable is missing.
 */
interface AppConfig {
  google: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  telegram: {
    botToken: string;
    chatId: string;
  };
  discord: {
    webhookUrl: string | undefined;
  };
  database: {
    uri: string;
  };
  cron: {
    schedule: string;
    secret: string;
  };
  server: {
    port: number;
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const config: AppConfig = {
  google: {
    clientId: requireEnv('GOOGLE_CLIENT_ID'),
    clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
    redirectUri: requireEnv('GOOGLE_REDIRECT_URI'),
  },
  telegram: {
    botToken: requireEnv('TELEGRAM_BOT_TOKEN'),
    chatId: requireEnv('TELEGRAM_CHAT_ID'),
  },
  discord: {
    webhookUrl: process.env.DISCORD_WEBHOOK_URL || undefined,
  },
  database: {
    uri: requireEnv('MONGODB_URI'),
  },
  cron: {
    schedule: process.env.CRON_SCHEDULE || '0 6 * * *',
    secret: requireEnv('CRON_SECRET'),
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
  },
};

export default config;
