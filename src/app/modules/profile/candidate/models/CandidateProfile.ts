import { Schema, model, Types } from "mongoose";

export interface ICandidateProfile {
  user: Types.ObjectId;
  name:string;
  phone: string;
  address?: string;
  skills?: string[];
  resume?: Types.ObjectId;
}

const candidateProfileSchema = new Schema<ICandidateProfile>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String },
  skills: [{ type: String }],
  resume: { type: Schema.Types.ObjectId, ref: "Resume" }
}, { timestamps: true });

export const CandidateProfile = model<ICandidateProfile>("CandidateProfile", candidateProfileSchema);
