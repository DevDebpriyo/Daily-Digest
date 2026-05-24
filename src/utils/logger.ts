/**
 * Simple structured logger utility.
 * Provides consistent log formatting across all agents.
 */

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

function timestamp(): string {
  return new Date().toISOString();
}

function formatMessage(level: LogLevel, agent: string, message: string): string {
  return `[${timestamp()}] [${level}] [${agent}] ${message}`;
}

export const logger = {
  info(agent: string, message: string): void {
    console.log(formatMessage('INFO', agent, message));
  },

  warn(agent: string, message: string): void {
    console.warn(formatMessage('WARN', agent, message));
  },

  error(agent: string, message: string, error?: unknown): void {
    const errMsg = error instanceof Error ? ` | ${error.message}` : '';
    console.error(formatMessage('ERROR', agent, `${message}${errMsg}`));
  },

  debug(agent: string, message: string): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatMessage('DEBUG', agent, message));
    }
  },
};
