/* eslint-disable @typescript-eslint/no-explicit-any */
// এই controller application request handle করে auth check সহ service call চালায়।
import { Request, Response, RequestHandler, NextFunction } from "express";
import * as applicationService from "../services/applicationService";
import { Job } from "../../job/models/Job";
import { Application } from "../models/Application";
import { User } from "../../auth/models/User";
import { Types, Document } from "mongoose";
import { RecruiterProfile } from "../../profile/recruiter/models/RecruiterProfile";
import { CandidateProfile } from "../../profile/candidate/models/CandidateProfile";
import { Resume } from "../../profile/candidate/models/Resume";
import { createNotification } from "../../notification/services/notificationService";
import {
  sendApplicationStatusUpdatedEmail,
  sendApplicationSubmittedEmail,
} from "../services/applicationEmailService";
import cloudinary from "../../../config/cloudinary";
import { env } from "../../../config/env";
import fs from "fs";
import axios from "axios";

type UserRole = 'admin' | 'recruiter' | 'candidate' | 'employer' | 'user';

// Interface for job with populated createdBy field
interface JobWithCreatedBy extends Document {
  _id: Types.ObjectId;
  createdBy?: {
    _id: Types.ObjectId;
    [key: string]: any;
  };
  [key: string]: any;
}

// ✅ Public URL build করো — signed URL expire হয়, public URL হয় না
const createPublicRawUrl = (
  publicId: string,
  version?: number,
  attachment?: boolean,
): string => {
  return cloudinary.url(publicId, {
    resource_type: "raw",
    type: "upload",
    secure: true,
    sign_url: false,
    version,
    flags: attachment ? "attachment" : undefined,
  });
};

// ✅ Resume links build করো — source (view) এবং download আলাদা
const buildResumeLinks = (url?: string): { sourceUrl: string | undefined; downloadUrl: string | undefined } => {
  if (!url || typeof url !== "string") {
    return { sourceUrl: url, downloadUrl: url };
  }

  // Already has fl_attachment → this is download url
  if (url.includes("fl_attachment")) {
    return {
      sourceUrl: url.replace("/fl_attachment/", "/"),
      downloadUrl: url,
    };
  }

  // Raw Cloudinary URL → add fl_attachment for download
  if (url.includes("/raw/upload/")) {
    // Strip any existing signed segment (s--...--) for clean public URL
    const cleanUrl = url.replace(/\/s--[^/]+--/, "");
    const downloadUrl = cleanUrl.replace("/raw/upload/", "/raw/upload/fl_attachment/");
    return {
      sourceUrl: cleanUrl,
      downloadUrl,
    };
  }

  return { sourceUrl: url, downloadUrl: url };
};

// ✅ Cloudinary raw asset থেকে publicId এবং version extract করো
const extractCloudinaryRawAsset = (url?: string): { publicId: string; version?: number } | null => {
  if (!url || typeof url !== "string") {
    return null;
  }

  const withoutQuery = url.split("?")[0];
  // Support both signed (s--...--) and unsigned URLs
  const match = withoutQuery.match(/\/raw\/upload\/(?:s--[^/]+--\/)?(?:fl_attachment\/)?(?:v(\d+)\/)?(.+)$/);
  if (!match) {
    return null;
  }

  const version = match[1] ? Number(match[1]) : undefined;
  const publicId = decodeURIComponent(match[2]);

  if (!publicId) {
    return null;
  }

  return {
    publicId,
    version: version && Number.isFinite(version) ? version : undefined,
  };
};

// ✅ Uploaded file টা request থেকে বের করো (multer single বা fields উভয় support)
const getUploadedApplicationFile = (req: Request): Express.Multer.File | undefined => {
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

  return uploadedFiles?.resume?.[0] || uploadedFiles?.file?.[0];
};

