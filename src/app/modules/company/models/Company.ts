import { Schema, model } from "mongoose";

export interface ICompany {
  name: string;
  industry: string;
  size: string;
  website?: string;
  description?: string;
}

const companySchema = new Schema<ICompany>({
  name: { type: String, required: true },
  industry: { type: String, required: true },
  size: { type: String, required: true },
  website: { type: String },
  description: { type: String },
}, { timestamps: true });

export const Company = model<ICompany>("Company", companySchema);
