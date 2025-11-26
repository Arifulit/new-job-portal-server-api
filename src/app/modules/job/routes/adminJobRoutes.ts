import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import authMiddleware from '../../../middleware/auth';
import * as jobController from '../controllers/jobController';
import * as jobAdminController from '../controllers/jobAdminController';
import { json } from 'body-parser';
import { AuthenticatedRequest } from '../../../../types/express';
import { Types } from 'mongoose';

declare module 'express' {
  interface Request {
    queryOptions?: any;
  }
}

const router = Router();

// Add JSON body parser with a limit
router.use(json({ limit: '10kb' }));

// Protect all routes with admin authentication
router.use(authMiddleware(['admin']));

// Middleware to ensure request body is always an object
const ensureBody = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.body) req.body = {};
  next();
};

// Middleware to parse query parameters
const parseQueryParams = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Initialize filters object
  const filters: Record<string, any> = {};
  
  // Parse pagination
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
  const skip = (page - 1) * limit;
  
  // Parse sorting
  let sort: Record<string, 1 | -1> = { createdAt: -1 }; // Default sort by newest
  if (req.query.sortBy) {
    const sortBy = (req.query.sortBy as string).split(',');
    const direction = (req.query.direction as string) || 'desc';
    sort = {};
    sortBy.forEach(field => {
      sort[field] = direction === 'desc' ? -1 as const : 1 as const;
    });
  }

  
  // Build the query options
  (req as any).queryOptions = {
    page: typeof page === 'string' ? parseInt(page, 10) : 1,
    limit: typeof limit === 'string' ? parseInt(limit, 10) : 10,
    sort: sort as Record<string, 1 | -1>,
    filters: filters as Record<string, any>,
    select: '-__v',
    populate: [
      { path: 'createdBy', select: 'name email' },
      { path: 'company', select: 'name logo' }
    ]
  };

  next();
};

// Type guard to check if request is authenticated
const ensureAuthenticated = (req: Request): req is AuthenticatedRequest => {
  return !!(req as AuthenticatedRequest).user;
};

// Admin job management routes
router.get('/', 
  (req, res, next) => {
    if (!ensureAuthenticated(req)) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    parseQueryParams(req, res, next);
  },
  jobController.getAllJobs as RequestHandler
);

router.get('/pending', 
  (req, res, next) => {
    if (!ensureAuthenticated(req)) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    parseQueryParams(req, res, next);
  },
  jobAdminController.getPendingJobs as RequestHandler
);

router.get('/approved', 
  (req, res, next) => {
    if (!ensureAuthenticated(req)) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    parseQueryParams(req, res, next);
  },
  jobAdminController.adminGetApprovedJobs as RequestHandler
);

router.get('/all', 
  (req, res, next) => {
    if (!ensureAuthenticated(req)) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    parseQueryParams(req, res, next);
  },
  jobAdminController.adminGetAllJobs as RequestHandler
);

router.get('/recruiter-jobs', 
  (req, res, next) => {
    if (!ensureAuthenticated(req)) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    parseQueryParams(req, res, next);
  },
  jobAdminController.getRecruiterJobs as RequestHandler
);

// Single job routes
router.get('/:id', jobController.getJobById as RequestHandler);

// Job approval workflow
router.post('/:jobId/approve', ensureBody, jobAdminController.approveJob as RequestHandler);
router.post('/:jobId/reject', ensureBody, jobAdminController.rejectJob as RequestHandler);
router.post('/:jobId/close', ensureBody, jobAdminController.closeJob as any);

// Job CRUD operations
router.put('/:id', ensureBody, jobController.updateJob as any);
router.delete('/:id', jobController.deleteJob as any);

export default router;
