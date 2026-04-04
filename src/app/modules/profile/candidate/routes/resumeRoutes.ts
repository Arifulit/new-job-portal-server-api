
import { Router, Request, Response, NextFunction } from "express";
import { uploadResumeController, getResumeController, getCurrentResumeController } from "../controllers/resumeController";
import authMiddleware, { optionalAuth } from "../../../../middleware/auth";
import multer from "multer";
import { resumeUpload } from "../../../../middleware/upload";
import asyncHandler from "../../../../utils/asyncHandler";

const router = Router();

// Debug middleware
router.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`🔍 Resume Routes - ${req.method} ${req.path} | Original: ${req.originalUrl}`);
  next();
});

// GET /api/v1/candidate/resume - Get current user's resume (if authenticated)
router.get("/", optionalAuth, asyncHandler(getCurrentResumeController));

const resumeUploadMiddleware = (req: Request, res: Response, next: NextFunction) => {
  resumeUpload.fields([
    { name: "resume", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ])(req, res, (error: any) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "Resume file must be within 5MB",
        });
      }

      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message || "Resume upload failed",
    });
  });
};

// POST /api/v1/candidate/resume - Supports both file upload (form-data) and JSON
router.post(
  "/",
  authMiddleware(["candidate"]),
  resumeUploadMiddleware,
  uploadResumeController,
);

// GET /api/v1/candidate/resume/:candidateId - Get resume by candidate ID
router.get("/:candidateId", optionalAuth, asyncHandler(getResumeController));

export default router;
