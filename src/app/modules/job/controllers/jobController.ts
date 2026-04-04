// src/app/modules/job/controllers/jobController.ts
import { Response, NextFunction } from "express";
import * as jobService from "../services/jobService";
import { AuthenticatedRequest } from "../../../../types/express";
import { IJobUpdateData, Job } from "../models/Job";
import { Types } from "mongoose";
import { User } from "../../auth/models/User";

const supportedJobTypes = new Set([
  "full-time",
  "remote",
  "part-time",
  "contract",
  "internship",
  "freelance",
]);

const getSingleQueryValue = (value: unknown): string | undefined => {
  if (Array.isArray(value)) {
    return value.find((item) => typeof item === "string" && item.trim())?.trim();
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    return trimmedValue || undefined;
  }

  return undefined;
};

const getMultipleQueryValues = (value: unknown): string[] => {
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

const normalizeJobTypeValue = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, "-");

const normalizeBooleanQuery = (value: unknown): boolean | undefined => {
  const rawValue = getSingleQueryValue(value)?.toLowerCase();

  if (rawValue === "true") {
    return true;
  }

  if (rawValue === "false") {
    return false;
  }

  return undefined;
};

const getNumericQueryValue = (value: unknown): number | undefined => {
  const rawValue = getSingleQueryValue(value);
  if (!rawValue) {
    return undefined;
  }

  const parsedValue = Number(rawValue);
  return Number.isFinite(parsedValue) ? parsedValue : undefined;
};

const normalizeStatusValue = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }

  const normalizedValue = value.toLowerCase();

  if (normalizedValue === "active" || normalizedValue === "open") {
    return "approved";
  }

  return normalizedValue;
};

const buildJobListFilters = (query: AuthenticatedRequest["query"]) => {
  const keywordAliases = [query.keyword, query.search, query.searchTerm, query.q];
  const keyword = keywordAliases.map(getSingleQueryValue).find(Boolean);
  const location = getSingleQueryValue(query.location) || getSingleQueryValue(query.city);
  const requestedJobTypes = getMultipleQueryValues(
    query.jobType ?? query.type ?? query.employmentType,
  ).map(normalizeJobTypeValue);
  const matchedJobTypes = requestedJobTypes.filter((value) => supportedJobTypes.has(value));
  const unmatchedJobTypes = requestedJobTypes.filter((value) => !supportedJobTypes.has(value));
  const experienceLevels = getMultipleQueryValues(query.experienceLevel).map((value) =>
    value.toLowerCase(),
  );
  const status = normalizeStatusValue(getSingleQueryValue(query.status));
  const isApproved = normalizeBooleanQuery(query.isApproved);
  const company = getSingleQueryValue(query.company);
  const salaryMin =
    getNumericQueryValue(query.salaryMin) ?? getNumericQueryValue(query.minSalary);
  const salaryMax =
    getNumericQueryValue(query.salaryMax) ?? getNumericQueryValue(query.maxSalary);
  const keywordTerms = [keyword, ...unmatchedJobTypes].filter(Boolean);

  const filters: Record<string, unknown> = {
    ...(keywordTerms.length ? { keyword: keywordTerms.join(" ") } : {}),
    ...(location ? { location } : {}),
    ...(matchedJobTypes.length ? { jobType: matchedJobTypes } : {}),
    ...(experienceLevels.length ? { experienceLevel: experienceLevels } : {}),
    ...(status ? { status } : {}),
    ...(typeof isApproved === "boolean" ? { isApproved } : {}),
    ...(company ? { company } : {}),
    ...(typeof salaryMin === "number" ? { salaryMin } : {}),
    ...(typeof salaryMax === "number" ? { salaryMax } : {}),
  };

  if (!status && typeof isApproved !== "boolean") {
    filters.status = "approved";
    filters.isApproved = true;
  }

  return filters;
};

const toIdString = (value: any): string | null => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Types.ObjectId) return value.toString();
  if (typeof value === "object" && value._id) return value._id.toString();
  return null;
};

const getAuthUserId = (user: AuthenticatedRequest["user"]): string | null => {
  return toIdString((user as any)?._id) || toIdString(user?.id);
};

export type AuthenticatedHandler = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => Promise<Response | void>;