// ✅ Resume stream করো — view (inline) বা download (attachment)
const streamResumeFromUrl = async (
  resumeUrl: string,
  res: Response,
  disposition: "inline" | "attachment",
): Promise<void> => {
  // Clean any signed segment before streaming
  const cleanUrl = resumeUrl.replace(/\/s--[^/]+--/, "");
  const targetUrl = disposition === "attachment"
    ? cleanUrl.replace("/raw/upload/", "/raw/upload/fl_attachment/")
    : cleanUrl;

  try {
    console.log(`🔗 Streaming resume (${disposition}):`, targetUrl.substring(0, 120));

    const response = await axios.get(targetUrl, {
      responseType: "stream",
      timeout: 15000,
    });

    const contentType = response.headers["content-type"] || "application/pdf";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `${disposition}; filename="resume.pdf"`);
    res.setHeader("Cache-Control", "no-cache");
    response.data.pipe(res);
    return;
  } catch (error: any) {
    const status = error?.response?.status;
    console.error(`❌ Stream failed (status ${status}):`, error.message);

    // Fallback: try to regenerate public URL from stored publicId
    if ((status === 401 || status === 403 || status === 404)) {
      try {
        const asset = extractCloudinaryRawAsset(resumeUrl);
        if (asset?.publicId) {
          console.log(`🔄 Regenerating public URL for publicId:`, asset.publicId);
          const regeneratedUrl = createPublicRawUrl(asset.publicId, asset.version, disposition === "attachment");
          console.log(`🔗 Retrying with regenerated URL:`, regeneratedUrl.substring(0, 120));

          const retryResponse = await axios.get(regeneratedUrl, {
            responseType: "stream",
            timeout: 15000,
          });

          res.setHeader("Content-Type", retryResponse.headers["content-type"] || "application/pdf");
          res.setHeader("Content-Disposition", `${disposition}; filename="resume.pdf"`);
          res.setHeader("Cache-Control", "no-cache");
          retryResponse.data.pipe(res);
          return;
        }
      } catch (retryError: any) {
        console.error(`❌ Retry also failed:`, retryError.message);
        throw retryError;
      }
    }

    throw error;
  }
};

// ✅ ObjectId বা string যেকোনো value থেকে string ID বের করো
const toIdString = (value: any): string | null => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Types.ObjectId) return value.toString();
  if (typeof value === "object") {
    if (value._id) return toIdString(value._id);
    const str = value.toString();
    if (str !== "[object Object]") return str;
  }
  return null;
};

// ✅ Recruiter-এর organization ID বের করো (profile থেকে fallback সহ)
const resolveRecruiterOrgId = async (user: any): Promise<string | null> => {
  const directOrgId =
    toIdString(user?.company) ||
    toIdString(user?.companyId) ||
    toIdString(user?.agency) ||
    toIdString(user?.agencyId);

  if (directOrgId) return directOrgId;

  const authUserId = toIdString(user?._id) || toIdString(user?.id);
  if (!authUserId) return null;

  const recruiterProfile = await RecruiterProfile.findOne({ user: authUserId })
    .select("company agency")
    .lean();

  return (
    toIdString((recruiterProfile as any)?.company) ||
    toIdString((recruiterProfile as any)?.agency) ||
    null
  );
};

const getLatestCandidateResumeUrl = async (
  candidateUserId: string,
): Promise<string | undefined> => {
  const byUserId = await Resume.findOne({ candidate: candidateUserId })
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

  if (byUserId?.fileUrl) {
    return byUserId.fileUrl;
  }

  const candidateProfile = await CandidateProfile.findOne({ user: candidateUserId })
    .select("_id")
    .lean();

  if (!candidateProfile?._id) {
    return undefined;
  }

  const byProfileId = await Resume.findOne({ candidate: candidateProfile._id })
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

  return byProfileId?.fileUrl;
};

const getRecruiterOwnedJobIds = async (userId: string): Promise<string[]> => {
  if (!userId) {
    return [];
  }

  const jobs = await Job.find({ createdBy: userId }).select("_id").lean();
  return jobs.map((job: any) => String(job._id));
};

export type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    role: UserRole;
    email?: string;
  };
};

