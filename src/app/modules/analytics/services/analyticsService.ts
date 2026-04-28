import { Job } from "../../job/models/Job";
import { Application } from "../../application/models/Application";
import { Notification } from "../../notification/models/Notification";
import { CandidateProfile } from "../../profile/candidate/models/CandidateProfile";
import { Resume } from "../../profile/candidate/models/Resume";
import { analyzeResumeWithOpenAI } from "../../../integrations/openai/resumeParser";
import { getJobRecommendations } from "../../../integrations/openai/jobRecommender";
import OpenAI from "openai";

// Job Stats
export const getJobStats = async () => {
  const totalJobs = await Job.countDocuments();
  const activeJobs = await Job.countDocuments({ status: "Active" });
  const closedJobs = await Job.countDocuments({ status: "Closed" });
  return { totalJobs, activeJobs, closedJobs };
};

// Application Stats
export const getApplicationStats = async () => {
	const totalApplications = await Application.countDocuments();
	const pendingApplications = await Application.countDocuments({ status: "Applied" });
	const acceptedApplications = await Application.countDocuments({ status: "Accepted" });
	const rejectedApplications = await Application.countDocuments({ status: "Rejected" });

  return { totalApplications, pendingApplications, acceptedApplications, rejectedApplications };
};

// Candidate Engagement: Notification Stats
export const getCandidateEngagement = async () => {
  const totalNotifications = await Notification.countDocuments();
  const unreadNotifications = await Notification.countDocuments({ isRead: false });

  return { totalNotifications, unreadNotifications };
};

// Overall Dashboard Data
export const getDashboardStats = async () => {
  const jobs = await getJobStats();
  const applications = await getApplicationStats();
  const engagement = await getCandidateEngagement();

  return { jobs, applications, engagement };
};


// 1. Smart Candidate Ranking (Recruiter)
export const rankApplicantsForJob = async (jobId: string) => {
  const job = await Job.findById(jobId).lean();
  if (!job) throw new Error("Job not found");
  const applications = await Application.find({ job: jobId }).lean();
  const ranked = [];
  for (const app of applications) {
    let resumeText = "";
    if (app.resume) {
      // Assume resume is stored as text or fetch from file if needed
      resumeText = app.resume;
    } else {
      // Try to get from candidate profile
      const profile = await CandidateProfile.findOne({ user: app.candidate }).lean();
      resumeText = profile?.skills?.join(", ") || "";
    }
    // Use OpenAI or custom logic for scoring
    const analysis = await analyzeResumeWithOpenAI(resumeText);
    // Score: skills match + experience (simple version)
    const jobSkills = job.skills || [];
    const matchedSkills = analysis.skills?.filter((s: string) => jobSkills.includes(s)) || [];
    const skillScore = matchedSkills.length / (jobSkills.length || 1);
    const totalScore = Math.round((skillScore * 0.7 + (analysis.score || 0) / 100 * 0.3) * 100);
    ranked.push({
      application: app,
      score: totalScore,
      matchedSkills,
      missingSkills: jobSkills.filter((s: string) => !matchedSkills.includes(s)),
      suggestions: analysis.suggestions || [],
    });
  }
  // Sort by score descending
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
};

// 2. Skill Gap Analysis
export const getSkillGapForUserAndJob = async (userId: string, jobId: string) => {
  const profile = await CandidateProfile.findOne({ user: userId }).lean();
  const job = await Job.findById(jobId).lean();
  if (!profile || !job) throw new Error("Profile or Job not found");
  const userSkills = profile.skills || [];
  const jobSkills = job.skills || [];
  const missingSkills = jobSkills.filter((s: string) => !userSkills.includes(s));
  return { missingSkills };
};

// 3. AI Resume Builder
export const generateResumeFromProfile = async (userId: string) => {
  const profile = await CandidateProfile.findOne({ user: userId }).lean();
  if (!profile) throw new Error("Profile not found");
  // Use OpenAI to generate resume text
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = `Generate a professional resume in markdown format for the following profile.\nName: ${profile.name}\nSkills: ${(profile.skills || []).join(", ")}\nExperience: ${(profile.experience || []).map(e => `${e.role} at ${e.company}`).join("; ")}\nEducation: ${(profile.education || []).map(e => `${e.degree} at ${e.institution}`).join("; ")}`;
  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "You are a resume builder." },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 800,
  });
  const resumeMarkdown = completion.choices[0]?.message?.content || "";
  // Optionally convert markdown to PDF (not implemented here)
  return { resumeMarkdown };
};

// 4. Salary Prediction
export const predictSalary = async (userId: string, jobId?: string) => {
  const profile = await CandidateProfile.findOne({ user: userId }).lean();
  let job = null;
  if (jobId) job = await Job.findById(jobId).lean();
  if (!profile) throw new Error("Profile not found");
  // Use OpenAI to predict salary
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = `Estimate a fair salary range for a candidate with the following profile${job ? ` applying for this job: ${job.title}, location: ${job.location}` : ""}.\nSkills: ${(profile.skills || []).join(", ")}\nExperience: ${(profile.experience || []).map(e => `${e.role} at ${e.company}`).join("; ")}\nLocation: ${profile.address || "N/A"}`;
  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "You are a salary prediction assistant." },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 200,
  });
  const salaryText = completion.choices[0]?.message?.content || "";
  return { salaryText };
};
