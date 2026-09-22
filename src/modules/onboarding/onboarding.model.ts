import mongoose, { Document, Schema } from 'mongoose';

export interface IOnboardingPage extends Document {
  pageNumber: number;
  title: string;
  description: string;
  imageUrl: string;
  ctaText?: string;
  isActive: boolean;
  order?: number;
  createdAt: Date;
  updatedAt: Date;
}

const onboardingPageSchema = new Schema<IOnboardingPage>(
  {
    pageNumber: { type: Number, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    imageUrl: { type: String, required: true },
    ctaText: { type: String },
    isActive: { type: Boolean, default: true },
    order: { type: Number },
  },
  { timestamps: true },
);
onboardingPageSchema.index({ isActive: 1, pageNumber: 1 });
onboardingPageSchema.index({ isActive: 1, order: 1 });

export const OnboardingPage =
  (mongoose.models.CustomerOnboardingPage as mongoose.Model<IOnboardingPage>) ||
  mongoose.model<IOnboardingPage>('CustomerOnboardingPage', onboardingPageSchema, 'customer_onboarding_pages');
