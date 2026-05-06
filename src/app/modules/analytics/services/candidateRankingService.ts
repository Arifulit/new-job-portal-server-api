import { Application } from "../../application/models/Application";
import { Job } from "../../job/models/Job";
import { CandidateProfile } from "../../profile/candidate/models/CandidateProfile";
import { scoreCandidateWithAI } from "../../../integrations/openai/aiRanker";

type RankingSource = "all_candidates" | "job" | "manual" | "candidates_only";
type UnknownRecord = Record<string, unknown>;

interface CandidateRecord extends UnknownRecord {
  candidateId?: string;
  applicationId?: string;
  name?: unknown;
  email?: unknown;
  skills?: unknown;
  experience?: unknown;
  education?: unknown;
  bio?: unknown;
  address?: unknown;
  profile?: unknown;
  application?: unknown;
}

interface JobRecord extends UnknownRecord {
  title?: unknown;
  description?: unknown;
  skills?: unknown;
  requirements?: unknown;
  responsibilities?: unknown;
  education?: unknown;
  additionalRequirements?: unknown;
  experience?: unknown;
  experienceLevel?: unknown;
  preferredExperienceYears?: unknown;
  preferredIndustryExperience?: unknown;
  createdBy?: unknown;
}

export interface CandidateRankingInput {
  jobId?: string;
  jobDescription?: string;
  candidates?: unknown;
  useAI?: boolean;
  requesterRole?: string;
  requesterId?: string;
}

export interface RankedCandidate {
  name: string;
  score: number;
  candidateId?: string;
  applicationId?: string;
  matchedSkills: string[];
  missingSkills: string[];
  experienceYears: number;
  educationMatch: boolean;
  reasons: string[];
  aiScore?: number;
  deterministicScore: number;
}

export interface CandidateRankingResult {
  success: true;
  rankingContext: RankingSource | `job:${string}`;
  jobId?: string;
  candidateCount: number;
  rankedCandidates: RankedCandidate[];
}

const EXPERIENCE_LEVEL_TARGETS: Record<string, number> = {
  entry: 0,
  junior: 1,
  mid: 3,
  "mid-level": 3,
  senior: 5,
  lead: 8,
  executive: 10,
};

