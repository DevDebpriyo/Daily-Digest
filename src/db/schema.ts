import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Gmail Account document interface.
 */
export interface IGmailAccount extends Document {
  email: string;
  refreshToken: string;
  createdAt: Date;
  updatedAt: Date;
}

const gmailAccountSchema = new Schema<IGmailAccount>(
  {
    email: { type: String, required: true, unique: true },
    refreshToken: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

export const GmailAccount: Model<IGmailAccount> = mongoose.model<IGmailAccount>(
  'GmailAccount',
  gmailAccountSchema
);

/**
 * Digest Run document interface.
 */
export interface IDigestRun extends Document {
  status: 'success' | 'partial' | 'failure';
  details: string | null;
  createdAt: Date;
}

const digestRunSchema = new Schema<IDigestRun>(
  {
    status: { type: String, required: true, enum: ['success', 'partial', 'failure'] },
    details: { type: String, default: null },
  },
  {
    timestamps: true,
  }
);

export const DigestRun: Model<IDigestRun> = mongoose.model<IDigestRun>(
  'DigestRun',
  digestRunSchema
);
