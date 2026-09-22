import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUserEmailVerification extends Document {
  email: string;
  otpHash: string;
  requestedByUserId?: Types.ObjectId;
  attempts: number;
  verifiedAt?: Date | null;
  consumedAt?: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserEmailVerificationSchema = new Schema<IUserEmailVerification>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    otpHash: { type: String, required: true },
    requestedByUserId: { type: Schema.Types.ObjectId, ref: 'AdminUser', index: true },
    attempts: { type: Number, default: 0 },
    verifiedAt: { type: Date, default: null },
    consumedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);

UserEmailVerificationSchema.index({ email: 1, createdAt: -1 });
UserEmailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const UserEmailVerification =
  (mongoose.models.UserEmailVerification as mongoose.Model<IUserEmailVerification>) ||
  mongoose.model<IUserEmailVerification>('UserEmailVerification', UserEmailVerificationSchema);
