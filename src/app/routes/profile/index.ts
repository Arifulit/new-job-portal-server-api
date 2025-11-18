// src/routes/profile/index.ts
import { Router } from "express";
import candidateRoutes from "../../modules/profile/candidate/routes"; // adjust relative paths if needed
import employerRoutes from "../../modules/profile/employer/routes";

const router = Router();

console.log("✅ Profile router loaded");

// /api/v1/profile/candidate/...
router.use("/candidate", candidateRoutes);

// /api/v1/profile/employer/...
router.use("/employer", employerRoutes);

export default router;
