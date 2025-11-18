
import { Router, Request, Response, NextFunction } from "express";
import candidateProfileRoutes from "./candidateProfileRoutes";
import resumeRoutes from "./resumeRoutes";
import { 
  createCandidateProfileController, 
  getCurrentCandidateProfileController,
  updateCurrentCandidateProfileController
} from "../controllers/candidateProfileController";
import authMiddleware, { optionalAuth } from "../../../../middleware/auth";
import asyncHandler from "../../../../utils/asyncHandler";

const router = Router();

console.log("✅ Candidate Routes Loaded");

// Debug middleware to log all requests
router.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`🔍 Candidate Routes - ${req.method} ${req.path} | Original: ${req.originalUrl} | Base: ${req.baseUrl}`);
  next();
});

// IMPORTANT: Define specific routes BEFORE router.use() for sub-routes
// GET /api/v1/profile/candidate - Get current user's candidate profile (if authenticated)
router.get("/", optionalAuth, asyncHandler(getCurrentCandidateProfileController));

// POST /api/v1/profile/candidate - Create candidate profile
router.post("/", authMiddleware(["Candidate"]), asyncHandler(createCandidateProfileController));

// PUT /api/v1/profile/candidate - Update current user's candidate profile
router.put("/", authMiddleware(["Candidate"]), asyncHandler(updateCurrentCandidateProfileController));

// Sub-routes - these must come AFTER the root routes
// /api/v1/profile/candidate/profile
router.use("/profile", candidateProfileRoutes);

// /api/v1/profile/candidate/resume
router.use("/resume", resumeRoutes);

export default router;
