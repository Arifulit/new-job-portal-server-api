import { Router } from "express";
import multer from 'multer';

const router = Router();
const upload = multer();

function normalizeTokens(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

function normalizeSkillsArray(values: unknown): string[] {
  if (!values) return [];
  if (typeof values === 'string') {
    try {
      const parsed = JSON.parse(values);
      if (Array.isArray(parsed)) return parsed.map(String).map((s) => s.toLowerCase().trim());
    } catch (e) {
      // if not JSON, treat as comma separated
      return values.split(',').map((s) => String(s).toLowerCase().trim()).filter(Boolean as any);
    }
  }
  if (Array.isArray(values)) return values.map(String).map((s) => s.toLowerCase().trim());
  return [];
}

// POST /gap
// Accepts either JSON or form-data (fields only).
// Body: { jobDescription?: string, jobSkills?: string[] , candidateSkills: string[] }
// Returns: { missingSkills: string[] }
router.post('/gap', upload.none(), (req, res) => {
  let body: any = req.body ?? {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ success: false, message: 'Request body must be valid JSON' });
    }
  }

  const { jobDescription, jobSkills, candidateSkills } = body;

  const candidate = normalizeSkillsArray(candidateSkills);
  if (!candidate.length) return res.status(400).json({ success: false, message: "Provide 'candidateSkills' as an array or JSON string" });

  let required: string[] = [];
  if (jobSkills && Array.isArray(jobSkills) && jobSkills.length) {
    required = normalizeSkillsArray(jobSkills);
  } else if (typeof jobDescription === 'string' && jobDescription.trim()) {
    // extract tokens from jobDescription and use as required skills heuristically
    required = normalizeTokens(jobDescription);
  }

  if (!required.length) return res.status(400).json({ success: false, message: "Provide 'jobSkills' array or a non-empty 'jobDescription'" });

  const candidateSet = new Set(candidate.map((s) => s.toLowerCase()));
  const missing = required.filter((r) => !candidateSet.has(r)).map((s) => s.toLowerCase());

  // unique and preserve order
  const missingUnique = Array.from(new Set(missing));

  return res.json({ success: true, missingSkills: missingUnique });
});

export default router;
