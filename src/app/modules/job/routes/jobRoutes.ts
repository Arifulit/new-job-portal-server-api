// এই ফাইলটি job related endpoint (public/recruiter/admin) route map করে।
import { Router, type RequestHandler, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../../../types/express";
import { 
  createJob, 
  updateJob, 
  getAllJobs, 
  getJobById, 
  deleteJob,
  closeJob,
  saveJob,
  unsaveJob,
  getSavedJobs,
  AuthenticatedHandler,
  getPendingJobs,
  getApprovedJobs
} from "../controllers/jobController";
import { getJobApplications } from "../../application/controllers/applicationController";
import { authMiddleware, optionalAuth } from "../../../middleware/auth";
import adminJobRoutes from "./adminJobRoutes";
import { adminGetAllJobs } from "../controllers/jobAdminController";
import { upload as imageUpload } from "../../../middleware/upload";

const router = Router();

// Mount admin job routes
router.use('/admin/jobs', authMiddleware(['admin']) as RequestHandler, adminJobRoutes);

// Debug middleware
router.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Type-safe route handler wrapper that properly handles async/await
const handleRoute = (
  handler: AuthenticatedHandler
): RequestHandler => {
  return (req, res, next) => {
    return Promise.resolve(handler(req as AuthenticatedRequest, res, next))
      .catch(next);
  };
};

// Protected routes
router.get(
  "/",
  optionalAuth,
  handleRoute(getAllJobs)
);

router.get(
  "/search",
  optionalAuth,
  handleRoute(getAllJobs)
);

// Candidate-facing job list: only approved jobs from all recruiters.
router.get(
  "/candidate/jobs",
  authMiddleware(["candidate", "admin"]) as RequestHandler,
  handleRoute(getApprovedJobs)
);

// Recruiter-specific jobs: individual recruiter can only see jobs they created
router.get(
  "/recruiter/jobs",
  authMiddleware(["recruiter"]) as RequestHandler,
  handleRoute(getAllJobs)
);

// Backward-compatible pagination alias:
// GET /api/v1/jobs/page=1&limit=10
router.get(
  "/page=:page&limit=:limit",
  optionalAuth,
  (req, res) => {
    const page = encodeURIComponent(String(req.params.page || 1));
    const limit = encodeURIComponent(String(req.params.limit || 10));
    return res.redirect(307, `${req.baseUrl}?page=${page}&limit=${limit}`);
  }
);

router.get('/all', authMiddleware(["admin", "recruiter"]) as RequestHandler, handleRoute(adminGetAllJobs));
// Job applications routes
// router.get("/admin/jobs/all", authMiddleware(["admin"]) as RequestHandler, handleRoute(adminGetAllJobs));

router.get(
  "/saved/me",
  authMiddleware() as RequestHandler,
  handleRoute(getSavedJobs)
);

router.post(
  "/:id/save",
  authMiddleware() as RequestHandler,
  handleRoute(saveJob)
);

router.delete(
  "/:id/save",
  authMiddleware() as RequestHandler,
  handleRoute(unsaveJob)
);

router.get(
  "/:id",
  optionalAuth,
  handleRoute(getJobById)
);


// Support both form-data (with file) and raw JSON for job creation
router.post(
  "/create",
  authMiddleware(["admin", "recruiter"]) as RequestHandler,
  (req, res, next) => {
    const contentType = req.headers["content-type"] || "";
    if (contentType.includes("multipart/form-data")) {
      return imageUpload.single("logo")(req, res, next);
    }
    next();
  },
  handleRoute(createJob)
);

// Update job route
router.put(
  "/:id", 
  (req, res, next) => {
    console.log('PUT /:id route hit', req.params);
    next();
  },
  authMiddleware(["admin", "recruiter"]) as RequestHandler,
  handleRoute(updateJob)
);

// Partial update job route
router.patch(
  "/:id", 
  (req, res, next) => {
    console.log('PATCH /:id route hit', req.params);
    next();
  },
  authMiddleware(["admin", "recruiter"]) as RequestHandler,
  handleRoute(updateJob)
);

// Close job route
router.patch(
  "/:id/close",
  authMiddleware(["admin", "recruiter"]) as RequestHandler,
  handleRoute(closeJob)
);

// Delete job route
router.delete(
  "/:id", 
  authMiddleware(["admin"]) as RequestHandler,
  handleRoute(deleteJob)
);

// ...existing code...

router.get(
  "/:jobId/applications",
  authMiddleware(["recruiter", "admin"]) as RequestHandler,
  handleRoute(getJobApplications)
);

export default router;