const normalizeTokens = (value: string): string[] => {
  return value
    .toLowerCase()
    .match(/\b[a-zA-Z0-9.+#-]+\b/g)
    ?.map((token) => token.trim())
    .filter((token) => token.length > 1) || [];
};

const isRecord = (value: unknown): value is UnknownRecord => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const parseStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
};

const getCandidateSkills = (candidate: CandidateRecord): string[] => {
  return parseStringArray(candidate.skills).map((skill) => skill.toLowerCase());
};

const getCandidateExperienceYears = (candidate: CandidateRecord): number => {
  const experience = candidate.experience;

  if (typeof experience === "number" && Number.isFinite(experience)) {
    return Math.max(0, experience);





  }

  if (typeof experience === "string") {
    const matchedNumber = experience.match(/\d+(?:\.\d+)?/);
    return matchedNumber ? Math.max(0, Number(matchedNumber[0])) : 0;
  }

  if (Array.isArray(experience)) {
    let totalMonths = 0;

    for (const item of experience) {
      const startDate = item?.startDate ? new Date(item.startDate) : null;
      const endDate = item?.endDate ? new Date(item.endDate) : new Date();

      if (
        startDate &&
        !Number.isNaN(startDate.getTime()) &&
        !Number.isNaN(endDate.getTime()) &&
        endDate >= startDate
      ) {
        const diffMonths =
          (endDate.getFullYear() - startDate.getFullYear()) * 12 +
          (endDate.getMonth() - startDate.getMonth());
        totalMonths += Math.max(0, diffMonths);
      }
    }

    return Math.round((totalMonths / 12) * 10) / 10;
  }

  return 0;
};

const getCandidateEducationText = (candidate: CandidateRecord): string => {
  const education = Array.isArray(candidate.education) ? candidate.education : [];

  return education
    .map((item) => {
      if (!isRecord(item)) {
        return "";
      }

      return [item.degree, item.fieldOfStudy, item.institution].filter(Boolean).join(" ");
    })
    .join(" ")
    .trim();
};

const buildCandidateText = (candidate: CandidateRecord): string => {
  const parts = [
    candidate.name,
    candidate.bio,
    candidate.address,
    isRecord(candidate.resume) ? candidate.resume : String(candidate.resume ?? ""),
    getCandidateEducationText(candidate),
    Array.isArray(candidate.experience)
      ? candidate.experience
          .map((item) => {
            if (!isRecord(item)) {
              return "";
            }

            return [item.role, item.company, item.description].filter(Boolean).join(" ");
          })
          .join(" ")
      : "",
  ];

  return parts.filter(Boolean).join(" ").trim();
};

const buildJobDescription = (job: JobRecord): string => {
  const parts = [
    job.title,
    job.description,
    Array.isArray(job.skills) ? job.skills.join(" ") : "",
    Array.isArray(job.requirements) ? job.requirements.join(" ") : "",
    Array.isArray(job.responsibilities) ? job.responsibilities.join(" ") : "",
    Array.isArray(job.education) ? job.education.join(" ") : "",
    Array.isArray(job.additionalRequirements) ? job.additionalRequirements.join(" ") : "",
    job.experience,
    job.experienceLevel,
    job.preferredIndustryExperience,
  ];

  return parts.filter(Boolean).join(" ").trim();
};

const getExperienceTarget = (job: JobRecord): number => {
  if (typeof job.preferredExperienceYears === "number" && Number.isFinite(job.preferredExperienceYears)) {
    return Math.max(0, job.preferredExperienceYears);
  }

  if (typeof job.experience === "string") {
    const matchedNumber = job.experience.match(/\d+(?:\.\d+)?/);
    if (matchedNumber) {
      return Math.max(0, Number(matchedNumber[0]));
    }
  }

  const level = String(job.experienceLevel || "").toLowerCase();
  return EXPERIENCE_LEVEL_TARGETS[level] ?? 0;
};

const computeDeterministicScore = (jobDescription: string, candidate: CandidateRecord, job?: JobRecord | null) => {
  const jobSkillTokens = new Set(
    parseStringArray(job?.skills).flatMap((skill) => normalizeTokens(skill.toLowerCase())),
  );
  const descriptionTokens = new Set(normalizeTokens(jobDescription));
  const candidateSkills = new Set(getCandidateSkills(candidate));
  const candidateTextTokens = new Set(normalizeTokens(buildCandidateText(candidate)));
  const jobEducationTokens = new Set(
    parseStringArray(job?.education).flatMap((item) => normalizeTokens(item.toLowerCase())),
  );
  const candidateEducationTokens = new Set(normalizeTokens(getCandidateEducationText(candidate)));

  const matchedSkills: string[] = [];
  for (const token of jobSkillTokens.size > 0 ? jobSkillTokens : descriptionTokens) {
    if (candidateSkills.has(token)) {
      matchedSkills.push(token);
    }
  }

  const missingSkills = Array.from(jobSkillTokens.size > 0 ? jobSkillTokens : descriptionTokens).filter(
    (token) => !candidateSkills.has(token),
  );

  const skillBase = jobSkillTokens.size > 0 ? jobSkillTokens : descriptionTokens;
  const skillScore = skillBase.size
    ? (matchedSkills.length / skillBase.size) * 70
    : 0;

  const experienceYears = getCandidateExperienceYears(candidate);
  const targetExperience = job ? getExperienceTarget(job) : 0;
  const experienceScore = targetExperience > 0
    ? Math.min(experienceYears / targetExperience, 1) * 25
    : Math.min(experienceYears, 10) / 10 * 25;

  const educationMatch =
    jobEducationTokens.size === 0 ||
    Array.from(jobEducationTokens).some((token) => candidateEducationTokens.has(token));
  const educationScore = educationMatch ? 5 : 0;

  const keywordHits = Array.from(descriptionTokens).filter((token) => candidateTextTokens.has(token));
  const keywordScore = 0; // Keywords removed from scoring, kept only for reasons

  const rawScore = Math.round(skillScore + experienceScore + educationScore + keywordScore);

  const reasons = [
    matchedSkills.length > 0
      ? `Matched skills: ${matchedSkills.slice(0, 6).join(", ")}`
      : "No direct skill overlap found",
    targetExperience > 0
      ? `Experience: ${experienceYears.toFixed(1)}y against ${targetExperience}y target`
      : `Experience considered: ${experienceYears.toFixed(1)}y`,
    educationMatch
      ? "Education/profile terms align with the job"
      : "Education signal is weak or missing",
  ];

  if (keywordHits.length > 0) {
    reasons.push(`Keyword alignment: ${keywordHits.slice(0, 5).join(", ")}`);
  }

  return {
    score: Math.max(0, Math.min(100, rawScore)),
    matchedSkills,
    missingSkills,
    experienceYears,
    educationMatch,
    reasons,
  };
};

const parseCandidatesInput = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
};

