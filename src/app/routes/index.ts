
// import { Router } from "express";
// import authRoutes from "../modules/auth";
// import candidateRoutes from "../modules/profile/candidate/routes";
// import employerRouter from "../modules/profile/employer/routes";
// import jobRoutes from "../modules/job/routes/jobRoutes";
// import applicationRoutes from "../modules/application/routes/applicationRoutes";
// import paymentRoutes from "../modules/payment/routes/paymentRoutes";
// import auditRoutes from "../modules/audit/routes/auditRoutes";
// import companyRoutes from "../modules/company/routes/companyRoutes";
// import recruitmentAgencyRoutes from "../modules/agency/routes/recruitmentAgency.routes";

// const router = Router();

// router.use("/auth", authRoutes);
// router.use("/candidate", candidateRoutes);
// router.use("/employer", employerRouter);
// router.use("/jobs", jobRoutes);
// router.use("/applications", applicationRoutes);
// router.use("/payments", paymentRoutes);
// router.use("/audit", auditRoutes);
// router.use("/company", companyRoutes);
// router.use("/agency", recruitmentAgencyRoutes);

// export default router;


// src/routes/index.ts
import { Router } from "express";
import profileRoutes from "./profile";   // new profile router
import candidateRoutes from "../modules/profile/candidate/routes"; // direct candidate routes
import employerRoutes from "../modules/profile/employer/routes"; // direct employer routes
import jobRoutes from "../modules/job/routes/jobRoutes";
import applicationRoutes from "../modules/application/routes/applicationRoutes";
import paymentRoutes from "../modules/payment/routes/paymentRoutes";
import auditRoutes from "../modules/audit/routes/auditRoutes";
import companyRoutes from "../modules/company/routes/companyRoutes";
import recruitmentAgencyRoutes from "../modules/agency/routes/recruitmentAgency.routes";
import authRoutes from "../modules/auth";

const router = Router();

router.use("/auth", authRoutes);

// mount profile top-level so endpoint path becomes /api/v1/profile/...
router.use("/profile", profileRoutes);

// Also mount candidate and employer directly for backward compatibility
// /api/v1/candidate/... and /api/v1/employer/...
router.use("/candidate", candidateRoutes);
router.use("/employer", employerRoutes);

router.use("/jobs", jobRoutes);
router.use("/applications", applicationRoutes);
router.use("/payments", paymentRoutes);
router.use("/audit", auditRoutes);
router.use("/company", companyRoutes);
router.use("/agency", recruitmentAgencyRoutes);

export default router;
