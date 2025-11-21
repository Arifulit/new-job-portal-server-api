// // src/app/modules/application/routes/applicationRoutes.ts
// import { Router, Request, Response, NextFunction } from "express";
// import { 
//   applyJob, 
//   getCandidateApplications, 
//   updateApplication,
//   getJobApplications,
//   getJobApplicationsNew
// } from "../controllers/applicationController";
// import { authMiddleware } from "../../../middleware/auth";

// const router = Router();

// // Candidate routes
// router.post(
//   "/", 
//   authMiddleware(["candidate"]), 
//   applyJob
// );

// router.get(
//   "/me", 
//   authMiddleware(["candidate"]), 
//   getCandidateApplications
// );

// // Recruiter routes - View applications for a specific job
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
// router.get(
//   "/recruiter/all-applications", 
//   authMiddleware(["recruiter"]), 
//   getJobAllApplications
// );


// // Admin routes
// router.put(
//   "/:id", 
//   authMiddleware(["admin"]), 
//   updateApplication
// );

// export default router;





























// // import { Router } from "express";
// // import { 
// //   applyJob, 
// //   getCandidateApplications, 
// //   updateApplication,
// //   getJobApplications,
// //   getMyJobApplications
// // } from "../controllers/applicationController";
// // import { authMiddleware } from "../../../middleware/auth";

// // const router = Router();

// // // Candidate routes
// // router.post("/", 
// //   authMiddleware(["candidate"]), 
// //   applyJob as any
// // );

// // router.get("/me", 
// //   authMiddleware(["candidate"]), 
// //   getCandidateApplications as any
// // );

// // // Recruiter routes
// // router.get("/jobs/:jobId/applications", 
// //   authMiddleware(["recruiter", "admin"]), 
// //   getJobApplications
// // );

// // router.get("/recruiter/applications", 
// //   authMiddleware(["recruiter"]), 
// //   getMyJobApplications as any
// // );

// // // Admin routes
// // router.put("/:id", 
// //   authMiddleware(["admin"]), 
// //   updateApplication as any
// // );

// // export default router;

//// src/app/modules/application/routes/applicationRoutes.ts
import { Router } from "express";
import { 
  applyJob, 
  getCandidateApplications, 
  updateApplication,
  getJobApplications,
  getJobApplicationsNew,
  getJobAllApplications
} from "../controllers/applicationController";
import { authMiddleware } from "../../../middleware/auth";

const router = Router();

// Candidate routes
router.post("/", authMiddleware(["candidate"]), applyJob);
router.get("/me", authMiddleware(["candidate"]), getCandidateApplications);

// Recruiter routes
router.get(
  "/recruiter/all-applications",
  authMiddleware(["recruiter"]),
  getJobAllApplications
);

// Update application (PUT /:id) - MOVE THIS BEFORE parameterized routes
router.put(
  "/:id",
  authMiddleware(["admin", "recruiter"]),
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

export default router;