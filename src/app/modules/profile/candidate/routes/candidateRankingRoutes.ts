import { Router } from "express";
import multer from 'multer';
import { scoreCandidateWithAI } from '../../../../integrations/openai/aiRanker';

/**
 * Smart Candidate Ranking API
 * POST /api/candidates/rank
 * Body: { jobDescription: string, candidates: [{ name, skills, experience }] }
 * Returns: rankedCandidates: [{ name, score }]
 */
const router = Router();

// Simple skill match + experience scoring
function calculateScore(jobDescription: string, candidate: any): number {
  // Example: match skills in jobDescription
  const requiredSkills = jobDescription
    .toLowerCase()
    .match(/\b[a-zA-Z0-9\-\.\+\#]+\b/g) || [];
  const candidateSkills = (candidate.skills || []).map((s: string) => s.toLowerCase());
  let skillMatches = 0;
  for (const skill of requiredSkills) {
    if (candidateSkills.includes(skill)) skillMatches++;
  }
  // Score: 70% skill match + 30% experience (max 10 years)
  const skillScore = requiredSkills.length ? (skillMatches / requiredSkills.length) * 70 : 0;
  const expScore = Math.min(candidate.experience || 0, 10) * 3;
  return Math.round(skillScore + expScore);
}

const upload = multer();

// Accept JSON body or multipart/form-data (fields only)
router.post("/rank", upload.none(), (req, res) => {
  // Be defensive: allow missing or string body from some clients
  let body: any = req.body ?? {};
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ success: false, message: "Request body must be valid JSON" });
    }
  }
  let { jobDescription, candidates } = body;
  // candidates may be sent as a JSON string in form-data; parse if needed
  if (typeof candidates === 'string') {
    try {
      candidates = JSON.parse(candidates);
    } catch (e) {
      // allow simple comma-separated skills? but we require array of objects
      return res.status(400).json({ success: false, message: "Invalid 'candidates' field: must be a JSON array" });
    }
  }
  if (!jobDescription || !Array.isArray(candidates)) {
    return res.status(400).json({ success: false, message: "Invalid input: provide 'jobDescription' and 'candidates' array in request body or form fields" });
  }
  (async () => {
    try {
      const useAI = !!body.ai;
      let scored: Array<any>;
      if (useAI) {
        // Use OpenAI to score each candidate
        const results = await Promise.all(
          candidates.map(async (c: any) => {
            try {
              const { score, reasons } = await scoreCandidateWithAI(jobDescription, c);
              return { ...c, score, reasons };
            } catch (e) {
              // on error, fallback to simple score
              return { ...c, score: calculateScore(jobDescription, c), reasons: [(e as Error).message] };
            }
          })
        );
        scored = results;
      } else {
        scored = candidates.map((c: any) => ({ ...c, score: calculateScore(jobDescription, c) }));
      }

      const rankedCandidates = scored.sort((a, b) => b.score - a.score).map(({ name, score, reasons }) => ({ name, score, reasons }));
      return res.json({ success: true, rankedCandidates });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Ranking failed', error: (err as Error).message });
    }
  })();
});

export default router;
