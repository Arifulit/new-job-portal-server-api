import { Router, type RequestHandler } from "express";
import { 
  createJob, 
  updateJob, 
  getJobs, 
  getJobById, 
  deleteJob,
  closeJob
} from "../controllers/jobController";
import { getJobApplications } from "../../application/controllers/applicationController";
import { authMiddleware } from "../../../middleware/auth";

const router = Router();

// Debug middleware
router.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Protected routes
router.get(
  "/",
  authMiddleware() as RequestHandler,
  getJobs as RequestHandler
);

router.get(
  "/:id",
  authMiddleware() as RequestHandler,
  getJobById as RequestHandler
);

router.post("/", 
  authMiddleware(["admin", "recruiter"]) as RequestHandler,
  createJob as RequestHandler
);

// Update job routes
router.put("/:id", 
  (req, res, next) => {
    console.log('PUT /:id route hit', req.params);
    next();
  },
  authMiddleware(["admin", "recruiter"]) as RequestHandler,
  updateJob as RequestHandler
);

// Partial update job route
router.patch("/:id", 
  (req, res, next) => {
    console.log('PATCH /:id route hit', req.params);
    next();
  },
  authMiddleware(["admin", "recruiter"]) as RequestHandler,
  updateJob as RequestHandler
);

// Close job route
router.patch(
  "/:id/close",
  authMiddleware(["admin", "recruiter"]) as RequestHandler,
  closeJob as RequestHandler
);

// Delete job route
router.delete("/:id", 
  authMiddleware(["admin"]) as RequestHandler,
  deleteJob as RequestHandler
);

// Job applications routes
router.get(
  "/:jobId/applications",
  authMiddleware(["recruiter", "admin"]) as RequestHandler,
  getJobApplications as RequestHandler
);
// Close job route
router.patch(
  "/:id/close",
  authMiddleware(["admin", "recruiter"]) as RequestHandler,
  closeJob as RequestHandler
);

export default router;