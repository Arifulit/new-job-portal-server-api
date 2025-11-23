// src/app/modules/job/services/jobService.ts
import { Job, IJob } from "../models/Job";
import { FilterQuery, Types, PopulateOptions } from "mongoose";

interface GetJobsOptions {
  filters?: FilterQuery<IJob>;
  sort?: Record<string, 1 | -1 | 'asc' | 'desc'>;
  skip?: number;
  limit?: number;
  select?: string | string[];
  populate?: string | string[] | PopulateOptions | Array<string | PopulateOptions>;
  company?: Types.ObjectId | string;
}

export interface IJobUpdateData extends Partial<Omit<IJob, 'createdBy' | 'createdAt' | 'updatedAt'>> {
  // Add any additional fields that can be updated
}

export const createJob = async (data: Omit<IJob, 'createdAt' | 'updatedAt'>) => {
  try {
    // Set default status to pending for new jobs
    const jobData = {
      ...data,
      status: 'pending',
      isApproved: false
    };
    return await Job.create(jobData);
  } catch (error) {
    throw new Error(`Failed to create job: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const updateJob = async (id: string, data: IJobUpdateData) => {
  try {
    const job = await Job.findByIdAndUpdate(
      id,
      { 
        ...data,
        $currentDate: { updatedAt: true } // Ensure updatedAt is always updated
      },
      { new: true, runValidators: true }
    ).populate("createdBy", "name email");
    
    if (!job) {
      throw new Error("Job not found");
    }
    
    return job;
  } catch (error) {
    throw new Error(`Failed to update job: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const approveJob = async (jobId: string, adminId: Types.ObjectId | string) => {
  try {
    const job = await Job.findByIdAndUpdate(
      jobId,
      { 
        status: 'approved',
        isApproved: true,
        $unset: { rejectionReason: 1 }, // Remove rejection reason if any
        approvedBy: adminId,
        approvedAt: new Date()
      },
      { new: true }
    );

    if (!job) {
      throw new Error('Job not found');
    }

    return job;
  } catch (error) {
    throw new Error(`Failed to approve job: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const rejectJob = async (jobId: string, adminId: Types.ObjectId | string, reason: string) => {
  try {
    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      throw new Error('Rejection reason is required and must be at least 5 characters long');
    }

    const job = await Job.findByIdAndUpdate(
      jobId,
      { 
        status: 'rejected',
        isApproved: false,
        rejectionReason: reason,
        rejectedBy: adminId,
        rejectedAt: new Date()
      },
      { new: true }
    );

    if (!job) {
      throw new Error('Job not found');
    }

    return job;
  } catch (error) {
    throw new Error(`Failed to reject job: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const closeJob = async (jobId: string, userId: Types.ObjectId | string, userRole?: string) => {
  try {
    const job = await Job.findById(jobId);
    
    if (!job) {
      throw new Error('Job not found');
    }
    
    // Convert both IDs to strings for comparison
    const userIdStr = userId.toString();
    const createdByIdStr = job.createdBy?.toString();
    
    // Check if the user is the owner or admin
    const isOwner = createdByIdStr === userIdStr;
    const isAdmin = userRole === 'admin';
    
    if (!isOwner && !isAdmin) {
      throw new Error('Not authorized to close this job');
    }
    
    // Update job status to closed
    job.status = 'closed';
    job.closedAt = new Date();
    job.closedBy = userId;
    
    // Add to status history
    job.statusHistory = job.statusHistory || [];
    job.statusHistory.push({
      status: 'closed',
      changedBy: userId,
      changedAt: new Date(),
      reason: isAdmin ? 'Closed by admin' : 'Closed by job poster'
    });
    
    // Save and return the updated job
    const updatedJob = await job.save();
    
    // Populate necessary fields before returning
    return await Job.findById(updatedJob._id)
      .populate('createdBy', 'name email')
      .populate('company', 'name logo');
      
  } catch (error) {
    console.error('Error in closeJob service:', error);
    throw new Error(`Failed to close job: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const getPendingJobs = async (options: GetJobsOptions = {}): Promise<IJob[]> => {
  return getJobs({
    ...options,
    filters: { ...options.filters, status: 'pending' }
  });
};

export const getApprovedJobs = async (options: GetJobsOptions = {}): Promise<IJob[]> => {
  return getJobs({
    ...options,
    filters: { ...options.filters, status: 'approved', isApproved: true }
  });
};

export const getJobs = async (options: GetJobsOptions = {}): Promise<any[]> => {
  const {
    filters = {},
    sort = { createdAt: -1 },
    skip = 0,
    limit = 10,
    select = '',
    populate = [
      { path: 'createdBy', select: 'name email' },
      { path: 'company', select: 'name logo' }
    ],
    company
  } = options;

  // Add company to filters if provided
  if (company) {
    filters.company = company;
  }

  try {
    // Handle text search if search query is provided
    if (filters.$text) {
      await Job.syncIndexes();
    }

    // Build the query step by step with proper type assertions
    // Only show approved jobs by default if not otherwise specified
    if (!filters.status && !filters.isApproved) {
      filters.isApproved = true;
      filters.status = 'approved';
    }

    let query = Job.find(filters);

    // Apply sorting, skipping, and limiting
    query = query.sort(sort).skip(skip).limit(limit).select(select);

    // Apply population
    if (populate) {
      if (Array.isArray(populate)) {
        // Handle array of populate options
        query = query.populate(populate as (string | PopulateOptions)[]);
      } else if (typeof populate === 'string') {
        // Handle single string path
        query = query.populate(populate);
      } else {
        // Handle PopulateOptions object
        query = query.populate(populate as PopulateOptions);
      }
    }

    // Handle search conditions
    const conditions: any[] = [];
    
    // Handle title and description search
    if (!filters.$text) {
      if (filters.title) {
        conditions.push({ title: { $regex: filters.title, $options: 'i' } });
        delete filters.title;
      }
      if (filters.description) {
        conditions.push({ description: { $regex: filters.description, $options: 'i' } });
        delete filters.description;
      }
    }

    // Handle location search
    if (filters.location) {
      conditions.push({ location: new RegExp(filters.location, 'i') });
      delete filters.location;
    }

    // Handle array filters
    if (filters.jobType && Array.isArray(filters.jobType)) {
      query = query.where('jobType').in(filters.jobType);
      delete filters.jobType;
    }

    if (filters.experienceLevel && Array.isArray(filters.experienceLevel)) {
      query = query.where('experienceLevel').in(filters.experienceLevel);
      delete filters.experienceLevel;
    }

    // Apply remaining filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.where(key).equals(value);
      }
    });

    // Apply OR conditions if any
    if (conditions.length > 0) {
      query = query.or(conditions);
    }

    return await query.lean().exec();
  } catch (error) {
    console.error('Error in getJobs service:', error);
    throw new Error(`Failed to fetch jobs: ${error instanceof Error ? error.message : String(error)}`);
  }
};
export const deleteJob = async (id: string) => {
  try {
    const job = await Job.findByIdAndDelete(id);
    if (!job) {
      throw new Error('Job not found');
    }
    return job;
  } catch (error) {
    throw new Error(`Failed to delete job: ${error instanceof Error ? error.message : String(error)}`);
  }
};

interface PopulatedJob extends Omit<IJob, 'createdBy' | 'company'> {
  createdBy: { _id: Types.ObjectId; name: string; email: string };
  company: { _id: Types.ObjectId; name: string; logo?: string };
}

// In jobService.ts, ensure this export exists
export type LeanJob = Omit<IJob, keyof Document> & {
  _id: Types.ObjectId;
  __v: number;
  [key: string]: any; // Allow additional properties from Mongoose
};

export const getAllJobsForAdmin = async (options: GetJobsOptions = {}): Promise<LeanJob[]> => {
  try {
    const {
      filters = {},
      sort = { createdAt: -1 },
      skip = 0,
      limit = 10,
      populate = [
        { path: 'createdBy', select: 'name email role' },
        { path: 'company', select: 'name logo' }
      ]
    } = options;

    const jobs = await Job.find(filters)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate(populate)
      .lean();

    return jobs as LeanJob[];
  } catch (error) {
    console.error('Error in getAllJobsForAdmin service:', error);
    throw new Error(`Failed to fetch all jobs: ${error instanceof Error ? error.message : String(error)}`);
  }
};
export const getJobById = async (id: string): Promise<PopulatedJob> => {
  try {
    const job = await Job.findById(id)
      .populate<{ createdBy: { name: string; email: string } }>('createdBy', 'name email')
      .populate<{ name: string; logo?: string }>('company', 'name logo')
      .lean()
      .exec();
    
    if (!job) {
      throw new Error('Job not found');
    }
    
    return job as unknown as PopulatedJob;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get job';
    throw new Error(errorMessage);
  }
};