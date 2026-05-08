/* eslint-disable @typescript-eslint/no-explicit-any */
// // এই ফাইলটি application submit/update/list endpoint এর route mapping করে।
// import { RequestHandler, Router, Request, Response, NextFunction } from "express";
// import { 
//   applyJob, 
//   getCandidateApplications, 
//   updateApplication,
//   getJobApplications,
//   getJobApplicationsNew,
//   getJobAllApplications,
//   getApplicationsByUser,
//   getApplicationCountByUser,
//   previewApplicationResume,
//   downloadApplicationResume,
//   withdrawApplication,
//   diagnoseResumeUrl,
//   testCloudinaryConfig,
//   testUrlAccessibility
// } from "../controllers/applicationController";
// import { authMiddleware } from "../../../middleware/auth";
// import { resumeUpload } from "../../../middleware/upload";

// const router = Router();

// const applicationResumeUpload = (req: Request, res: Response, next: NextFunction) => {
//   resumeUpload.fields([
//     { name: "resume", maxCount: 1 },
//     { name: "file", maxCount: 1 },
//   ])(req, res, (err) => {
//     if (err) {
//       return next(err);
//     }

//     next();
//   });
// };

// // Candidate routes — POST with optional resume file upload
// router.post("/", authMiddleware(["candidate"]), applicationResumeUpload, applyJob);
// router.get("/me", authMiddleware(["candidate"]), getCandidateApplications);

// // Recruiter routes
// router.get(
//   "/recruiter/all-applications",
//   authMiddleware(["recruiter"]),
//   getJobAllApplications
// );

// // Update application status (PUT /:id)
// router.put(
//   "/:id",
//   authMiddleware(["recruiter", "admin"]),
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
// router.post(
//   "/:id/withdraw",
//   authMiddleware(["candidate"]),
//   withdrawApplication
// );

// router.get("/:id/resume/preview", previewApplicationResume);
// router.get("/:id/resume/download", downloadApplicationResume);

// // Diagnostic endpoints for development (testing resume URLs and Cloudinary)
// router.get("/diagnose/resume-url", diagnoseResumeUrl);
// router.get("/test/cloudinary-config", testCloudinaryConfig);
// router.get("/test/url-accessibility", testUrlAccessibility);

// router.get(
//   "/user/:userId",
//   authMiddleware() as RequestHandler,
//   (req, res, next) => getApplicationsByUser(req as any, res, next)
// );

// // Get count of applications for a specific user (protected)
// router.get(
//   "/user/:userId/count",
//   authMiddleware() as RequestHandler,
//   (req, res, next) => getApplicationCountByUser(req as any, res, next)
// );

// export default router;



// এই ফাইলটি application submit/update/list endpoint এর route mapping করে।
import { RequestHandler, Router, Request, Response, NextFunction } from "express";
import { 
  applyJob, 
  getCandidateApplications, 
  updateApplication,
  getJobApplications,
  getJobApplicationsNew,
  getJobAllApplications,
  getApplicationsByUser,
  getApplicationCountByUser,
  previewApplicationResume,
  downloadApplicationResume,
  withdrawApplication,
  diagnoseResumeUrl,
  testCloudinaryConfig,
  testUrlAccessibility
} from "../controllers/applicationController";
import { authMiddleware } from "../../../middleware/auth";
import { resumeUpload } from "../../../middleware/upload";

const router = Router();

const applicationResumeUpload = (req: Request, res: Response, next: NextFunction) => {
  resumeUpload.fields([
    { name: "resume", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ])(req, res, (err) => {
    if (err) {
      return next(err);
    }

    next();
  });
};

// Candidate routes — POST with optional resume file upload
router.post("/", authMiddleware(["candidate"]), applicationResumeUpload, applyJob);
router.get("/me", authMiddleware(["candidate"]), getCandidateApplications);

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

router.get("/:id/resume/preview", previewApplicationResume);
router.get("/:id/resume/download", downloadApplicationResume);

// Diagnostic endpoints for development (testing resume URLs and Cloudinary)
router.get("/diagnose/resume-url", diagnoseResumeUrl);
router.get("/test/cloudinary-config", testCloudinaryConfig);
router.get("/test/url-accessibility", testUrlAccessibility);

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