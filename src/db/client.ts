import mongoose from 'mongoose';
import { logger } from '../utils/logger';

const AGENT = 'Database';

/**
 * Connects to MongoDB Atlas using the MONGODB_URI environment variable.
 * Should be called once at application startup.
 */
export async function connectDatabase(uri: string): Promise<void> {
  try {
    logger.info(AGENT, 'Connecting to MongoDB Atlas...');

    await mongoose.connect(uri);

    logger.info(AGENT, 'MongoDB connected successfully.');
  } catch (error) {
    logger.error(AGENT, 'MongoDB connection failed.', error);
    throw error;
  }
}

/**
 * Closes the MongoDB connection gracefully.
 */
export async function closeDatabase(): Promise<void> {
  try {
    await mongoose.disconnect();
    logger.info(AGENT, 'MongoDB connection closed.');
  } catch (error) {
    logger.error(AGENT, 'Failed to close MongoDB connection.', error);
  }
}
