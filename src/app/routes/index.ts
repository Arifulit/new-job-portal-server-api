// এই ফাইলটি সব module route একত্র করে /api/v1 root router তৈরি করে।
import { Router } from "express";
import candidateRoutes from "../modules/profile/candidate/routes"; // direct candidate routes
import jobRoutes from "../modules/job/routes/jobRoutes";
import applicationRoutes from "../modules/application/routes/applicationRoutes";
import paymentRoutes from "../modules/payment/routes/paymentRoutes";
import auditRoutes from "../modules/audit/routes/auditRoutes";
import companyRoutes from "../modules/company/routes/companyRoutes";
import recruitmentAgencyRoutes from "../modules/agency/routes/recruitmentAgency.routes";
import authRoutes from "../modules/auth/routes/authRoutes";
import recruiterRoutes from "../modules/profile/recruiter/routes";
import adminRoutes from "../modules/profile/admin/routes";
import messageRoutes from "../modules/message/routes/messageRoutes";
import notificationRoutes from "../modules/notification/routes/notificationRoutes";
import { authMiddleware } from "../middleware/auth";

import careerResourcesRoutes from "../modules/careerResources/routes";
import summaryStatsRoutes from "../modules/analytics/routes/summaryStatsRoutes";

import resumeRoutes from "../modules/resume/routes/resumeRoutes";

import {
  getAdminDashboardStatsController,
  getRoleBasedDashboardStatsController,
} from "../modules/analytics/controllers/dashboardStatsController";

const router = Router();

// Resume analyzer route
router.use("/resume", resumeRoutes);

// Public career resources
router.use("/career-resources", careerResourcesRoutes);

// Public summary stats
router.use("/analytics", summaryStatsRoutes);

router.use("/auth", authRoutes);

// Mount candidate routes for backward compatibility
router.use("/candidate", candidateRoutes);
router.use("/recruiter", recruiterRoutes);
router.use("/admin", adminRoutes);

router.use("/jobs", jobRoutes);
router.use("/applications", applicationRoutes);
router.use("/payments", paymentRoutes);
router.use("/audit", auditRoutes);
router.use("/company", companyRoutes);
router.use("/agency", recruitmentAgencyRoutes);
router.use("/messages", messageRoutes);
router.use("/notifications", notificationRoutes);

// Compatibility aliases for dashboard stats endpoints used by different clients.
router.get(
  "/dashboard/stats",
  authMiddleware(),
  getRoleBasedDashboardStatsController,
);
router.get(
  "/users/dashboard/stats",
  authMiddleware(),
  getRoleBasedDashboardStatsController,
);
router.get(
  "/admin/stats",
  authMiddleware(["admin"]),
  getAdminDashboardStatsController,
);

export default router;