// ============================================================
// ✅ APPLY JOB — resume upload করে application submit করো
// ============================================================
export const applyJob = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { job, jobId, resume, resumeUrl, coverLetter } = req.body;
    const jobToApply = jobId || job;

    if (!jobToApply) {
      return res.status(400).json({ success: false, message: "Job ID is required" });
    }

    if (!Types.ObjectId.isValid(String(jobToApply))) {
      return res.status(400).json({ success: false, message: "Invalid job ID format" });
    }

    const targetJob = await Job.findById(jobToApply)
      .select("_id title status isApproved createdBy")
      .lean();

    if (!targetJob) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    if (targetJob.status !== "approved" || !targetJob.isApproved) {
      return res.status(400).json({
        success: false,
        message: "You can only apply to approved jobs",
      });
    }

    if (toIdString((targetJob as any).createdBy) === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot apply to your own job",
      });
    }

    const applicationData: any = {
      job: jobToApply,
      candidate: req.user.id,
      status: "Applied",
    };

    let uploadedDownloadUrl: string | undefined;

    // ── File upload via FormData (multer) ──
    const uploadedFile = getUploadedApplicationFile(req);
    if (uploadedFile) {
      try {
        console.log("📤 Uploading resume to Cloudinary:", uploadedFile.originalname);

        const cloudResult = await cloudinary.uploader.upload(uploadedFile.path, {
          folder: "application-resumes",
          resource_type: "raw",
          type: "upload",
          access_mode: "public",       // ✅ public রাখতে হবে
          public_id: `app_resume_${req.user.id}_${Date.now()}`,
          overwrite: true,
          // ❌ sign_url এখানে দেওয়া যাবে না — public URL চাই
        });

        // ✅ Public URL — কখনো expire হবে না
        const publicViewUrl = createPublicRawUrl(cloudResult.public_id, cloudResult.version, false);
        uploadedDownloadUrl = createPublicRawUrl(cloudResult.public_id, cloudResult.version, true);

        applicationData.resume = publicViewUrl;

        console.log("✅ Resume uploaded successfully");
        console.log("📁 Public ID:", cloudResult.public_id);
        console.log("🔗 View URL:", publicViewUrl);
        console.log("⬇️  Download URL:", uploadedDownloadUrl);

        // Temp file মুছে ফেলো
        fs.unlink(uploadedFile.path, (err) => {
          if (err) console.warn("⚠️ Could not delete temp file:", uploadedFile.path);
        });
      } catch (uploadError: any) {
        console.error("❌ Cloudinary upload failed:", uploadError.message);
        return res.status(500).json({
          success: false,
          message: "Failed to upload resume to cloud storage",
          error: uploadError.message,
        });
      }
    } else if (resume || resumeUrl) {
      // Body থেকে URL পাঠালে সরাসরি নাও
      applicationData.resume = resume || resumeUrl;
    } else {
      const storedResumeUrl = await getLatestCandidateResumeUrl(req.user.id);
      if (storedResumeUrl) {
        applicationData.resume = storedResumeUrl;
      }
    }

    if (!applicationData.resume) {
      return res.status(400).json({
        success: false,
        message: "Resume is required. Please upload resume before applying.",
      });
    }

    if (coverLetter) {
      applicationData.coverLetter = coverLetter;
    }

    // Application save করো
    const application = await applicationService.applyJob(applicationData);
    const applicationObj: any = (application as any).toObject ? (application as any).toObject() : application;

    const candidateUser = await User.findById(req.user.id).select("name email").lean();
    if (candidateUser?.email) {
      try {
        await sendApplicationSubmittedEmail({
          to: candidateUser.email,
          candidateName: candidateUser.name,
          jobTitle: (targetJob as any)?.title,
        });
      } catch (mailError: any) {
        console.warn("Failed to send application confirmation email:", mailError?.message || mailError);
      }
    }

    const recruiterId = toIdString((targetJob as any).createdBy);
    if (recruiterId && recruiterId !== req.user.id) {
      await createNotification({
        userId: recruiterId,
        type: "Application",
        message: "A new application has been submitted for one of your jobs.",
        relatedId: (application as any)._id,
      });
    }

    // ✅ Response-এ clean public URL দাও
    const resumeLinks = buildResumeLinks(applicationObj?.resume);
    applicationObj.resume = resumeLinks.sourceUrl;
    applicationObj.downloadUrl = uploadedDownloadUrl || resumeLinks.downloadUrl;

    return res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      data: applicationObj,
    });
  } catch (err: any) {
    console.error("Error submitting application:", err);
    const statusCode =
      err.status ||
      (err.code === "DUPLICATE_APPLICATION" ? 409 : undefined) ||
      (err.name === "ValidationError" ? 400 : 500);
    return res.status(statusCode).json({
      success: false,
      message:
        err.code === "DUPLICATE_APPLICATION"
          ? "You have already applied for this job"
          : err.message || "An error occurred while submitting the application",
      error: process.env.NODE_ENV === "development" ? err : undefined,
    });
  }
};

