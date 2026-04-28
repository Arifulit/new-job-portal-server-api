import { Router } from "express";
import { resumeUpload } from "../../../middleware/upload";
const pdfParse = require("pdf-parse");
import fs from "fs";
import path from "path";
import { analyzeResumeWithOpenAI } from "../../../integrations/openai/resumeParser";
const router = Router();

// POST /resume/analyze
router.post("/analyze", resumeUpload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    // Extract text from PDF
    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(dataBuffer);
    const resumeText = pdfData.text;

    // Call OpenAI integration
    const aiResult = await analyzeResumeWithOpenAI(resumeText);

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

export default router;
