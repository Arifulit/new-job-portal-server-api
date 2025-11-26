import { Router, Request, Response, NextFunction } from 'express';
import authMiddleware from '../../../middleware/auth';
import * as jobAdminController from '../controllers/jobAdminController';
import * as jobController from '../controllers/jobController';
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
  // Parse pagination
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
  const skip = (page - 1) * limit;
  
  // Parse sorting
  let sort: Record<string, 1 | -1> = { createdAt: -1 }; // Default sort by newest
  if (req.query.sortBy) {
    const sortBy = (req.query.sortBy as string).split(',');
    sort = {};
    sortBy.forEach(field => {
      if (field.startsWith('-')) {
        sort[field.slice(1)] = -1;
      } else {
        sort[field] = 1;
      }
    });
  }

  // Parse filters
  const filters: any = {};
  const filterableFields = ['status', 'isApproved', 'employmentType', 'jobType', 'experienceLevel'];
  
  filterableFields.forEach(field => {
    if (req.query[field]) {
      filters[field] = req.query[field];
    }
  });

  // Add search
  if (req.query.search) {
    filters.$or = [
      { title: { $regex: req.query.search, $options: 'i' } },
      { description: { $regex: req.query.search, $options: 'i' } },
      { 'company.name': { $regex: req.query.search, $options: 'i' } }
    ];
  }

  // Add to request object
  req.queryOptions = {
    filters,
    sort,
    skip,
    limit,
    select: '-__v',
    populate: [
      { path: 'createdBy', select: 'name email' },
      { path: 'company', select: 'name logo' }
    ]
  };

  next();
};

// Admin job management routes
router.get('/', parseQueryParams, jobController.getAllJobs as any);
router.get('/pending', parseQueryParams, jobAdminController.getPendingJobs as any);
router.get('/approved', parseQueryParams, jobAdminController.adminGetApprovedJobs as any);
router.get('/recruiter-jobs', parseQueryParams, jobAdminController.getRecruiterJobs as any);
router.get('/:id', jobController.getJobById as any);

// Job approval workflow
router.post('/:jobId/approve', ensureBody, jobAdminController.approveJob as any);
router.post('/:jobId/reject', ensureBody, jobAdminController.rejectJob as any);
router.post('/:jobId/close', ensureBody, jobAdminController.closeJob as any);

// Job CRUD operations
router.put('/:id', ensureBody, jobController.updateJob as any);
router.delete('/:id', jobController.deleteJob as any);

export default router;