// ============================================================
// ✅ PREVIEW RESUME — browser-এ inline দেখাও
// ============================================================
export const previewApplicationResume = async (req: Request, res: Response) => {
  try {
    const application = await Application.findById(req.params.id).select("resume");

    if (!application?.resume) {
      return res.status(404).json({ success: false, message: "Resume not found" });
    }

    const resumeUrl = application.resume as string;
    if (!resumeUrl || typeof resumeUrl !== "string") {
      return res.status(400).json({ success: false, message: "Invalid resume URL stored" });
    }

    await streamResumeFromUrl(resumeUrl, res, "inline");
  } catch (error: any) {
    if (!res.headersSent) {
      const status = error?.response?.status;
      const statusCode = status >= 400 && status < 500 ? status : 500;
      const message =
        status === 401
          ? "Resume link expired. Please ask candidate to re-upload resume."
          : status === 404
          ? "Resume file not found in storage"
          : error.message || "Error opening resume";

      console.error("❌ Error streaming resume preview:", error.message);
      return res.status(statusCode).json({ success: false, message });
    } else {
      console.error("❌ Error streaming resume (headers sent):", error.message);
      res.end();
    }
  }
};

// ============================================================
// ✅ DOWNLOAD RESUME — attachment হিসেবে download করো
// ============================================================
export const downloadApplicationResume = async (req: Request, res: Response) => {
  try {
    const application = await Application.findById(req.params.id).select("resume");

    if (!application?.resume) {
      return res.status(404).json({ success: false, message: "Resume not found" });
    }

    const resumeUrl = application.resume as string;
    if (!resumeUrl || typeof resumeUrl !== "string") {
      return res.status(400).json({ success: false, message: "Invalid resume URL stored" });
    }

    await streamResumeFromUrl(resumeUrl, res, "attachment");
  } catch (error: any) {
    if (!res.headersSent) {
      const status = error?.response?.status;
      const statusCode = status >= 400 && status < 500 ? status : 500;
      const message =
        status === 401
          ? "Resume link expired. Please ask candidate to re-upload resume."
          : status === 404
          ? "Resume file not found in storage"
          : error.message || "Error downloading resume";

      console.error("❌ Error streaming resume download:", error.message);
      return res.status(statusCode).json({ success: false, message });
    } else {
      console.error("❌ Error streaming resume download (headers sent):", error.message);
      res.end();
    }
  }
};

