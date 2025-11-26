// src/app/modules/job/controllers/jobController.ts
import { Response, NextFunction } from "express";
import * as jobService from "../services/jobService";
import { AuthenticatedRequest } from "../../../../types/express";
import { IJobUpdateData, Job } from "../models/Job";
import { Types } from "mongoose";

type SearchOptions = {
  filters?: any;
  sort?: any;
  page?: number;
  limit?: number;
};

export type AuthenticatedHandler = (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<Response | void>;

// Get job by ID
export const getJobById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid job ID' 
      });
    }

    const job = await jobService.getJobById(id);
    
    if (!job) {
      return res.status(404).json({ 
        success: false,
        message: 'Job not found' 
      });
    }

    // Allow all authenticated users to view job details
    return res.status(200).json({
      success: true,
      data: job
    });
  } catch (error) {
    console.error('Error in getJobById:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        description: error instanceof Error ? error.message : 'An unknown error occurred'
      }
    });
  }
};

// Input validation for job creation
const validateJobInput = (data: any): { isValid: boolean; message?: string } => {
  if (!data.title || typeof data.title !== 'string' || data.title.trim().length < 5) {
    return { isValid: false, message: 'Title is required and must be at least 5 characters long' };
  }
  if (!data.description || typeof data.description !== 'string' || data.description.trim().length < 20) {
    return { isValid: false, message: 'Description is required and must be at least 20 characters long' };
  }
  if (!data.location || typeof data.location !== 'string') {
    return { isValid: false, message: 'Location is required' };
  }
  return { isValid: true };
};

// Create a new job
export const createJob: AuthenticatedHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Only admin and recruiter can create jobs
    if (req.user.role !== 'admin' && req.user.role !== 'recruiter') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only admin and recruiters can create job postings' 
      });
    }

    // Validate input
    const validation = validateJobInput(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.message || 'Invalid job data'
      });
    }

    const jobData = {
      ...req.body,
      createdBy: new Types.ObjectId(req.user.id)
    };
    
    const job = await jobService.createJob(jobData);
    return res.status(201).json({ 
      success: true, 
      data: job 
    });
  } catch (error: any) {
    next(error);
  }
};

// Update job
export const updateJob: AuthenticatedHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const jobId = req.params.id;
    
    if (!jobId || !Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job ID format'
      });
    }

    // Get the job to check permissions
    const job = await jobService.getJobById(jobId);
    
    // Check permissions
    const isAdmin = req.user.role === 'admin';
    const isOwner = job.createdBy.toString() === req.user.id;
    
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ 
        success: false, 
        message: 'You are not authorized to update this job' 
      });
    }

    // Prepare update data
    const updateData: IJobUpdateData = {
      ...req.body,
      // Prevent updating createdBy and timestamps through the API
      createdBy: undefined,
      createdAt: undefined,
      updatedAt: undefined
    };

    // Validate the update data if needed
    if (updateData.title && (typeof updateData.title !== 'string' || updateData.title.trim().length < 5)) {
      return res.status(400).json({
        success: false,
        message: 'Title must be at least 5 characters long'
      });
    }

    const updatedJob = await jobService.updateJob(jobId, updateData);
    
    return res.status(200).json({ 
      success: true, 
      data: updatedJob 
    });
  } catch (error: any) {
    next(error);
  }
};

// Delete job
export const deleteJob: AuthenticatedHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const jobId = req.params.id;
    
    if (!jobId || !Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job ID format'
      });
    }

    // Get the job to check permissions
    const job = await jobService.getJobById(jobId);
    
    // Check permissions
    const isAdmin = req.user.role === 'admin';
    const isOwner = job.createdBy.toString() === req.user.id;
    
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ 
        success: false, 
        message: 'You are not authorized to delete this job' 
      });
    }

    await jobService.deleteJob(jobId);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Job deleted successfully' 
    });
  } catch (error: any) {
    if (error.message === 'Job not found') {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    next(error);
  }
};

// Close job (Admin only)
export const closeJob: AuthenticatedHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const jobId = req.params.jobId || req.params.id;
    
    if (!jobId || !Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job ID format'
      });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin can close jobs'
      });
    }

    const job = await jobService.closeJob(jobId, req.user._id);

    return res.status(200).json({
      success: true,
      data: job,
      message: 'Job closed successfully'
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

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));
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

// Get approved jobs
export const getApprovedJobs: AuthenticatedHandler = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    const sort: { [key: string]: 1 | -1 } = {};
    sort[String(sortBy)] = sortOrder === 'asc' ? 1 : -1;

    const [jobs, total] = await Promise.all([
      jobService.getApprovedJobs({
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

// Get all jobs with filtering and pagination
export const getAllJobs: AuthenticatedHandler = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      ...filters
    } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    const sort: { [key: string]: 1 | -1 } = {};
    sort[String(sortBy)] = sortOrder === 'asc' ? 1 : -1;

    const queryFilters = {
      ...filters,
      ...(!filters?.status && !filters?.isApproved ? {
        status: 'approved',
        isApproved: 'true'
      } : {})
    };

    const [jobs, total] = await Promise.all([
      jobService.getJobs({
        filters: queryFilters,
        sort,
        skip,
        limit: limitNum,
        populate: [
          { path: 'createdBy', select: 'name email' },
          { path: 'company', select: 'name logo' }
        ]
      }),
      Job.countDocuments(filters)
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