const getAllCandidates = async () => {
  const profiles = (await CandidateProfile.find({})
    .populate("user", "name email")
    .sort({ createdAt: -1 })
    .lean()
    .exec()) as Array<UnknownRecord>;

  return profiles.map((profile) => ({
    candidateId: String(isRecord(profile.user) ? profile.user._id || profile.user.id || "" : profile._id || ""),
    name: isRecord(profile.user) ? profile.user.name || profile.name || "Unknown" : profile.name || "Unknown",
    email: isRecord(profile.user) ? profile.user.email || profile.email || "" : profile.email || "",
    skills: Array.isArray(profile.skills) ? profile.skills : [],
    experience: Array.isArray(profile.experience) ? profile.experience : 0,
    education: Array.isArray(profile.education) ? profile.education : [],
    bio: profile.bio || "",
    address: profile.address || "",
    profile,
  }));
};

const getApplicantsForJob = async (jobId: string) => {
  const job = (await Job.findById(jobId)
    .select(
      "title description skills requirements responsibilities education additionalRequirements experience experienceLevel preferredExperienceYears preferredIndustryExperience createdBy",
    )
    .lean()) as JobRecord | null;

  if (!job) {
    throw new Error("Job not found");
  }

  const applications = (await Application.find({ job: jobId, status: { $ne: "Withdrawn" } })
    .populate("candidate", "name email")
    .sort({ createdAt: -1 })
    .lean()
    .exec()) as Array<UnknownRecord>;

  const applicants = await Promise.all(
    applications.map(async (application) => {
      const candidateData = isRecord(application.candidate) ? application.candidate : null;
      const candidateUserId = String(
        candidateData?._id || candidateData?.id || application.candidate || "",
      ).trim();
      const profile = candidateUserId
        ? ((await CandidateProfile.findOne({ user: candidateUserId }).lean().exec()) as UnknownRecord | null)
        : null;

      return {
        applicationId: String(application._id || ""),
        candidateId: candidateUserId,
        name: candidateData?.name || profile?.name || "Unknown",
        email: candidateData?.email || profile?.email || "",
        skills: Array.isArray(profile?.skills) ? profile.skills : [],
        experience: Array.isArray(profile?.experience) ? profile.experience : 0,
        education: Array.isArray(profile?.education) ? profile.education : [],
        bio: profile?.bio || "",
        address: profile?.address || "",
        profile,
        application,
      };
    }),
  );

  return {
    job,
    jobDescription: buildJobDescription(job),
    applicants,
  };
};

