import { Response, NextFunction } from 'express';
import * as jobService from '../services/jobService';
import { AuthenticatedRequest } from '../../../../types/express';
import { Job } from '../models/Job';

type AuthenticatedHandler = (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<Response | void>;

// Approve a job (Admin only)
export const approveJob: AuthenticatedHandler = async (req, res, next) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin can approve jobs'
      });
    }

    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: 'Job ID is required'
      });
    }

    const job = await jobService.approveJob(jobId, req.user._id);

    return res.status(200).json({
      success: true,
      data: job,
      message: 'Job approved successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Reject a job (Admin only)
export const rejectJob: AuthenticatedHandler = async (req, res, next) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin can reject jobs'
      });
    }

    const { jobId } = req.params;
    const { reason } = req.body;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: 'Job ID is required'
      });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required and must be at least 5 characters long'
      });
    }

    const job = await jobService.rejectJob(jobId, req.user._id, reason);

    return res.status(200).json({
      success: true,
      data: job,
      message: 'Job rejected successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get pending jobs (Admin only)
// Close a job (Admin only)
export const closeJob: AuthenticatedHandler = async (req, res, next) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin can close jobs'
      });
    }

    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: 'Job ID is required'
      });
    }

    const job = await jobService.closeJob(jobId, req.user._id);

    return res.status(200).json({
      success: true,
      message: 'Job closed successfully',
      data: job
    });
  } catch (error) {
    next(error);
  }
};

export const getPendingJobs: AuthenticatedHandler = async (req, res, next) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin can view pending jobs'
      });
    }

    const { 
      page = 1, 
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const sort: { [key: string]: 1 | -1 } = {};
    sort[String(sortBy)] = sortOrder === 'asc' ? 1 : -1;

    const [jobs, total] = await Promise.all([
      jobService.getPendingJobs({
        filters: { status: 'pending' },
        sort,
        skip,
        limit: limitNum,
        populate: [
          { path: 'createdBy', select: 'name email' },
          { path: 'company', select: 'name logo' }
        ]
      }),
      Job.countDocuments({ status: 'pending' })
    ]);

    return res.status(200).json({
      success: true,
      data: jobs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const adminGetApprovedJobs: AuthenticatedHandler = async (req, res, next) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin can view approved jobs'
      });
    }

    const { 
      page = 1, 
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const sort: { [key: string]: 1 | -1 } = {};
    sort[String(sortBy)] = sortOrder === 'asc' ? 1 : -1;

    const [jobs, total] = await Promise.all([
      jobService.adminGetApprovedJobs({
        filters: { status: 'approved', isApproved: true },
        sort,
        skip,
        limit: limitNum,
        populate: [
          { path: 'createdBy', select: 'name email' },
          { path: 'company', select: 'name logo' }
        ]
      }),
      Job.countDocuments({ status: 'approved', isApproved: true })
    ]);

    return res.status(200).json({
      success: true,
      data: jobs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
};
<<<<<<< HEAD

// Get all jobs created by recruiters (Admin only)
export const getRecruiterJobs: AuthenticatedHandler = async (req, res, next) => {
=======
// In jobAdminController.ts, add this before the last closing brace
export const adminGetAllJobs: AuthenticatedHandler = async (req, res, next) => {
>>>>>>> 15b495b52251226541944fc449b6f251d76d36f8
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
<<<<<<< HEAD
        message: 'Only admin can view recruiter jobs'
=======
        message: 'Only admin can view all jobs'
>>>>>>> 15b495b52251226541944fc449b6f251d76d36f8
      });
    }

    const { 
      page = 1, 
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
<<<<<<< HEAD
      status,
      ...filters
    } = req.query;

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 10));
=======
      ...filters
    } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));
>>>>>>> 15b495b52251226541944fc449b6f251d76d36f8
    const skip = (pageNum - 1) * limitNum;

    const sort: { [key: string]: 1 | -1 } = {};
    sort[String(sortBy)] = sortOrder === 'asc' ? 1 : -1;

<<<<<<< HEAD
    // Build filters
    const queryFilters: any = { ...filters };
    if (status) {
      queryFilters.status = status;
    }

    const [jobs, total] = await Promise.all([
      jobService.getJobsByCreatorRole('recruiter', {
        filters: queryFilters,
        sort,
        skip,
        limit: limitNum,
        populate: [
          { path: 'createdBy', select: 'name email role' },
          { path: 'company', select: 'name logo' }
        ]
      }),
      Job.countDocuments({ 
        createdBy: { 
          $in: await (await import('../../user/models/User')).find({ role: 'recruiter' }).distinct('_id')
        },
        ...queryFilters
      })
=======
    const [jobs, total] = await Promise.all([
      jobService.getAllJobsForAdmin({
        filters,
        sort,
        skip,
        limit: limitNum
      }),
      Job.countDocuments(filters)
>>>>>>> 15b495b52251226541944fc449b6f251d76d36f8
    ]);

    return res.status(200).json({
      success: true,
      data: jobs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
<<<<<<< HEAD
};
// ...existing code...
export const getAllJobsForAdminOrRecruiter: AuthenticatedHandler = async (req, res, next) => {
  try {
    const role = req.user?.role;
    if (!role || !['admin', 'recruiter'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' });
    }

    const page = Math.max(1, parseInt(String(req.query.page || 1), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || 50), 10)));
    const skip = (page - 1) * limit;

    const filter: any = {};
    // optional: allow status/company filters via query params
    if (req.query.status) filter.status = String(req.query.status);
    if (req.query.company) filter.company = String(req.query.company);

    const [jobs, total] = await Promise.all([
      Job.find(filter).populate('createdBy', 'name email role').populate('company', 'name logo').skip(skip).limit(limit).sort({ createdAt: -1 }).lean().exec(),
      Job.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      data: jobs,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    next(error);
  }
};
// ...existing code...
=======
};
>>>>>>> 15b495b52251226541944fc449b6f251d76d36f8
