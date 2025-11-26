import { Router, type RequestHandler, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../../../types/express";
import { 
  createJob, 
  updateJob, 
  getAllJobs, 
  getJobById, 
  deleteJob,
  closeJob,
  AuthenticatedHandler
} from "../controllers/jobController";
import { getJobApplications } from "../../application/controllers/applicationController";
import { authMiddleware } from "../../../middleware/auth";
import adminJobRoutes from "./adminJobRoutes";
import { getAllJobsForAdminOrRecruiter } from "../controllers/jobAdminController";

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
  authMiddleware() as RequestHandler,
  handleRoute(getAllJobs)
);

router.get('/all', authMiddleware(["admin", "recruiter"]) as RequestHandler, handleRoute(getAllJobsForAdminOrRecruiter));
// Job applications routes

router.get(
  "/:id",
  authMiddleware() as RequestHandler,
  handleRoute(getJobById)
);

router.post(
  "/create", 
  authMiddleware(["admin", "recruiter"]) as RequestHandler,
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