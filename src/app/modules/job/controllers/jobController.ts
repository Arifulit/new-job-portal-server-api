// এই controller job module এর request handle করে service layer এ পাঠায়।
import { Response, NextFunction, Request } from "express";
import fs from "fs";
import * as jobService from "../services/jobService";
import { AuthenticatedRequest } from "../../../../types/express";
import { IJobUpdateData, Job } from "../models/Job";
import { Types } from "mongoose";
import { User } from "../../auth/models/User";
import cloudinary from "../../../config/cloudinary";
import { Company } from "../../company/models/Company";

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

export const saveJob = async (
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) => {
  try {
    const authUserId = getAuthUserId(req.user);
    const { id } = req.params;

    if (!authUserId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job ID",
      });
    }

    const job = await Job.findById(id).select("_id status isApproved").lean();
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    if ((job as any).status !== "approved" || !(job as any).isApproved) {
      return res.status(400).json({
        success: false,
        message: "Only approved jobs can be saved",
      });
    }

    await User.findByIdAndUpdate(authUserId, {
      $addToSet: { savedJobs: (job as any)._id },
    });

    return res.status(200).json({
      success: true,
      message: "Job saved successfully",
    });
  } catch (error) {
    console.error("Error in saveJob:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save job",
    });
  }
};

export const unsaveJob = async (
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) => {
  try {
    const authUserId = getAuthUserId(req.user);
    const { id } = req.params;

    if (!authUserId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job ID",
      });
    }

    await User.findByIdAndUpdate(authUserId, {
      $pull: { savedJobs: new Types.ObjectId(id) },
    });

    return res.status(200).json({
      success: true,
      message: "Job removed from saved list",
    });
  } catch (error) {
    console.error("Error in unsaveJob:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to remove saved job",
    });
  }
};