// Get job by ID
export const getJobById = async (
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job ID",
      });
    }

    const job = await jobService.getJobById(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    const userRole = req.user?.role;
    const authUserId = getAuthUserId(req.user);

    if (userRole === "recruiter") {
      const creatorId = toIdString((job as any).createdBy);
      const isOwner = Boolean(authUserId && creatorId && creatorId === authUserId);

      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: "Recruiters can only view jobs they posted",
        });
      }
    }

    // Guests and candidates should only see approved jobs.
    if (!req.user || userRole === "candidate") {
      if ((job as any).status !== "approved" || !(job as any).isApproved) {
        return res.status(404).json({
          success: false,
          message: "Job not found",
        });
      }
    }

    // Admin can view every job; recruiter can view own jobs only.
    return res.status(200).json({
      success: true,
      data: job,
    });
  } catch (error) {
    console.error("Error in getJobById:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: {
        code: "INTERNAL_SERVER_ERROR",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
      },
    });
  }
};

// Input validation for job creation
const validateJobInput = (
  data: any,
): { isValid: boolean; message?: string } => {
  if (
    !data.title ||
    typeof data.title !== "string" ||
    data.title.trim().length < 5
  ) {
    return {
      isValid: false,
      message: "Title is required and must be at least 5 characters long",
    };
  }
  if (
    !data.description ||
    typeof data.description !== "string" ||
    data.description.trim().length < 20
  ) {
    return {
      isValid: false,
      message:
        "Description is required and must be at least 20 characters long",
    };
  }
  if (!data.location || typeof data.location !== "string") {
    return { isValid: false, message: "Location is required" };
  }
  return { isValid: true };
};

const normalizeResponsibilities = (value: unknown): string[] | undefined => {
  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => String(item).trim())
      .filter(Boolean);
    return cleaned.length ? cleaned : undefined;
  }

  if (typeof value === "string") {
    const cleaned = value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
    return cleaned.length ? cleaned : undefined;
  }

  return undefined;
};

const normalizeRequirements = (value: unknown): string[] | undefined => {
  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => String(item).trim())
      .filter(Boolean);
    return cleaned.length ? cleaned : undefined;
  }

  if (typeof value === "string") {
    const cleaned = value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
    return cleaned.length ? cleaned : undefined;
  }

  return undefined;
};

const normalizeJobUpdatePayload = (payload: Record<string, any>, isAdmin: boolean) => {
  const normalizedPayload = { ...payload };

  const normalizedResponsibilities = normalizeResponsibilities(
    normalizedPayload.responsibilities ?? normalizedPayload.responsibility,
  );

  if (normalizedResponsibilities !== undefined) {
    normalizedPayload.responsibilities = normalizedResponsibilities;
  }

  const normalizedRequirements = normalizeRequirements(
    normalizedPayload.requirements ?? normalizedPayload.requirement,
  );

  if (normalizedRequirements !== undefined) {
    normalizedPayload.requirements = normalizedRequirements;
  }

  if (normalizedPayload.type !== undefined && normalizedPayload.jobType === undefined) {
    normalizedPayload.jobType = normalizedPayload.type;
  }

  if (
    normalizedPayload.employmentType !== undefined &&
    normalizedPayload.jobType === undefined
  ) {
    normalizedPayload.jobType = normalizedPayload.employmentType;
  }

  if (normalizedPayload.city !== undefined && normalizedPayload.location === undefined) {
    normalizedPayload.location = normalizedPayload.city;
  }

  if (
    normalizedPayload.experience !== undefined &&
    normalizedPayload.experienceLevel === undefined
  ) {
    normalizedPayload.experienceLevel = inferExperienceLevel(normalizedPayload.experience);
  }

  if (normalizedPayload.salaryMin !== undefined && normalizedPayload.salary === undefined) {
    normalizedPayload.salary = normalizedPayload.salaryMin;
  }

  if (normalizedPayload.salary !== undefined && normalizedPayload.salaryMin === undefined) {
    normalizedPayload.salaryMin = normalizedPayload.salary;
  }

  delete normalizedPayload.type;
  delete normalizedPayload.employmentType;
  delete normalizedPayload.city;
  delete normalizedPayload.responsibility;
  delete normalizedPayload.requirement;

  // Immutable/system-managed fields should never be overwritten directly.
  delete normalizedPayload._id;
  delete normalizedPayload.__v;
  delete normalizedPayload.createdBy;
  delete normalizedPayload.createdAt;
  delete normalizedPayload.updatedAt;

  if (!isAdmin) {
    delete normalizedPayload.status;
    delete normalizedPayload.isApproved;
    delete normalizedPayload.rejectionReason;
    delete normalizedPayload.statusHistory;
    delete normalizedPayload.approvedAt;
    delete normalizedPayload.approvedBy;
    delete normalizedPayload.rejectedAt;
    delete normalizedPayload.rejectedBy;
    delete normalizedPayload.closedAt;
    delete normalizedPayload.closedBy;
  }

  return normalizedPayload;
};