// ============================================================
// ✅ UPDATE APPLICATION — status update করো (recruiter/admin)
// ============================================================
export const updateApplication = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { id } = req.params;
    const { status, interviewScheduledAt } = req.body;
    const userRole = req.user.role;
    const userId = req.user.id || toIdString((req.user as any)?._id) || "";

    // Case-insensitive status normalize - recruiters can set: Applied, Reviewed, Shortlisted, Interview, Rejected, Accepted
    const statusMap: Record<string, "Applied" | "Reviewed" | "Shortlisted" | "Interview" | "Rejected" | "Accepted"> = {
      applied: "Applied",
      reviewed: "Reviewed",
      shortlisted: "Shortlisted",
      interview: "Interview",
      interviewed: "Interview",
      rejected: "Rejected",
      accepted: "Accepted",
      hired: "Accepted",
    };

    const normalizedStatus =
      typeof status === "string" && status.trim().length > 0
        ? statusMap[status.trim().toLowerCase()]
        : undefined;

    if (status && !normalizedStatus) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be one of: Applied, Reviewed, Shortlisted, Interview, Rejected, Accepted",
      });
    }

    const normalizedInterviewScheduledAt =
      typeof interviewScheduledAt === "string" && interviewScheduledAt.trim().length > 0
        ? interviewScheduledAt.trim()
        : "";

    if (normalizedStatus === "Interview" && !normalizedInterviewScheduledAt) {
      return res.status(400).json({
        success: false,
        message: "Interview date and time are required when changing status to Interview",
      });
    }

    const application = await Application.findById(id).populate({
      path: "job",
      select: "createdBy company title",
      options: { lean: true },
    });

    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    if (!application.job) {
      return res.status(404).json({ success: false, message: "Associated job not found" });
    }

    // Admin can update any application. Recruiter can update only applications of their own jobs.
    if (userRole === "recruiter") {
      const jobCreatorId = toIdString((application as any).job?.createdBy);
      if (!jobCreatorId || jobCreatorId !== userId) {
        return res.status(403).json({
          success: false,
          message: "You can only update applications for jobs you created",
        });
      }
    }

    if (userRole !== "admin" && userRole !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this application",
      });
    }

    application.status = normalizedStatus || application.status;
  application.set("interviewScheduledAt", normalizedStatus === "Interview" ? normalizedInterviewScheduledAt : undefined);
    await application.save();

    const candidateId = toIdString((application as any).candidate);
    if (candidateId) {
      const candidateUser = await User.findById(candidateId).select("name email").lean();
      if (candidateUser?.email) {
        try {
          await sendApplicationStatusUpdatedEmail({
            to: candidateUser.email,
            candidateName: candidateUser.name,
            status: application.status as "Applied" | "Reviewed" | "Shortlisted" | "Interview" | "Rejected" | "Accepted",
            jobTitle: (application as any).job?.title,
            interviewScheduledAt: normalizedStatus === "Interview" ? normalizedInterviewScheduledAt : undefined,
          });
        } catch (mailError: any) {
          console.warn("Failed to send application status update email:", mailError?.message || mailError);
        }
      }
    }

    if (candidateId) {
      const notificationMessage =
        normalizedStatus === "Interview" && normalizedInterviewScheduledAt
          ? `Your interview for ${(application as any).job?.title} has been scheduled for ${normalizedInterviewScheduledAt}.`
          : `Your application status has been updated to ${application.status}.`;

      await createNotification({
        userId: candidateId,
        type: "Application",
        message: notificationMessage,
        relatedId: (application as any)._id,
      });
    }

    const updatedApp = await Application.findById(application._id)
      .populate("candidate", "name email")
      .populate({
        path: "job",
        select: "title company",
        populate: { path: "createdBy", select: "name email" },
      });

    return res.status(200).json({
      success: true,
      data: updatedApp,
      message: "Application status updated successfully",
    });
  } catch (error: any) {
    console.error("Error updating application:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error updating application",
      error: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
};

// ============================================================
// ✅ GET CANDIDATE APPLICATIONS — নিজের সব applications দেখো
// ============================================================
export const getCandidateApplications = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const applications = await applicationService.getApplicationsByCandidate(req.user.id);
    return res.status(200).json({ success: true, data: applications });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// ============================================================
// ✅ GET JOB APPLICATIONS — একটা job-এর সব applications (admin/recruiter)
// ============================================================
export const getJobApplications = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { jobId } = req.params;
    const { status } = req.query as { status?: string };
    const userId = req.user.id || toIdString((req.user as any)?._id) || "";
    const userRole = req.user.role;

    if (!jobId || !Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ success: false, message: "Invalid job ID format" });
    }

    const job = await Job.findById(jobId).select("createdBy").populate("createdBy", "_id").lean();
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    // Admin সব দেখতে পারবে
    if (userRole === "admin") {
      let applications = await applicationService.getApplicationsByJob(jobId);
      if (status) applications = applications.filter((app: any) => app.status === status);
      return res.status(200).json({ success: true, data: applications });
    }

    // Recruiter নিজের company-র jobs দেখতে পারবে
    if (userRole === "recruiter") {
      const jobCreatorId = toIdString((job as any).createdBy);
      if (!jobCreatorId || jobCreatorId !== userId) {
        return res.status(403).json({
          success: false,
          message: "You can only view applications for jobs you created",
        });
      }

      let applications = await applicationService.getApplicationsByJob(jobId);
      if (status) applications = applications.filter((app: any) => app.status === status);
      return res.status(200).json({ success: true, data: applications });
    }

    return res.status(403).json({ success: false, message: "Not authorized" });
  } catch (error: any) {
    console.error("Error fetching job applications:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching job applications",
      error: error.message,
    });
  }
};