export const getSavedJobs = async (
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
) => {
  try {
    const authUserId = getAuthUserId(req.user);

    if (!authUserId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const user = await User.findById(authUserId)
      .select("savedJobs")
      .populate({
        path: "savedJobs",
        select: "title company location salary jobType status isApproved createdAt",
      })
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const savedJobs = Array.isArray((user as any).savedJobs)
      ? (user as any).savedJobs.filter(Boolean)
      : [];

    return res.status(200).json({
      success: true,
      data: savedJobs,
      count: savedJobs.length,
    });
  } catch (error) {
    console.error("Error in getSavedJobs:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch saved jobs",
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

const getUploadedLogoFile = (req: Request): Express.Multer.File | undefined => {
  const uploadedFile = (req as any).file as Express.Multer.File | undefined;
  const uploadedFiles = (req as any).files as
    | Record<string, Express.Multer.File[]>
    | Express.Multer.File[]
    | undefined;

  if (uploadedFile) {
    return uploadedFile;
  }

  if (Array.isArray(uploadedFiles)) {
    return uploadedFiles[0];
  }

  return uploadedFiles?.logo?.[0] || uploadedFiles?.file?.[0] || uploadedFiles?.image?.[0];
};

const resolveCompanyId = (value: unknown): string | null => {
  if (typeof value === "string" && Types.ObjectId.isValid(value)) {
    return value;
  }

  if (value && typeof value === "object") {
    const nestedId = (value as { _id?: unknown })._id;
    if (typeof nestedId === "string" && Types.ObjectId.isValid(nestedId)) {
      return nestedId;
    }
    if (nestedId instanceof Types.ObjectId) {
      return nestedId.toString();
    }
  }

  return null;
};

const uploadLogoToCloudinary = async (file: Express.Multer.File): Promise<string> => {
  try {
    const cloudResult = await cloudinary.uploader.upload(file.path, {
      folder: "job-portal/company-logos",
      resource_type: "image",
      type: "upload",
    });

    return cloudResult.secure_url || cloudResult.url;
  } finally {
    if (file.path) {
      fs.unlink(file.path, () => {});
    }
  }
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

const normalizeEducation = (value: unknown): string[] | undefined => {
  if (Array.isArray(value)) {
    const cleaned = value.map((item) => String(item).trim()).filter(Boolean);
    return cleaned.length ? cleaned : undefined;
  }

  if (typeof value === "string") {
    const cleaned = value
      .split(/\r?\n|,|;/)
      .map((item) => item.trim())
      .filter(Boolean);
    return cleaned.length ? cleaned : undefined;
  }

  return undefined;
};

const normalizeTextList = (value: unknown): string[] | undefined => {
  if (Array.isArray(value)) {
    const cleaned = value.map((item) => String(item).trim()).filter(Boolean);
    return cleaned.length ? cleaned : undefined;
  }

  if (typeof value === "string") {
    const cleaned = value
      .split(/\r?\n|,|;/)
      .map((item) => item.trim())
      .filter(Boolean);
    return cleaned.length ? cleaned : undefined;
  }

  return undefined;
};

const normalizeGenderPreference = (
  value: unknown,
): "any" | "male" | "female" | "other" | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (["male", "female", "other", "any"].includes(normalized)) {
    return normalized as "any" | "male" | "female" | "other";
  }
  if (normalized === "men" || normalized === "man") return "male";
  if (normalized === "women" || normalized === "woman") return "female";
  return undefined;
};

const normalizeNumberField = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
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

  const normalizedEducation = normalizeEducation(
    normalizedPayload.education ?? normalizedPayload.educationalRequirements,
  );
  if (normalizedEducation !== undefined) {
    normalizedPayload.education = normalizedEducation;
  }

  const normalizedAdditionalRequirements = normalizeTextList(
    normalizedPayload.additionalRequirements ?? normalizedPayload.additionalRequirement,
  );
  if (normalizedAdditionalRequirements !== undefined) {
    normalizedPayload.additionalRequirements = normalizedAdditionalRequirements;
  }

  const normalizedBusinessAreas = normalizeTextList(
    normalizedPayload.businessAreas ?? normalizedPayload.businessArea,
  );
  if (normalizedBusinessAreas !== undefined) {
    normalizedPayload.businessAreas = normalizedBusinessAreas;
  }

  if (normalizedPayload.context !== undefined && normalizedPayload.jobContext === undefined) {
    normalizedPayload.jobContext = String(normalizedPayload.context);
  }

  const ageMin = normalizeNumberField(normalizedPayload.ageMin ?? normalizedPayload.minAge);
  const ageMax = normalizeNumberField(normalizedPayload.ageMax ?? normalizedPayload.maxAge);
  if (ageMin !== undefined) {
    normalizedPayload.ageMin = ageMin;
  }
  if (ageMax !== undefined) {
    normalizedPayload.ageMax = ageMax;
  }
  if (
    normalizedPayload.ageMin !== undefined &&
    normalizedPayload.ageMax !== undefined &&
    normalizedPayload.ageMin > normalizedPayload.ageMax
  ) {
    const temp = normalizedPayload.ageMin;
    normalizedPayload.ageMin = normalizedPayload.ageMax;
    normalizedPayload.ageMax = temp;
  }

  const genderPreference = normalizeGenderPreference(
    normalizedPayload.genderPreference ?? normalizedPayload.gender,
  );
  if (genderPreference !== undefined) {
    normalizedPayload.genderPreference = genderPreference;
  }

  if (
    normalizedPayload.preferredIndustryExperience === undefined &&
    normalizedPayload.industryExperience !== undefined
  ) {
    normalizedPayload.preferredIndustryExperience = String(
      normalizedPayload.industryExperience,
    );
  }

  const preferredExperienceYears = normalizeNumberField(
    normalizedPayload.preferredExperienceYears,
  );
  if (preferredExperienceYears !== undefined) {
    normalizedPayload.preferredExperienceYears = preferredExperienceYears;
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
  delete normalizedPayload.educationalRequirements;
  delete normalizedPayload.additionalRequirement;
  delete normalizedPayload.businessArea;
  delete normalizedPayload.context;
  delete normalizedPayload.minAge;
  delete normalizedPayload.maxAge;
  delete normalizedPayload.gender;
  delete normalizedPayload.industryExperience;

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
    // Debug logging to help diagnose req.body issues
    console.log("[createJob] req.body:", req.body);
    console.log("[createJob] req.file:", req.file);

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

    // Defensive: If req.body is undefined, return a clear error
    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: "No form data received. Make sure you are sending form-data and not raw JSON.",
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
    const uploadedLogoFile = getUploadedLogoFile(req);
    const uploadedLogoUrl = uploadedLogoFile ? await uploadLogoToCloudinary(uploadedLogoFile) : undefined;
    const companyId = resolveCompanyId(req.body.company);

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
      education: normalizeEducation(
        req.body.education ?? req.body.educationalRequirements,
      ),
      additionalRequirements: normalizeTextList(
        req.body.additionalRequirements ?? req.body.additionalRequirement,
      ),
      businessAreas: normalizeTextList(req.body.businessAreas ?? req.body.businessArea),
      jobContext: req.body.jobContext ?? req.body.context,
      ageMin: normalizeNumberField(req.body.ageMin ?? req.body.minAge),
      ageMax: normalizeNumberField(req.body.ageMax ?? req.body.maxAge),
      genderPreference: normalizeGenderPreference(
        req.body.genderPreference ?? req.body.gender,
      ),
      preferredIndustryExperience:
        req.body.preferredIndustryExperience ?? req.body.industryExperience,
      preferredExperienceYears: normalizeNumberField(req.body.preferredExperienceYears),
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

    if (companyId) {
      (jobData as any).company = companyId;
    }

    if (
      typeof (jobData as any).ageMin === "number" &&
      typeof (jobData as any).ageMax === "number" &&
      (jobData as any).ageMin > (jobData as any).ageMax
    ) {
      const temp = (jobData as any).ageMin;
      (jobData as any).ageMin = (jobData as any).ageMax;
      (jobData as any).ageMax = temp;
    }

    delete (jobData as any).responsibility;
    delete (jobData as any).requirement;
    delete (jobData as any).educationalRequirements;
    delete (jobData as any).additionalRequirement;
    delete (jobData as any).businessArea;
    delete (jobData as any).context;
    delete (jobData as any).minAge;
    delete (jobData as any).maxAge;
    delete (jobData as any).gender;
    delete (jobData as any).industryExperience;

    if (uploadedLogoUrl && companyId) {
      // Only allow admins to change company logo during job creation.
      if (req.user && req.user.role === "admin") {
        await Company.findByIdAndUpdate(
          companyId,
          { $set: { logo: uploadedLogoUrl } },
          { new: false },
        );

        if (typeof (jobData as any).company === "object" && (jobData as any).company !== null) {
          (jobData as any).company = { ...(jobData as any).company, logo: uploadedLogoUrl };
        }
      } else {
        // Recruiters are not allowed to update company logo here. Ignore uploaded logo.
        console.log("[createJob] recruiter attempted to upload company logo during job creation; ignoring upload.");
      }
    }

    const job = await jobService.createJob(jobData);
    return res.status(201).json({
      success: true,
      data: job,
    });
  } catch (error: any) {
    if (error?.code === "DUPLICATE_JOB" || error?.status === 409) {
      return res.status(409).json({
        success: false,
        message: error.message || "Same job already exists",
      });
    }

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

    const uploadedLogoFile = getUploadedLogoFile(req);
    const uploadedLogoUrl = uploadedLogoFile ? await uploadLogoToCloudinary(uploadedLogoFile) : undefined;
    const companyId = resolveCompanyId(req.body?.company ?? (job as any)?.company);

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid update fields provided",
      });
    }

    if (uploadedLogoUrl && companyId) {
      await Company.findByIdAndUpdate(
        companyId,
        { $set: { logo: uploadedLogoUrl } },
        { new: false },
      );

      (updateData as any).company = companyId;
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
    if (error?.code === "DUPLICATE_JOB" || error?.status === 409) {
      return res.status(409).json({
        success: false,
        message: error.message || "Same job already exists",
      });
    }

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
    // Check if this request came from the /recruiter/jobs route
    // req.baseUrl will be /recruiter, req.path will be /jobs
    const isRecruiterOwnJobsRoute = req.baseUrl?.includes("/recruiter") && req.path === "/jobs";

    if (isRecruiterOwnJobsRoute && req.user?.role === "recruiter") {
      if (!authUserId || !Types.ObjectId.isValid(authUserId)) {
        return res.status(401).json({
          success: false,
          message: "Invalid authenticated recruiter identity",
        });
      }

      queryFilters.createdBy = new Types.ObjectId(authUserId);
      console.log(`📋 Recruiter ${authUserId} fetching own jobs only (filtered by createdBy)`);

      // Recruiters should be able to query all of their own jobs, not only approved ones.
      if (req.query.status === undefined && req.query.isApproved === undefined) {
        delete queryFilters.status;
        delete queryFilters.isApproved;
      }
    }

    const results = await Promise.allSettled([
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
      Job.aggregate([
        { $match: queryFilters },
        {
          $group: {
            _id: null,
            totalVacancies: { $sum: { $ifNull: ["$vacancies", 0] } },
          },
        },
      ]),
    ]);

    // Handle results with fallbacks for failed operations
    const jobs = results[0].status === 'fulfilled' ? results[0].value : [];
    let total = results[1].status === 'fulfilled' ? results[1].value : jobs.length;
    const totalVacanciesAgg = results[2].status === 'fulfilled' ? results[2].value : [];
    const totalVacancies = totalVacanciesAgg[0]?.totalVacancies || 0;

    // Log any failures for monitoring
    if (results[0].status === 'rejected') {
      console.warn('⚠️ Failed to fetch jobs list:', results[0].reason?.message);
    }
    if (results[1].status === 'rejected') {
      console.warn('⚠️ Failed to count total jobs (using current list length as fallback):', results[1].reason?.message);
    }
    if (results[2].status === 'rejected') {
      console.warn('⚠️ Failed to aggregate vacancies:', results[2].reason?.message);
    }

    return res.status(200).json({
      success: true,
      data: jobs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        totalVacancies,
      },
    });
  } catch (error) {
    next(error);
  }
};