const inferExperienceLevel = (
  experience?: string,
): "entry" | "mid-level" | "senior" | "lead" | "executive" => {
  const normalized = (experience || "").toLowerCase();
  if (
    normalized.includes("executive") ||
    normalized.includes("director") ||
    normalized.includes("10+") ||
    normalized.includes("12+")
  ) {
    return "executive";
  }
  if (
    normalized.includes("lead") ||
    normalized.includes("8+") ||
    normalized.includes("9+")
  ) {
    return "lead";
  }
  if (
    normalized.includes("senior") ||
    normalized.includes("5+") ||
    normalized.includes("6+") ||
    normalized.includes("7+")
  ) {
    return "senior";
  }
  if (
    normalized.includes("mid") ||
    normalized.includes("3-") ||
    normalized.includes("4-")
  ) {
    return "mid-level";
  }
  return "entry";
};

// Create a new job
export const createJob: AuthenticatedHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Only admin and recruiter can create jobs
    if (req.user.role !== "admin" && req.user.role !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Only admin and recruiters can create job postings",
      });
    }

    // Validate input
    const validation = validateJobInput(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.message || "Invalid job data",
      });
    }

    const experienceLevel =
      req.body.experienceLevel || inferExperienceLevel(req.body.experience);

    let autoApproveJob = req.user.role === "admin";

    if (req.user.role === "recruiter") {
      const recruiterUser = await User.findById(req.user.id)
        .select("isRecruiterApproved isSuspended role")
        .lean();

      if (!recruiterUser || recruiterUser.role !== "recruiter") {
        return res.status(403).json({
          success: false,
          message: "Recruiter account not found",
        });
      }

      if (recruiterUser.isSuspended) {
        return res.status(403).json({
          success: false,
          message: "Your account is suspended. Contact admin.",
        });
      }

      if (!recruiterUser.isRecruiterApproved) {
        return res.status(403).json({
          success: false,
          message: "Recruiter account is pending admin approval",
        });
      }

      autoApproveJob = true;
    }

    const jobData = {
      ...req.body,
      experienceLevel,
      responsibilities: normalizeResponsibilities(
        req.body.responsibilities ?? req.body.responsibility,
      ),
      requirements: normalizeRequirements(
        req.body.requirements ?? req.body.requirement,
      ),
      createdBy: new Types.ObjectId(req.user.id),
      status: autoApproveJob ? "approved" : "pending",
      isApproved: autoApproveJob,
      approvedAt: autoApproveJob ? new Date() : undefined,
      approvedBy: autoApproveJob ? new Types.ObjectId(req.user.id) : undefined,
      // Keep backward compatibility with old payload while preserving both fields.
      salary: req.body.salary ?? req.body.salaryMin,
      salaryMin: req.body.salaryMin,
      salaryMax: req.body.salaryMax,
      currency: req.body.currency || "BDT",
      experience: req.body.experience,
      deadline: req.body.deadline,
      vacancies: req.body.vacancies,
    };

    delete (jobData as any).responsibility;
  delete (jobData as any).requirement;

    const job = await jobService.createJob(jobData);
    return res.status(201).json({
      success: true,
      data: job,
    });
  } catch (error: any) {
    next(error);
  }
};

// Update job
export const updateJob: AuthenticatedHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const jobId = req.params.id;

    if (!jobId || !Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job ID format",
      });
    }

    // Get the job to check permissions
    const job = await jobService.getJobById(jobId);

    // Check permissions
    const isAdmin = req.user.role === "admin";
    const creatorId = toIdString((job as any).createdBy);
    const isOwner = creatorId === req.user.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this job",
      });
    }

    // Prepare update data
    const updateData: IJobUpdateData = normalizeJobUpdatePayload(
      req.body || {},
      isAdmin,
    );

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid update fields provided",
      });
    }

    // Validate the update data if needed
    if (
      updateData.title &&
      (typeof updateData.title !== "string" ||
        updateData.title.trim().length < 5)
    ) {
      return res.status(400).json({
        success: false,
        message: "Title must be at least 5 characters long",
      });
    }

    const updatedJob = await jobService.updateJob(jobId, updateData);

    return res.status(200).json({
      success: true,
      data: updatedJob,
    });
  } catch (error: any) {
    next(error);
  }
};

