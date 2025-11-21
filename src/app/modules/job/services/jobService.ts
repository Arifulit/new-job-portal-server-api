// src/app/modules/job/services/jobService.ts
import { Job, IJob } from "../models/Job";
import { FilterQuery, Types } from "mongoose";

interface GetJobsOptions {
  filters?: FilterQuery<IJob>;
  sort?: Record<string, 1 | -1 | 'asc' | 'desc'>;
  skip?: number;
  limit?: number;
  select?: string;
  populate?: string | Record<string, string> | (string | Record<string, string>)[];
  company?: Types.ObjectId | string;
}

export interface IJobUpdateData extends Partial<Omit<IJob, 'createdBy' | 'createdAt' | 'updatedAt'>> {
  // Add any additional fields that can be updated
}

export const createJob = async (data: Omit<IJob, 'createdAt' | 'updatedAt'>) => {
  try {
    return await Job.create(data);
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

// export const getJobs = async (options: GetJobsOptions = {}) => {
//   const {
//     filters = {},
//     sort = { createdAt: -1 },
//     skip = 0,
//     limit = 10,
//     select = '',
//     populate = [
//       { path: 'createdBy', select: 'name email' },
//       { path: 'company', select: 'name logo' }
//     ],
//     company
//   } = options;

//   // Add company to filters if provided
//   if (company) {
//     filters.company = company;
//   }

//   try {
//     let query = Job.find(filters)
//       .sort(sort)
//       .skip(skip)
//       .limit(limit)
//       .select(select);

//     // Apply population with type assertions to avoid complex union types
//     if (populate) {
//       if (Array.isArray(populate)) {
//         // Type assertion to any[] to avoid complex union types
//         query = query.populate(populate as any[]);
//       } else {
//         // Type assertion for string or object populate
//         query = query.populate(populate as string | Record<string, string>);
//       }
//     }

//     return await query.lean().exec();
//   } catch (error) {
//     console.error('Error in getJobs service:', error);
//     throw new Error(`Failed to fetch jobs: ${error instanceof Error ? error.message : String(error)}`);
//   }
// };


export const getJobs = async (options: GetJobsOptions = {}) => {
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
      await Job.syncIndexes(); // Ensure text index exists
    }

    let query = Job.find(filters)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select(select);

    // Apply population with proper type handling
    if (populate) {
      if (Array.isArray(populate)) {
        populate.forEach(populateOption => {
          query = query.populate(populateOption);
        });
      } else {
        query = query.populate(populate);
      }
    }

    // If no text search, use regex for case-insensitive search on title and description
    if (!filters.$text && (filters.title || filters.description)) {
      const orConditions = [];
      if (filters.title) {
        orConditions.push({ title: { $regex: filters.title, $options: 'i' } });
        delete filters.title;
      }
      if (filters.description) {
        orConditions.push({ description: { $regex: filters.description, $options: 'i' } });
        delete filters.description;
      }
      if (orConditions.length > 0) {
        query = query.or(orConditions);
      }
    }

    // Handle location search with regex
    if (filters.location) {
      query = query.where('location', new RegExp(filters.location, 'i'));
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

    return await query.lean().exec();
  } catch (error) {
    console.error('Error in getJobs service:', error);
    throw new Error(`Failed to fetch jobs: ${error instanceof Error ? error.message : String(error)}`);
  }
};
export const closeJob = async (jobId: string, userId: Types.ObjectId | string) => {
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
    const isAdmin = req.user?.role === 'admin'; // Assuming role is available in req.user
    
    if (!isOwner && !isAdmin) {
      throw new Error('Not authorized to close this job');
    }
    
    // Update job status to closed
    job.status = 'closed';
    job.updatedAt = new Date();
    
    // Save and return the updated job
    const updatedJob = await job.save();
    return updatedJob.toObject();
    
  } catch (error) {
    console.error('Error in closeJob service:', error);
    throw error; // Re-throw to be handled by the controller
  }
};

export const getJobById = async (id: string) => {
  try {
    const job = await Job.findById(id)
      .populate('createdBy', 'name email')
      .populate('company', 'name logo')
      .lean()
      .exec();
    
    if (!job) {
      throw new Error('Job not found');
    }
    
    return job;
  } catch (error) {
    throw new Error(`Failed to get job: ${error instanceof Error ? error.message : String(error)}`);
  }
};