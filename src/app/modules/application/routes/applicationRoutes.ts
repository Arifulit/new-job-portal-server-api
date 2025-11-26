
// import { Router } from "express";
// import { 
//   applyJob, 
//   getCandidateApplications, 
//   updateApplication,
//   getJobApplications,
//   getJobApplicationsNew,
//   getJobAllApplications
// } from "../controllers/applicationController";
// import { authMiddleware } from "../../../middleware/auth";

// const router = Router();

// // Candidate routes
// router.post("/", authMiddleware(["candidate"]), applyJob);
// router.get("/me", authMiddleware(["candidate"]), getCandidateApplications);

// // Recruiter routes
// router.get(
//   "/recruiter/all-applications",
//   authMiddleware(["recruiter"]),
//   getJobAllApplications
// );

// // Update application (PUT /:id) - MOVE THIS BEFORE parameterized routes
// router.put(
//   "/:id",
//   authMiddleware(["admin", "recruiter"]),
//   updateApplication
// );

// // View applications for a specific job
// router.get(
//   "/jobs/:jobId/applications", 
//   authMiddleware(["recruiter", "admin"]), 
//   getJobApplications
// );

// // Get all applications for a specific job (recruiter)
// router.get(
//   "/recruiter/jobs/:jobId/applications", 
//   authMiddleware(["recruiter"]), 
//   getJobApplicationsNew
// );

// export default router;

// src/app/modules/application/routes/applicationRoutes.ts
import { RequestHandler, Router } from "express";
import { 
  applyJob, 
  getCandidateApplications, 
  updateApplication,
  getJobApplications,
  getJobApplicationsNew,
  getJobAllApplications,
  getApplicationsByUser,
  getApplicationCountByUser
} from "../controllers/applicationController";
import { authMiddleware } from "../../../middleware/auth";

const router = Router();

// Candidate routes
router.post("/", authMiddleware(["candidate"]), applyJob);
router.get("/me", authMiddleware(["candidate"]), getCandidateApplications);
import { withdrawApplication } from "../controllers/applicationController";

// Recruiter routes
router.get(
  "/recruiter/all-applications",
  authMiddleware(["recruiter"]),
  getJobAllApplications
);

// Update application status (PUT /:id)
router.put(
  "/:id",
  authMiddleware(["recruiter", "admin"]),
  updateApplication
);

// View applications for a specific job
router.get(
  "/jobs/:jobId/applications", 
  authMiddleware(["recruiter", "admin"]), 
  getJobApplications
);

// Get all applications for a specific job (recruiter)
router.get(
  "/recruiter/jobs/:jobId/applications", 
  authMiddleware(["recruiter"]), 
  getJobApplicationsNew
);
router.post(
  "/:id/withdraw",
  authMiddleware(["candidate"]),
  withdrawApplication
);

router.get(
  "/user/:userId",
  authMiddleware() as RequestHandler,
  (req, res, next) => getApplicationsByUser(req as any, res, next)
);

// Get count of applications for a specific user (protected)
router.get(
  "/user/:userId/count",
  authMiddleware() as RequestHandler,
  (req, res, next) => getApplicationCountByUser(req as any, res, next)
);

export default router;