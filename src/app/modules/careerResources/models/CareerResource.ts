import mongoose, { Schema, Document } from 'mongoose';

export interface ICareerResource extends Document {
  category?: string;
  tag?: string;
  title: string;
  description: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const CareerResourceSchema: Schema = new Schema({
  category: { type: String },
  tag: { type: String },
  title: { type: String, required: true },
  description: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model<ICareerResource>('CareerResource', CareerResourceSchema);
