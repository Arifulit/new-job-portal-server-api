// এই service application module এর business rules এবং DB operations পরিচালনা করে।
import { Application, IApplication } from "../models/Application";
import { Job } from "../../job/models/Job";
import { Types } from "mongoose";

export const applyJob = async (data: IApplication) => {
  const existing = await Application.findOne({ candidate: data.candidate, job: data.job });
  if (existing) {
    if (existing.status === "Withdrawn") {
      existing.status = "Applied";
      existing.resume = data.resume ?? existing.resume;
      existing.downloadUrl = data.downloadUrl ?? existing.downloadUrl;
      existing.coverLetter = data.coverLetter ?? existing.coverLetter;
      await existing.save();
      return existing;
    }

    const duplicateError = new Error("Already applied for this job") as Error & {
      code?: string;
      status?: number;
    };
    duplicateError.code = "DUPLICATE_APPLICATION";
    duplicateError.status = 409;
    throw duplicateError;
  }
  const application = await Application.create(data);
  return application;
};

export const updateApplication = async (id: string, data: Partial<IApplication>) => {
  const application = await Application.findByIdAndUpdate(id, data, { new: true });
  if (!application) throw new Error("Application not found");
  return application;
};

export const getApplicationsByCandidate = async (candidateId: string) => {
  return await Application.find({ candidate: candidateId }).populate("job");
};

export const getApplicationsByJob = async (jobId: string) => {
  const query: any = { job: jobId };

  // Support ObjectId storage and legacy records that may have used `jobId`.
  if (Types.ObjectId.isValid(jobId)) {
    const objectId = new Types.ObjectId(jobId);
    query.$or = [
      { job: objectId },
      { job: jobId },
      { jobId: objectId },
      { jobId }
    ];
  }

  return await Application.find(query)
    .populate("candidate", "name email")
    .sort({ createdAt: -1 });
};

export const getJobApplicationsNew = async (jobId: string, userId: string) => {
  // Fetch applications for the job with populated candidate info
  const applications = await Application.find({ job: jobId })
    .populate('candidate', 'name email')
    .sort({ createdAt: -1 });
  return applications;


};