// ============================================================
// ✅ GET JOB APPLICATIONS (NEW) — creator check সহ
// ============================================================
export const getJobApplicationsNew = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    const { jobId } = req.params;
    if (!jobId) {
      return res.status(400).json({ success: false, message: "Job ID is required" });
    }

    const userId = toIdString((req.user as any)?._id) || toIdString(req.user.id);
    const userRole = req.user.role;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const job = await Job.findById(jobId)
      .select("createdBy")
      .populate("createdBy", "_id")
      .lean<JobWithCreatedBy>();

    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    if (userRole === "admin") {
      const applications = await applicationService.getApplicationsByJob(jobId);
      return res.status(200).json({ success: true, data: applications });
    }

    if (userRole === "recruiter") {
      const jobCreatorId = toIdString((job as any).createdBy);
      if (!jobCreatorId || jobCreatorId !== userId) {
        return res.status(403).json({
          success: false,
          message: "You can only view applications for jobs you created",
        });
      }
      const applications = await applicationService.getApplicationsByJob(jobId);
      return res.status(200).json({ success: true, data: applications });
    }

    return res.status(403).json({ success: false, message: "Not authorized to access this resource" });
  } catch (err: any) {
    console.error("Error in getJobApplicationsNew:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch job applications",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// ============================================================
// ✅ GET ALL APPLICATIONS — সব applications (admin)
// ============================================================
export const getJobAllApplications = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  try {
    if (req.user.role === "recruiter") {
      const ownedJobIds = await getRecruiterOwnedJobIds(req.user.id);
      const applications = ownedJobIds.length > 0
        ? await Application.find({ job: { $in: ownedJobIds } })
            .populate("candidate", "name email")
            .populate({
              path: "job",
              select: "title company createdBy",
              populate: { path: "createdBy", select: "name email" },
            })
            .sort({ createdAt: -1 })
            .lean()
        : [];

      return res.status(200).json({
        success: true,
        data: applications,
        count: applications.length,
      });
    }

    const applications = await Application.find({})
      .populate("candidate", "name email")
      .populate({
        path: "job",
        select: "title company createdBy",
        populate: { path: "createdBy", select: "name email" },
      })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: applications,
      count: applications.length,
    });
  } catch (error: any) {
    console.error("Error in getJobAllApplications:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch applications",
    });
  }
};

// ============================================================
// ✅ WITHDRAW APPLICATION — candidate নিজে withdraw করবে
// ============================================================
export const withdrawApplication = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  try {
    const { id } = req.params;
    const userId = req.user.id;

    const application = await Application.findById(id)
      .populate("candidate", "id")
      .populate("job", "createdBy");

    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    if (application.candidate._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to withdraw this application",
      });
    }

    application.status = "Withdrawn";
    await application.save();

    return res.status(200).json({
      success: true,
      message: "Application withdrawn successfully",
      data: application,
    });
  } catch (error: any) {
    console.error("Error withdrawing application:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error withdrawing application",
      error: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
};

// ============================================================
// ✅ GET APPLICATIONS BY USER — paginated, with role check
// ============================================================
export const getApplicationsByUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ success: false, message: "userId required" });

    const requesterId = req.user?.id || "";
    const role = req.user?.role;

    if (requesterId !== userId && role !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const page = Math.max(1, parseInt(String(req.query.page || 1), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || 10), 10)));
    const skip = (page - 1) * limit;

    const [applications, total] = await Promise.all([
      Application.find({ candidate: userId })
        .populate({ path: "job", select: "title company location status" })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      Application.countDocuments({ candidate: userId }),
    ]);

    return res.status(200).json({
      success: true,
      data: applications,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    next(err);
  }
};

// ============================================================
// ✅ GET APPLICATION COUNT BY USER
// ============================================================
export const getApplicationCountByUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ success: false, message: "userId required" });

    const requesterId = req.user?.id || "";
    const role = req.user?.role;

    if (requesterId !== userId && role !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const count = await Application.countDocuments({ candidate: userId });
    return res.status(200).json({ success: true, data: { userId, count } });
  } catch (err: any) {
    next(err);
  }
};

// ============================================================
// ✅ DIAGNOSE RESUME URL — debug endpoint
// ============================================================
export const diagnoseResumeUrl = async (req: Request, res: Response) => {
  try {
    const { resumeUrl, applicationId } = req.query;

    if (applicationId) {
      const application = await Application.findById(applicationId as string).select("resume");
      if (!application?.resume) {
        return res.status(404).json({ success: false, message: "Application or resume not found" });
      }

      const testUrl = application.resume as string;
      const asset = extractCloudinaryRawAsset(testUrl);
      const regeneratedUrl = asset?.publicId
        ? createPublicRawUrl(asset.publicId, asset.version)
        : null;

      let accessible = false;
      let httpStatus: number | undefined;
      try {
        const headResponse = await axios.head(testUrl, { timeout: 5000 });
        accessible = true;
        httpStatus = headResponse.status;
      } catch (e: any) {
        httpStatus = e?.response?.status;
      }

      return res.status(200).json({
        success: true,
        data: {
          applicationId,
          storedUrl: testUrl,
          accessible,
          httpStatus,
          extractedAsset: asset,
          regeneratedUrl,
          cloudinaryConfig: { cloud_name: env.CLOUDINARY_CLOUD_NAME },
        },
      });
    }

    if (resumeUrl) {
      const asset = extractCloudinaryRawAsset(resumeUrl as string);
      let accessible = false;
      let httpStatus: number | undefined;
      try {
        const headResponse = await axios.head(resumeUrl as string, { timeout: 5000 });
        accessible = true;
        httpStatus = headResponse.status;
      } catch (e: any) {
        httpStatus = e?.response?.status;
      }

      return res.status(200).json({
        success: accessible,
        message: accessible ? "URL is accessible" : "URL access failed",
        data: {
          urlTestResult: accessible ? "accessible" : "not-accessible",
          httpStatus,
          extractedAsset: asset,
          canRegenerate: !!asset?.publicId,
        },
      });
    }

    return res.status(400).json({
      success: false,
      message: "Provide either 'resumeUrl' or 'applicationId' query parameter",
    });
  } catch (error: any) {
    console.error("❌ Error in resume URL diagnosis:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error diagnosing resume URL",
    });
  }
};

