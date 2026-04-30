import { Router } from "express";
import { resumeUpload } from "../../../middleware/upload";
import fs from "fs";
import { analyzeResumeWithOpenAI } from "../../../integrations/openai/resumeParser";
import resumeGenerateRoutes from "./resumeGenerateRoutes";
const router = Router();

// POST /resume/analyze
router.post("/analyze", resumeUpload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    // Call OpenAI integration with file path
    const aiResult = await analyzeResumeWithOpenAI(req.file.path);
    // Remove local file after processing
    fs.unlink(req.file.path, () => {});
    return res.json({
      success: true,
      ...aiResult,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Resume analysis failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Mount resume generate route
router.use(resumeGenerateRoutes);

export default router;
