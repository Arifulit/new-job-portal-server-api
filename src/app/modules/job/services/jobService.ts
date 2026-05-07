// এই service job search/filter/create/update business logic implement করে।
import { Job, IJob, buildJobUniquenessKey } from "../models/Job";
import { FilterQuery, Types, PopulateOptions } from "mongoose";

type ServiceError = Error & {
  code?: string;
  status?: number;
};

const createDuplicateJobError = (): ServiceError => {
  const error = new Error(
    "Duplicate job posting detected. Same title, company, location and job type cannot be created twice.",
  ) as ServiceError;
  error.code = "DUPLICATE_JOB";
  error.status = 409;
  return error;
};

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeFilterArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item).split(","))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const normalizeBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();

    if (normalizedValue === "true") {
      return true;
    }

    if (normalizedValue === "false") {
      return false;
    }
  }

  return undefined;
};

const normalizeNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsedValue = Number(value);
    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return undefined;
};

const buildJobQueryFilters = (
  filters: FilterQuery<IJob> = {},
  company?: Types.ObjectId | string,
): FilterQuery<IJob> => {
  const normalizedFilters: Record<string, unknown> = { ...filters };
  const andConditions: FilterQuery<IJob>[] = [];

  if (company) {
    normalizedFilters.company = company;
  }

  const keyword =
    typeof normalizedFilters.keyword === "string"
      ? normalizedFilters.keyword.trim()
      : "";
  delete normalizedFilters.keyword;

  if (keyword) {
    const keywordRegex = new RegExp(escapeRegex(keyword), "i");
    andConditions.push({
      $or: [
        { title: keywordRegex },
        { description: keywordRegex },
        { responsibilities: keywordRegex },
        { requirements: keywordRegex },
        { education: keywordRegex },
        { additionalRequirements: keywordRegex },
        { businessAreas: keywordRegex },
        { jobContext: keywordRegex },
        { preferredIndustryExperience: keywordRegex },
        { skills: keywordRegex },
        { location: keywordRegex },
      ],
    });
  }

  if (
    typeof normalizedFilters.title === "string" &&
    normalizedFilters.title.trim()
  ) {
    andConditions.push({
      title: new RegExp(escapeRegex(normalizedFilters.title.trim()), "i"),
    });
  }
  delete normalizedFilters.title;

  if (
    typeof normalizedFilters.description === "string" &&
    normalizedFilters.description.trim()
  ) {
    andConditions.push({
      description: new RegExp(
        escapeRegex(normalizedFilters.description.trim()),
        "i",
      ),
    });
  }
  delete normalizedFilters.description;

  if (
    typeof normalizedFilters.location === "string" &&
    normalizedFilters.location.trim()
  ) {
    andConditions.push({
      location: new RegExp(escapeRegex(normalizedFilters.location.trim()), "i"),
    });
  }
  delete normalizedFilters.location;

  const jobTypes = normalizeFilterArray(normalizedFilters.jobType);
  if (jobTypes.length === 1) {
    normalizedFilters.jobType = jobTypes[0];
  } else if (jobTypes.length > 1) {
    normalizedFilters.jobType = { $in: jobTypes };
  } else {
    delete normalizedFilters.jobType;
  }

  const experienceLevels = normalizeFilterArray(normalizedFilters.experienceLevel);
  if (experienceLevels.length === 1) {
    normalizedFilters.experienceLevel = experienceLevels[0];
  } else if (experienceLevels.length > 1) {
    normalizedFilters.experienceLevel = { $in: experienceLevels };
  } else {
    delete normalizedFilters.experienceLevel;
  }

  const isApproved = normalizeBoolean(normalizedFilters.isApproved);
  if (isApproved !== undefined) {
    normalizedFilters.isApproved = isApproved;
  } else {
    delete normalizedFilters.isApproved;
  }

  const salaryMin = normalizeNumber(normalizedFilters.salaryMin);
  const salaryMax = normalizeNumber(normalizedFilters.salaryMax);
  delete normalizedFilters.salaryMin;
  delete normalizedFilters.salaryMax;

  if (salaryMin !== undefined && salaryMax !== undefined) {
    andConditions.push({
      $or: [
        { salary: { $gte: salaryMin, $lte: salaryMax } },
        { salaryMin: { $gte: salaryMin, $lte: salaryMax } },
        { salaryMax: { $gte: salaryMin, $lte: salaryMax } },
        {
          $and: [
            { salaryMin: { $lte: salaryMax } },
            { salaryMax: { $gte: salaryMin } },
          ],
        },
      ],
    });
  } else if (salaryMin !== undefined) {
    andConditions.push({
      $or: [
        { salary: { $gte: salaryMin } },
        { salaryMin: { $gte: salaryMin } },
        { salaryMax: { $gte: salaryMin } },
      ],
    });
  } else if (salaryMax !== undefined) {
    andConditions.push({
      $or: [
        { salary: { $lte: salaryMax } },
        { salaryMin: { $lte: salaryMax } },
      ],
    });
  }

  Object.entries(normalizedFilters).forEach(([key, value]) => {
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    ) {
      delete normalizedFilters[key];
    }
  });

  if (andConditions.length === 0) {
    return normalizedFilters as FilterQuery<IJob>;
  }

  return {
    ...(normalizedFilters as FilterQuery<IJob>),
    $and: andConditions,
  };
};

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

