import { Schema, model, Document, Types } from 'mongoose';

export interface IStatusHistory {
  status: 'pending' | 'approved' | 'rejected' | 'closed';
  changedBy: Types.ObjectId;
  changedAt: Date;
  reason?: string;
}

export interface IJobUpdateData {
  title?: string;
  description?: string;
  requirements?: string[];
  location?: string;
  jobType?: string;
  salary?: number;
  experienceLevel?: string;
  skills?: string[];
  status?: 'pending' | 'approved' | 'rejected' | 'closed';
  rejectionReason?: string;
  statusHistory?: IStatusHistory[];
  closedAt?: Date;
  closedBy?: Types.ObjectId;
  approvedAt?: Date;
  approvedBy?: Types.ObjectId;
  rejectedAt?: Date;
  rejectedBy?: Types.ObjectId;
}

export interface IJob extends Document {
  title: string;
  description: string;
  requirements: string[];
  location: string;
  jobType: string;
  salary?: number;
  experienceLevel?: string;
  skills: string[];
  createdBy: Schema.Types.ObjectId;
  company: Schema.Types.ObjectId; 
  status: 'pending' | 'approved' | 'rejected' | 'closed';
  isApproved: boolean;
  rejectionReason?: string;
  statusHistory: IStatusHistory[];
  closedAt?: Date;
  closedBy?: Types.ObjectId;
  approvedAt?: Date;
  approvedBy?: Types.ObjectId;
  rejectedAt?: Date;
  rejectedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const jobSchema = new Schema<IJob>({
  title: { type: String, required: true },
  description: { type: String, required: true },
  requirements: [{ type: String }],
  location: { type: String, required: true },
  jobType: { 
    type: String, 
    enum: ['full-time', 'part-time', 'contract', 'internship', 'freelance'],
    required: true 
  },
  salary: { type: Number },
  experienceLevel: { 
    type: String, 
    enum: ['entry', 'mid-level', 'senior', 'lead', 'executive'],
    required: true 
  },
  skills: [{ type: String }],
  createdBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  company: { 
    type: Schema.Types.ObjectId, 
    ref: 'Company',
    required: true 
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'closed'],
    default: 'pending'
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  rejectionReason: {
    type: String,
    default: ''
  },
  statusHistory: [{
    status: { 
      type: String, 
      enum: ['pending', 'approved', 'rejected', 'closed'],
      required: true 
    },
    changedBy: { 
      type: Schema.Types.ObjectId, 
      ref: 'User',
      required: true 
    },
    changedAt: { 
      type: Date, 
      default: Date.now 
    },
    reason: String
  }],
  closedAt: { type: Date },
  closedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  rejectedAt: { type: Date },
  rejectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { 
  timestamps: true,
  autoIndex: true 
});

// Create text index for search
jobSchema.index({
  title: 'text',
  description: 'text',
  requirements: 'text',
  skills: 'text'
}, {
  weights: {
    title: 10,
    requirements: 5,
    skills: 3,
    description: 1
  },
  name: 'job_search_index'
});

export const Job = model<IJob>('Job', jobSchema);