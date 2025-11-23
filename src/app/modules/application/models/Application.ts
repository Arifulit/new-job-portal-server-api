// import { Schema, model, Types } from "mongoose";

// export interface IApplication {
//   candidate: Types.ObjectId;
//   job: Types.ObjectId;
//   status: "Applied" | "Reviewed" | "Accepted" | "Rejected";
//   resume?: string;
//   coverLetter?: string;
// }

// const applicationSchema = new Schema<IApplication>({
//   candidate: { type: Schema.Types.ObjectId, ref: "User", required: true },
//   job: { type: Schema.Types.ObjectId, ref: "Job", required: true },
//   status: { type: String, enum: ["Applied", "Reviewed", "Accepted", "Rejected"], default: "Applied" },
//   resume: { type: String },
//   coverLetter: { type: String },
// }, { timestamps: true });

// export const Application = model<IApplication>("Application", applicationSchema);


// src/app/modules/application/models/Application.ts
import { Schema, model, Types } from "mongoose";

export interface IApplication {
  candidate: Types.ObjectId;
  job: Types.ObjectId;
  status: "Applied" | "Reviewed" | "Interview" | "Hired" | "Rejected" | "Shortlisted" | "Withdrawn";
  resume?: string;
  coverLetter?: string;
}

const applicationSchema = new Schema<IApplication>({
  candidate: { type: Schema.Types.ObjectId, ref: "User", required: true },
  job: { type: Schema.Types.ObjectId, ref: "Job", required: true },
  status: { 
    type: String, 
    enum: ["Applied", "Reviewed", "Interview", "Hired", "Rejected","Shortlisted","Withdrawn"], 
    default: "Applied" 
  },
  resume: { type: String },
  coverLetter: { type: String },
}, { timestamps: true });

export const Application = model<IApplication>("Application", applicationSchema);