export const getJobById = async (id: string) => {
  try {
    const job = await Job.findById(id)
      .populate('createdBy', 'name email')
      .populate('company', 'name logo');
    
    if (!job) {
      throw new Error('Job not found');
    }
    
    return job;
  } catch (error) {
    throw new Error(`Failed to get job: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const createJob = async (data: Omit<IJob, 'createdAt' | 'updatedAt'>) => {
  try {
    const jobKey = buildJobUniquenessKey({
      createdBy: (data as any).createdBy,
      company: (data as any).company,
      title: (data as any).title,
      location: (data as any).location,
      jobType: (data as any).jobType,
    });

    const existingJob = await Job.findOne({ jobKey }).select("_id").lean();
    if (existingJob) {
      throw createDuplicateJobError();
    }

    // Default to pending unless caller explicitly sets approval state.
    const jobData = {
      ...data,
      jobKey,
      status: data.status ?? 'pending',
      isApproved: data.isApproved ?? false
    };
    return await Job.create(jobData);
  } catch (error) {
    if ((error as any)?.code === 11000) {
      throw createDuplicateJobError();
    }

    if ((error as ServiceError)?.code === "DUPLICATE_JOB") {
      throw error;
    }

    throw new Error(`Failed to create job: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const updateJob = async (id: string, data: IJobUpdateData) => {
  try {
    const currentJob = await Job.findById(id)
      .select("createdBy company title location jobType")
      .lean();

    if (!currentJob) {
      throw new Error("Job not found");
    }

    const nextJobKey = buildJobUniquenessKey({
      createdBy: (data as any).createdBy ?? (currentJob as any).createdBy,
      company: (data as any).company ?? (currentJob as any).company,
      title: (data as any).title ?? (currentJob as any).title,
      location: (data as any).location ?? (currentJob as any).location,
      jobType: (data as any).jobType ?? (currentJob as any).jobType,
    });

    const conflictJob = await Job.findOne({
      _id: { $ne: id },
      jobKey: nextJobKey,
    })
      .select("_id")
      .lean();

    if (conflictJob) {
      throw createDuplicateJobError();
    }

    const job = await Job.findByIdAndUpdate(
      id,
      { 
        ...data,
        jobKey: nextJobKey,
        $currentDate: { updatedAt: true } // Ensure updatedAt is always updated
      },
      { new: true, runValidators: true }
    )
      .populate("createdBy", "name email")
      .populate("company", "name logo");
    
    if (!job) {
      throw new Error("Job not found");
    }
    
    return job;
  } catch (error) {
    if ((error as any)?.code === 11000) {
      throw createDuplicateJobError();
    }

    if ((error as ServiceError)?.code === "DUPLICATE_JOB") {
      throw error;
    }

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
    if (!userId) {
      throw new Error('User ID is required to close job');
    }

    const job = await Job.findById(jobId);
    
    if (!job) {
      throw new Error('Job not found');
    }
    
    // Convert both IDs to strings for comparison
    const userIdStr = typeof userId === 'string' ? userId : userId.toString();
    const createdBySource = (job.createdBy as any)?._id ?? job.createdBy;
    const createdByIdStr = createdBySource ? createdBySource.toString() : null;
    
    // Check if the user is the owner or admin
    const isOwner = createdByIdStr === userIdStr;
    const isAdmin = userRole === 'admin';
    
    if (!isOwner && !isAdmin) {
      throw new Error('Not authorized to close this job');
    }
    
    // Update job status to closed
    job.status = 'closed';
    job.closedAt = new Date();
    job.closedBy = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    
    // Add to status history
    job.statusHistory = job.statusHistory || [];
    job.statusHistory.push({
      status: 'closed',
      changedBy: typeof userId === 'string' ? new Types.ObjectId(userId) : userId,
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

  try {
    // Only show approved jobs by default if not otherwise specified
    if (!filters.status && !filters.isApproved) {
      filters.isApproved = true;
      filters.status = 'approved';
    }

    const queryFilters = buildJobQueryFilters(filters, company);

    let query = Job.find(queryFilters);

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

    return await query.lean().exec();
  } catch (error) {
    console.error('Error in getJobs service:', error);
    throw new Error(`Failed to fetch jobs: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const countJobs = async (
  filters: FilterQuery<IJob> = {},
  company?: Types.ObjectId | string,
): Promise<number> => {
  try {
    const queryFilters = buildJobQueryFilters(filters, company);
    // Add timeout to prevent indefinite hanging on database connection issues
    return await Job.countDocuments(queryFilters).maxTimeMS(5000);
  } catch (error) {
    console.error('Error in countJobs service:', error);
    // Log detailed error info for debugging
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ countJobs failed:', { errorMsg, filters });
    throw new Error(`Failed to count jobs: ${errorMsg}`);
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

export type JobCreator = { _id: Types.ObjectId; name: string; email: string };
export type JobCompany = { _id: Types.ObjectId; name: string; logo?: string };

export type LeanJob = Omit<IJob, keyof Document> & {
  _id: Types.ObjectId;
  __v: number;
  createdBy: Types.ObjectId | JobCreator;
  company: Types.ObjectId | JobCompany;
  [key: string]: any; // For any additional properties that might be present
};

export const getJobsByCreatorRole = async (
  role?: string,
  options: GetJobsOptions = {}
): Promise<LeanJob[]> => {
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

    let queryFilters = { ...filters };

    if (role) {
      // First, find users with the specified role
      const { User } = await import('../../auth/models/User');
      const users = await User.find({ role }).select('_id').lean();
      const userIds = users.map((user: { _id: Types.ObjectId }) => user._id);

      if (userIds.length === 0) {
        return [];
      }

      // Add user filter to find jobs created by these users
      queryFilters = {
        ...queryFilters,
        createdBy: { $in: userIds }
      };
    }

    // Get jobs with pagination and sorting
    const jobs = await Job.find(queryFilters)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate(Array.isArray(populate) ? populate : [populate])
      .lean();

    return jobs as unknown as LeanJob[];
  } catch (error) {
    console.error('Error in getJobsByCreatorRole service:', error);
    throw new Error(`Failed to fetch jobs by creator role: ${error instanceof Error ? error.message : String(error)}`);
  }
};