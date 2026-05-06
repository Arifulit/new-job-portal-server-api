
// routes/candidate/candidateRankRoutes.ts
import { Router, json } from "express";
import multer from "multer";
import authMiddleware from "../../../../middleware/auth";
import { rankCandidatesForRecruiter } from "../../../analytics/services/candidateRankingService";
import { CandidateProfile } from "../../candidate/models/CandidateProfile";

const router = Router();
const upload = multer();

// GET all candidates with ranking
router.get(
  "/",
  authMiddleware(["recruiter", "admin"]),
  async (req, res) => {
    try {
      // Get all candidate profiles with user details
      const candidates = await CandidateProfile.find()
        .populate("user", "name email avatar")
        .lean()
        .exec();

      if (!candidates || candidates.length === 0) {
        return res.json({
          success: true,
          message: "No candidates found",
          candidateCount: 0,
          data: [],
        });
      }

      // Calculate a basic ranking score for each candidate
      const candidatesWithScore = candidates.map((candidate: Record<string, unknown>) => {
        const user = candidate.user as Record<string, unknown> | undefined;
        return {
        name: (user?.name as string) || (candidate.name as string) || "Unknown",
        email: (user?.email as string) || "N/A",
        avatar: (user?.avatar as string) || "",
        skills: (candidate.skills as unknown[]) || [],
        experience: (candidate.experience as unknown[]) || [],
        education: (candidate.education as unknown[]) || [],
        bio: (candidate.bio as string) || "",
        score: calculateCandidateScore(candidate),
        candidateId: candidate._id,
        userId: user?._id,
      };
      });

      // Sort by score descending
      candidatesWithScore.sort((a, b) => b.score - a.score);

      return res.json({
        success: true,
        message: "All candidates retrieved successfully",
        candidateCount: candidatesWithScore.length,
        data: candidatesWithScore,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch candidates",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// GET ranked candidates (with optional filtering by job)
router.get(
  "/ranked",
  authMiddleware(["recruiter", "admin"]),
  async (req, res) => {
    try {
      const jobId = req.query.jobId as string | undefined;
      const aiQuery = String(req.query.ai || "").toLowerCase().trim();
      const useAI = aiQuery === "true" || aiQuery === "1" || aiQuery === "yes";

      // Extract user info - log for debugging
      const userId = (req.user as { _id?: unknown; id?: unknown })?._id || (req.user as { _id?: unknown; id?: unknown })?.id;
      const userRole = (req.user as { role?: unknown })?.role;
      
      console.log(`📊 GET /ranked - jobId: ${jobId}, userId: ${userId}, role: ${userRole}`);

      // If jobId is provided, use the ranking service which will fetch job applicants
      if (jobId) {
        const result = await rankCandidatesForRecruiter({
          jobId,
          jobDescription: "", // Service will fetch from job
          candidates: undefined, // Service will fetch applicants from job
          useAI,
          requesterId: String(userId || ""),
          requesterRole: String(userRole || ""),
        });

        return res.json({
          message: "Ranked candidates retrieved successfully",
          aiEnabled: useAI,
          ...result,
        });
      }

      // Otherwise, get all candidates and rank them
      const candidates = await CandidateProfile.find()
        .populate("user", "name email avatar")
        .lean()
        .exec();

      if (!candidates || candidates.length === 0) {
        return res.json({
          success: true,
          message: "No candidates found",
          candidateCount: 0,
          rankedCandidates: [],
        });
      }

      // Prepare candidates for ranking
      const candidatesList = candidates.map((candidate: Record<string, unknown>) => {
        const user = candidate.user as Record<string, unknown> | undefined;
        return {
          candidateId: candidate._id ? String(candidate._id as unknown) : undefined,
          applicationId: undefined,
          name: (user?.name as string) || (candidate.name as string) || "Unknown",
          email: (user?.email as string) || "N/A",
          skills: (candidate.skills as unknown[]) || [],
          experience: (candidate.experience as unknown[]) || [],
          education: (candidate.education as unknown[]) || [],
          bio: (candidate.bio as string) || "",
          profile: candidate,
        };
      });

      // Use ranking service to rank all candidates
      const result = await rankCandidatesForRecruiter({
        jobDescription: "General Candidate Ranking",
        candidates: candidatesList,
        useAI,
        requesterId: String(userId || ""),
        requesterRole: String(userRole || ""),
      });

      return res.json({
        message: "Ranked candidates retrieved successfully",
        aiEnabled: useAI,
        ...result,
      });
    } catch (error) {
      console.error("❌ GET /ranked error:", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      
      // Return 404 for not found errors
      if (errorMsg.includes("not found") || errorMsg.includes("Not found")) {
        return res.status(404).json({
          success: false,
          message: "Job or candidates not found",
          error: errorMsg,
        });
      }
      
      // Return 403 for permission errors
      if (errorMsg.includes("can only rank") || errorMsg.includes("permission")) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to rank candidates for this job",
          error: errorMsg,
        });
      }

      // Return 400 for validation errors
      if (errorMsg.includes("No candidates") || errorMsg.includes("Provide")) {
        return res.status(400).json({
          success: false,
          message: "Invalid ranking request",
          error: errorMsg,
        });
      }

      // Return 500 for other errors
      return res.status(500).json({
        success: false,
        message: "Failed to rank candidates",
        error: errorMsg,
      });
    }
  },
);

// POST for custom ranking (existing endpoint)
router.post(
  "/rank",
  authMiddleware(["recruiter"]),
  json({ limit: "10mb", strict: false }),
  upload.none(),
  async (req, res) => {
    const rawBody = req.body as unknown;
    let body: Record<string, unknown> = {};

    if (rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)) {
      body = rawBody as Record<string, unknown>;
    }

    if (typeof rawBody === "string") {
      try {
        const parsed = JSON.parse(rawBody);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          body = parsed as Record<string, unknown>;
        }
      } catch {
        return res.status(400).json({ success: false, message: "Request body must be valid JSON" });
      }
    }

    try {
      const result = await rankCandidatesForRecruiter({
        jobId: typeof body.jobId === "string" ? body.jobId : undefined,
        jobDescription: typeof body.jobDescription === "string" ? body.jobDescription : undefined,
        candidates: body.candidates,
        useAI: Boolean(body.ai),
        requesterId: String(((req.user as { id?: unknown; _id?: unknown })?.id || (req.user as { id?: unknown; _id?: unknown })?._id || "")),
        requesterRole: String(((req.user as { role?: unknown })?.role || "")),
      });

      return res.json(result);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Ranking failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// Helper function to calculate candidate score
function calculateCandidateScore(candidate: Record<string, unknown>): number {
  let score = 0;

  // Skills score (max 30)
  const skillsCount = ((candidate.skills || []) as unknown[]).length;
  score += Math.min(skillsCount * 3, 30);

  // Experience score (max 40)
  const experienceYears = ((candidate.experience || []) as unknown[]).reduce((sum: number, exp: unknown) => {
    const expRecord = exp as Record<string, unknown>;
    const years = (expRecord.yearsOfExperience as number) || 0;
    return sum + years;
  }, 0);
  score += Math.min(experienceYears * 4, 40);

  // Education score (max 20)
  const educationCount = ((candidate.education || []) as unknown[]).length;
  score += Math.min(educationCount * 10, 20);

  // Bio/Profile completeness (max 10)
  const bio = candidate.bio as string | undefined;
  if (bio && bio.length > 50) {
    score += 10;
  } else if (bio && bio.length > 0) {
    score += 5;
  }

  return Math.min(score, 100);
}

export default router;
