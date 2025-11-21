
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
// Handle the /profile route
router.route("/profile")
  // GET /api/v1/candidate/profile - Get current user's candidate profile
  .get(optionalAuth, asyncHandler(getCurrentCandidateProfileController))
  // POST /api/v1/candidate/profile - Create candidate profile
  .post(authMiddleware(["Candidate"]), asyncHandler(createCandidateProfileController))
  // PUT /api/v1/candidate/profile - Update current user's candidate profile
  .put(authMiddleware(["Candidate"]), asyncHandler(updateCurrentCandidateProfileController));

// Mount sub-routes
router.use("/resume", resumeRoutes);

export default router;
