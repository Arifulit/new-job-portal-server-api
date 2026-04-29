import mongoose, { Schema, Document } from 'mongoose';

export interface ICareerResource extends Document {
  category: string;
  title: string;
  description: string;
}

const CareerResourceSchema: Schema = new Schema({
  category: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model<ICareerResource>('CareerResource', CareerResourceSchema);