const applyOwnershipGuard = (job: JobRecord | null, requesterRole?: string, requesterId?: string) => {
  if (!job || !requesterId) {
    return;
  }

  const role = String(requesterRole || "").toLowerCase().trim();
  if (role === "admin") {
    return;
  }

  const ownerId = String(job?.createdBy || "").trim();
  if (role === "recruiter" && ownerId && ownerId !== String(requesterId).trim()) {
    throw new Error("You can only rank candidates for jobs you posted");
  }
};

export async function rankCandidatesForRecruiter(
  input: CandidateRankingInput,
): Promise<CandidateRankingResult> {
  const useAI = Boolean(input.useAI);
  const parsedCandidates = parseCandidatesInput(input.candidates);

  let rankingContext: CandidateRankingResult["rankingContext"] = "all_candidates";
  let jobId: string | undefined;
  let jobDescription = String(input.jobDescription || "").trim();
  let candidates: CandidateRecord[] = [];
  let job: JobRecord | null = null;

  if (input.jobId) {
    const jobData = await getApplicantsForJob(String(input.jobId));
    job = jobData.job;
    jobId = String(input.jobId);
    applyOwnershipGuard(job, input.requesterRole, input.requesterId);
    jobDescription = jobDescription || jobData.jobDescription;
    candidates = jobData.applicants;
    rankingContext = `job:${jobId}`;
  } else if (parsedCandidates.length > 0 && jobDescription) {
    candidates = parsedCandidates as CandidateRecord[];
    rankingContext = "manual";
  } else if (parsedCandidates.length > 0) {
    candidates = parsedCandidates as CandidateRecord[];
    jobDescription = "Candidate Ranking";
    rankingContext = "candidates_only";
  } else {
    candidates = await getAllCandidates();
    jobDescription = "General Candidate Ranking";
    rankingContext = "all_candidates";
  }

  if (!jobDescription || candidates.length === 0) {
    throw new Error(
      "No candidates found. Provide jobId to rank job applicants, or send jobDescription + candidates array.",
    );
  }

  const scored = await Promise.all(
    candidates.map(async (candidate) => {
      const deterministic = computeDeterministicScore(jobDescription, candidate, job);
      let finalScore = deterministic.score;
      let aiScore: number | undefined;
      let reasons = [...deterministic.reasons];

      if (useAI) {
        try {
          const aiResult = await scoreCandidateWithAI(jobDescription, {
            name: String(candidate?.name || "Unknown"),
            skills: getCandidateSkills(candidate),
            experience: deterministic.experienceYears,
          });

          aiScore = aiResult.score;
          finalScore = Math.round(Math.min(100, deterministic.score * 0.7 + aiResult.score * 0.3));
          reasons = [...deterministic.reasons, ...aiResult.reasons.map((reason) => String(reason))];
        } catch (error) {
          reasons = [
            ...deterministic.reasons,
            `AI scoring failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          ];
        }
      }

      return {
        ...candidate,
        score: finalScore,
        deterministicScore: deterministic.score,
        aiScore,
        matchedSkills: deterministic.matchedSkills,
        missingSkills: deterministic.missingSkills,
        experienceYears: deterministic.experienceYears,
        educationMatch: deterministic.educationMatch,
        reasons,
      };
    }),
  );

  const rankedCandidates = scored
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      if (b.experienceYears !== a.experienceYears) {
        return b.experienceYears - a.experienceYears;
      }

      return (b.matchedSkills?.length || 0) - (a.matchedSkills?.length || 0);
    })
    .map((candidate) => ({
      name: String(candidate.name),
      score: candidate.score,
      candidateId: candidate.candidateId,
      applicationId: candidate.applicationId,
      matchedSkills: candidate.matchedSkills,
      missingSkills: candidate.missingSkills,
      experienceYears: candidate.experienceYears,
      educationMatch: candidate.educationMatch,
      reasons: candidate.reasons,
      aiScore: candidate.aiScore,
      deterministicScore: candidate.deterministicScore,
    }));

  return {
    success: true,
    rankingContext,
    ...(jobId ? { jobId } : {}),
    candidateCount: candidates.length,
    rankedCandidates,
  };
}