// Delete job
export const deleteJob: AuthenticatedHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const jobId = req.params.id;

    if (!jobId || !Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job ID format",
      });
    }

    // Get the job to check permissions
    const job = await jobService.getJobById(jobId);

    // Check permissions
    const isAdmin = req.user.role === "admin";
    const creatorId = toIdString((job as any).createdBy);
    const isOwner = creatorId === req.user.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this job",
      });
    }

    await jobService.deleteJob(jobId);

    return res.status(200).json({
      success: true,
      message: "Job deleted successfully",
    });
  } catch (error: any) {
    if (error.message === "Job not found") {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }
    next(error);
  }
};

// Close job (Admin only)
export const closeJob: AuthenticatedHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const jobId = req.params.jobId || req.params.id;

    if (!jobId || !Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job ID format",
      });
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can close jobs",
      });
    }

    const authUserId = getAuthUserId(req.user);
    if (!authUserId || !Types.ObjectId.isValid(authUserId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid authenticated user identity",
      });
    }

    const job = await jobService.closeJob(jobId, authUserId, req.user.role);

    return res.status(200).json({
      success: true,
      data: job,
      message: "Job closed successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Reject a job (Admin only)
export const rejectJob: AuthenticatedHandler = async (req, res, next) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can reject jobs",
      });
    }

    const { jobId } = req.params;
    const { reason } = req.body;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: "Job ID is required",
      });
    }

    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message:
          "Rejection reason is required and must be at least 5 characters long",
      });
    }

    const authUserId = getAuthUserId(req.user);
    if (!authUserId || !Types.ObjectId.isValid(authUserId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid authenticated user identity",
      });
    }

    const job = await jobService.rejectJob(jobId, authUserId, reason);

    return res.status(200).json({
      success: true,
      data: job,
      message: "Job rejected successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Get pending jobs (Admin only)
export const getPendingJobs: AuthenticatedHandler = async (req, res, next) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can view pending jobs",
      });
    }

    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    const sort: { [key: string]: 1 | -1 } = {};
    sort[String(sortBy)] = sortOrder === "asc" ? 1 : -1;

    const [jobs, total] = await Promise.all([
      jobService.getPendingJobs({
        filters: { status: "pending" },
        sort,
        skip,
        limit: limitNum,
        populate: [
          { path: "createdBy", select: "name email" },
          { path: "company", select: "name logo" },
        ],
      }),
      Job.countDocuments({ status: "pending" }),
    ]);

    return res.status(200).json({
      success: true,
      data: jobs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get approved jobs
export const getApprovedJobs: AuthenticatedHandler = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    const sort: { [key: string]: 1 | -1 } = {};
    sort[String(sortBy)] = sortOrder === "asc" ? 1 : -1;

    const [jobs, total] = await Promise.all([
      jobService.getApprovedJobs({
        filters: { status: "approved", isApproved: true },
        sort,
        skip,
        limit: limitNum,
        populate: [
          { path: "createdBy", select: "name email" },
          { path: "company", select: "name logo" },
        ],
      }),
      Job.countDocuments({ status: "approved", isApproved: true }),
    ]);

    return res.status(200).json({
      success: true,
      data: jobs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get all jobs with filtering and pagination
export const getAllJobs: AuthenticatedHandler = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    const sort: { [key: string]: 1 | -1 } = {};
    sort[String(sortBy)] = sortOrder === "asc" ? 1 : -1;

    const queryFilters = buildJobListFilters(req.query);
    const authUserId = getAuthUserId(req.user);

    if (req.user?.role === "recruiter") {
      if (!authUserId || !Types.ObjectId.isValid(authUserId)) {
        return res.status(401).json({
          success: false,
          message: "Invalid authenticated recruiter identity",
        });
      }

      queryFilters.createdBy = new Types.ObjectId(authUserId);

      // Recruiters should be able to query all of their own jobs, not only approved ones.
      if (req.query.status === undefined && req.query.isApproved === undefined) {
        delete queryFilters.status;
        delete queryFilters.isApproved;
      }
    }

    const [jobs, total] = await Promise.all([
      jobService.getJobs({
        filters: queryFilters,
        sort,
        skip,
        limit: limitNum,
        populate: [
          { path: "createdBy", select: "name email" },
          { path: "company", select: "name logo" },
        ],
      }),
      jobService.countJobs(queryFilters),
    ]);

    return res.status(200).json({
      success: true,
      data: jobs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};
