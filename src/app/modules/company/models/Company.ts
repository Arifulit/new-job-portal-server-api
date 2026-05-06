
import mongoose, { Schema, model } from "mongoose";

export interface ICompany {
  name: string;
  owner?: Schema.Types.ObjectId | null;
  industry?: string;
  size?: string;
  yearOfEstablishment?: number;
  address?: string;
  location?: string;
  website?: string;
  logo?: string;
  email?: string;
  phone?: string;
  verified?: boolean;
  description?: string;
  isVerified?: boolean;
  verifiedAt?: Date | null;
  verifiedBy?: Schema.Types.ObjectId | null;
}

const companySchema = new Schema<ICompany>({
  name: { type: String, required: true, unique: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User', unique: true, sparse: true, default: null },
  industry: { type: String },
  size: { type: String },
  yearOfEstablishment: { type: Number },
  address: { type: String },
  location: { type: String },
  website: { type: String },
  logo: { type: String },
  email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
  phone: { type: String },
  description: { type: String },
  isVerified: { type: Boolean, default: false },
  verifiedAt: { type: Date, default: null },
  verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

// Guarded model creation to avoid OverwriteModelError
export const Company =
  (mongoose.models.Company as mongoose.Model<ICompany>) ||
  model<ICompany>("Company", companySchema);

export default Company;