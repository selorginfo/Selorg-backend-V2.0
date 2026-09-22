import mongoose, { Document, Schema } from 'mongoose';

export interface IShift extends Document {
  id: string;
  staffId: string;
  staffName: string;
  date: Date;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'active' | 'completed' | 'absent' | 'late';
  checkInTime?: string;
  checkOutTime?: string;
  hub: string;
  isPeakHour: boolean;
  overtimeMinutes: number;
}

const ShiftSchema = new Schema<IShift>(
  {
    id: { type: String, required: true, unique: true, index: true },
    staffId: { type: String, required: true, index: true },
    staffName: { type: String, required: true },
    date: { type: Date, required: true, index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    status: {
      type: String,
      enum: ['scheduled', 'active', 'completed', 'absent', 'late'],
      default: 'scheduled',
      index: true,
    },
    checkInTime: { type: String },
    checkOutTime: { type: String },
    hub: { type: String, required: true },
    isPeakHour: { type: Boolean, default: false },
    overtimeMinutes: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'staff_shifts' }
);

ShiftSchema.index({ date: 1, staffId: 1 });

export const Shift = mongoose.model<IShift>('StaffShift', ShiftSchema);
