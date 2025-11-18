// import { Router } from "express";
// import { uploadResumeController, getResumeController } from "../controllers/resumeController";
// import { authMiddleware } from "../../../../middleware/auth";

// const router = Router();

// router.post("/", authMiddleware(["Candidate"]), uploadResumeController);
// router.get("/:candidateId", authMiddleware(["Candidate", "Admin"]), getResumeController);

// export default router;
import { Router, Request, Response, NextFunction } from "express";
import { uploadResumeController, getResumeController, getCurrentResumeController } from "../controllers/resumeController";
import authMiddleware, { optionalAuth } from "../../../../middleware/auth";
import { upload } from "../../../../middleware/upload";
import asyncHandler from "../../../../utils/asyncHandler";

const router = Router();

// Debug middleware
router.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`🔍 Resume Routes - ${req.method} ${req.path} | Original: ${req.originalUrl}`);
  next();
});

// GET /api/v1/candidate/resume - Get current user's resume (if authenticated)
router.get("/", optionalAuth, asyncHandler(getCurrentResumeController));

// POST /api/v1/candidate/resume - Supports both file upload (form-data) and JSON
router.post("/", authMiddleware(["Candidate"]), upload.single("resume"), uploadResumeController);

// GET /api/v1/candidate/resume/:candidateId - Get resume by candidate ID
router.get("/:candidateId", optionalAuth, asyncHandler(getResumeController));

export default router;
