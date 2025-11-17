// import { Schema, model, Types } from "mongoose";

// export interface IEmployerProfile {
//   user: Types.ObjectId;
//   company: Types.ObjectId;
//   designation: string;
//   phone: string;
//   website?: string;
//   location?: string;
// }

// const employerProfileSchema = new Schema<IEmployerProfile>({
//   user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
//   company: { type: Schema.Types.ObjectId, ref: "Company", required: true },
//   designation: { type: String, required: true },
//   phone: { type: String, required: true },
//   website: { type: String },
//   location: { type: String }
// }, { timestamps: true });

// export const EmployerProfile = model<IEmployerProfile>("EmployerProfile", employerProfileSchema);
import { Schema, model, Types } from "mongoose";

export interface ICompany {
  name: string;
  industry?: string;
  size?: string;
  website?: string;
  description?: string;
}

const companySchema = new Schema<ICompany>({
  name: { type: String, required: true, unique: true },
  industry: { type: String },
  size: { type: String },
  website: { type: String },
  description: { type: String }
}, { timestamps: true });

export const Company = model<ICompany>("Company", companySchema);

// EmployerProfile model (keep existing)
export interface IEmployerProfile {
  user: Types.ObjectId;       // reference to User
  phone: string;
  company: Types.ObjectId;    // reference to Company
  designation: string;
}

const employerProfileSchema = new Schema<IEmployerProfile>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  phone: { type: String, required: true },
  company: { type: Schema.Types.ObjectId, ref: "Company", required: true },
  designation: { type: String, required: true },
}, { timestamps: true });

export const EmployerProfile = model<IEmployerProfile>("EmployerProfile", employerProfileSchema);