// ============================================================
// 🧪 CLOUDINARY TEST — test cloudinary configuration
// ============================================================
export const testCloudinaryConfig = async (req: Request, res: Response) => {
  try {
    console.log("🧪 Testing Cloudinary Configuration...");

    const config = cloudinary.config();
    const hasCloud = !!config.cloud_name;
    const hasKey = !!config.api_key;
    const hasSecret = !!config.api_secret;

    console.log(`   Cloud Name: ${hasCloud ? "✅" : "❌"} ${config.cloud_name ? `(${config.cloud_name})` : "MISSING"}`);
    console.log(`   API Key: ${hasKey ? "✅" : "❌"} ${hasKey ? "(set)" : "MISSING"}`);
    console.log(`   API Secret: ${hasSecret ? "✅" : "❌"} ${hasSecret ? "(set)" : "MISSING"}`);

    if (!hasCloud || !hasKey || !hasSecret) {
      return res.status(400).json({
        success: false,
        message: "Cloudinary not properly configured",
        config: {
          cloud_name: hasCloud,
          api_key: hasKey,
          api_secret: hasSecret,
        },
      });
    }

    // Try to ping Cloudinary API
    try {
      const result = await cloudinary.api.ping();
      console.log(`   ✅ Cloudinary API is reachable`);
      
      return res.status(200).json({
        success: true,
        message: "Cloudinary is properly configured and reachable",
        config: {
          cloud_name: config.cloud_name,
          api_key_set: hasKey,
          api_secret_set: hasSecret,
        },
        apiResponse: result,
      });
    } catch (apiError: any) {
      console.error(`   ❌ Cloudinary API error:`, apiError.message);
      return res.status(500).json({
        success: false,
        message: "Cloudinary API is not responding",
        error: apiError.message,
      });
    }
  } catch (error: any) {
    console.error("❌ Error testing Cloudinary:", error);
    return res.status(500).json({
      success: false,
      message: "Error testing Cloudinary configuration",
      error: error.message,
    });
  }
};

// ============================================================
// 🧪 TEST URL ACCESSIBILITY — check if URL is accessible
// ============================================================
export const testUrlAccessibility = async (req: Request, res: Response) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== "string") {
      return res.status(400).json({
        success: false,
        message: "Provide 'url' query parameter",
      });
    }

    console.log(`🧪 Testing URL accessibility: ${url.substring(0, 100)}...`);

    try {
      const response = await axios.head(url, {
        timeout: 10000,
      });

      console.log(`✅ URL is accessible (status: ${response.status})`);
      return res.status(200).json({
        success: true,
        message: "URL is accessible",
        url,
        status: response.status,
        contentType: response.headers["content-type"],
      });
    } catch (error: any) {
      const status = error?.response?.status;
      console.error(`❌ URL not accessible (status: ${status}):`, error.message);

      return res.status(200).json({
        success: false,
        message: "URL is not accessible",
        url,
        status,
        error: error.message,
        suggestion: status === 401 || status === 403
          ? "URL requires authentication or is forbidden. Public access might not be enabled."
          : status === 404
          ? "URL resource not found."
          : "Check URL format or Cloudinary configuration",
      });
    }
  } catch (error: any) {
    console.error("❌ Error testing URL:", error);
    return res.status(500).json({
      success: false,
      message: "Error testing URL",
      error: error.message,
    });
  }
};