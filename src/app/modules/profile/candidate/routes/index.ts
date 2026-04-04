
import { Router, Request, Response, NextFunction } from "express";
import candidateProfileRoutes from "./candidateProfileRoutes";
import { 
  createCandidateProfileController, 
  getCurrentCandidateProfileController,
  updateCurrentCandidateProfileController
} from "../controllers/candidateProfileController";
import authMiddleware, { optionalAuth } from "../../../../middleware/auth";
import asyncHandler from "../../../../utils/asyncHandler";
import { getCandidateDashboardStatsController } from "../../../analytics/controllers/dashboardStatsController";

const router = Router();

console.log("✅ Candidate Routes Loaded");

// Debug middleware to log all requests
router.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`🔍 Candidate Routes - ${req.method} ${req.path} | Original: ${req.originalUrl} | Base: ${req.baseUrl}`);
  next();
});

// Mount profile sub-routes at /profile path
// This makes: GET /api/v1/candidate/profile, POST /api/v1/candidate/profile, GET /api/v1/candidate/profile/:userId, etc.
router.use("/profile", candidateProfileRoutes);

// Resume upload depends on Cloudinary and is disabled on Vercel serverless.
const isVercelDeployment = process.env.VERCEL === "1" || process.env.VERCEL === "true";
if (!isVercelDeployment) {
  // Lazy-load to keep the Cloudinary dependency out of the startup path.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const resumeRoutes = require("./resumeRoutes").default as Router;
  router.use("/resume", resumeRoutes);
}

// Candidate dashboard stats
router.get(
  "/dashboard/stats",
  authMiddleware(["candidate"]),
  asyncHandler(getCandidateDashboardStatsController)
);

export default router;
