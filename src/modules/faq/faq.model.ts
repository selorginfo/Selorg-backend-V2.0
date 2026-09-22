import mongoose, { Document, Schema } from 'mongoose';

export interface IFaqItem extends Document {
  question: string;
  answer: string;
  order: number;
  category: string;
  isActive: boolean;
  helpfulCount: number;
  notHelpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const faqItemSchema = new Schema<IFaqItem>(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
    order: { type: Number, default: 0 },
    category: { type: String, default: '', index: true },
    isActive: { type: Boolean, default: true },
    helpfulCount: { type: Number, default: 0 },
    notHelpfulCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);
faqItemSchema.index({ isActive: 1, order: 1 });
faqItemSchema.index({ category: 1, isActive: 1, order: 1 });

export const FaqItem =
  (mongoose.models.CustomerFaqItem as mongoose.Model<IFaqItem>) ||
  mongoose.model<IFaqItem>('CustomerFaqItem', faqItemSchema, 'customer_faq_items');

export interface IFaqFeedback extends Document {
  faqId: mongoose.Types.ObjectId;
  userId: string;
  helpful: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const faqFeedbackSchema = new Schema<IFaqFeedback>(
  {
    faqId: { type: Schema.Types.ObjectId, ref: 'CustomerFaqItem', required: true, index: true },
    userId: { type: String, required: true, index: true },
    helpful: { type: Boolean, required: true },
  },
  { timestamps: true },
);
faqFeedbackSchema.index({ faqId: 1, userId: 1 }, { unique: true });

export const FaqFeedback =
  (mongoose.models.CustomerFaqFeedback as mongoose.Model<IFaqFeedback>) ||
  mongoose.model<IFaqFeedback>('CustomerFaqFeedback', faqFeedbackSchema, 'customer_faq_feedback');

/** Categories match the product brief: Orders, Payments, Delivery, Wallet, Refunds, Account, Offers, Technical Issues */
export const FAQ_CATEGORIES = ['Orders', 'Payments', 'Delivery', 'Wallet', 'Refunds', 'Account', 'Offers', 'Technical Issues'];
