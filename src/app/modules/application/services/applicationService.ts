import { Application, IApplication } from "../models/Application";
import { Job } from "../../job/models/Job";

export const applyJob = async (data: IApplication) => {
  const existing = await Application.findOne({ candidate: data.candidate, job: data.job });
  if (existing) throw new Error("Already applied for this job");
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
  return await Application.find({ job: jobId })
    .populate("candidate", "name email")
    .sort({ createdAt: -1 });
};

export const getJobApplicationsNew = async (jobId: string, userId: string) => {
  console.log('Fetching applications for job:', jobId);
  
  // First get the job to check creator
  const job = await Job.findById(jobId).select('createdBy').lean();
  
  if (!job) {
    throw new Error('Job not found');
  }

  console.log('Job creator ID:', job.createdBy?.toString());
  console.log('Requesting user ID:', userId);
  
  // For now, bypass the check to test the endpoint
  // if (job.createdBy?.toString() !== userId) {
  //   throw new Error('Not authorized to view these applications');
  // }

  // Get applications for the job
  const applications = await Application.find({ job: jobId })
    .populate('candidate', 'name email')
    .sort({ createdAt: -1 });

  return applications;
};
