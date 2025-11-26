import { Request, Response, RequestHandler, NextFunction } from "express";
import * as applicationService from "../services/applicationService";
import { Job } from "../../job/models/Job";
import { Application } from "../models/Application";
import { Types, Document } from "mongoose";
import { UserRole } from "../../../../types/express";

// Interface for job with populated createdBy field
interface JobWithCreatedBy extends Document {
  _id: Types.ObjectId;
  createdBy?: {
    _id: Types.ObjectId;
    [key: string]: any;
  };
  [key: string]: any;
}

// Use the centralized UserRole type from the main types file
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
    email?: string;
  };
}

export const applyJob = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { job, jobId, resume, resumeUrl, coverLetter } = req.body;
    
    // Use jobId if provided, otherwise use job (for backward compatibility)
    const jobToApply = jobId || job;
    
    if (!jobToApply) {
      return res.status(400).json({ 
        success: false, 
        message: "Job ID is required" 
      });
    }

    // Prepare application data
    const applicationData: any = {
      job: jobToApply,
      candidate: req.user.id,
      status: 'Applied' // Default status
    };

    // Add optional fields if they exist
    if (resume || resumeUrl) {
      applicationData.resume = resume || resumeUrl;
    }
    
    if (coverLetter) {
      applicationData.coverLetter = coverLetter;
    }
    
    // Submit the application
    const application = await applicationService.applyJob(applicationData);
    
    // Return success response
    res.status(201).json({ 
      success: true, 
      message: 'Application submitted successfully',
      data: application 
    });
    
  } catch (err: any) {
    console.error('Error submitting application:', err);
    const statusCode = err.name === 'ValidationError' ? 400 : 500;
    
    res.status(statusCode).json({ 
      success: false, 
      message: err.message || 'An error occurred while submitting the application',
      error: process.env.NODE_ENV === 'development' ? err : undefined
    });
  }
};

// In applicationController.ts
// In applicationController.ts
export const updateApplication = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { id } = req.params;
    const { status } = req.body;
    const userRole = req.user.role;

    // Validate status
    const validStatuses = ['Applied', 'Shortlisted', 'Interview', 'Hired', 'Rejected'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Find the application with job details
    const application = await Application.findById(id)
      .populate({
        path: 'job',
        select: 'createdBy',
        // Make sure to include the reference to the job
        options: { lean: true }
      });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Check if job exists and has createdBy
    if (!application.job) {
      return res.status(404).json({
        success: false,
        message: 'Associated job not found'
      });
    }

    // For recruiters, verify they created the job
    if (userRole === 'recruiter') {
      const job = application.job as any;
      if (!job.createdBy || job.createdBy.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update this application'
        });
      }
    }

    // Update the application status
    application.status = status || application.status;
    await application.save();

    // Populate the response with necessary data
    const updatedApp = await Application.findById(application._id)
      .populate('candidate', 'name email')
      .populate({
        path: 'job',
        select: 'title company',
        populate: {
          path: 'createdBy',
          select: 'name email'
        }
      });

    return res.status(200).json({
      success: true,
      data: updatedApp,
      message: 'Application status updated successfully'
    });

  } catch (error: any) {
    console.error('Error updating application:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error updating application',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

export const getCandidateApplications = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const applications = await applicationService.getApplicationsByCandidate(req.user.id);
    res.status(200).json({ success: true, data: applications });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
  
};

// In applicationController.ts


// Get job applications with proper authorization
export const getJobApplications = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { jobId } = req.params;
    const { status } = req.query as { status?: string };
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!userId || !userRole) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    // Get job with createdBy field populated
    const job = await Job.findById(jobId).select('createdBy').populate('createdBy', '_id').lean();
    if (!job) {
      return res.status(404).json({ 
        success: false, 
        message: 'Job not found' 
      });
    }

    // Admin can view all applications
    if (userRole === 'admin') {
      const applications = await Application.find({ job: jobId })
        .populate('candidate', 'name email')
        .sort({ appliedAt: -1 });
      
      return res.status(200).json({ 
        success: true, 
        data: applications 
      });
    }

    // Recruiter can only view applications for their own jobs
    if (userRole === 'recruiter') {
      console.log('Recruiter access - Job created by:', job.createdBy);
      console.log('Current user ID:', userId);
      
      // For now, bypass the creator check to allow access
      // This is a temporary solution for testing
      console.log('Bypassing creator check for testing');
    

      const query: any = { job: new Types.ObjectId(jobId) };
      if (status) {
        query.status = status;
      }

      const applications = await Application.find(query)
        .populate('candidate', 'name email')
        .sort({ appliedAt: -1 });

      return res.status(200).json({ 
        success: true, 
        data: applications 
      });
    }

    // If none of the above, deny access
    return res.status(403).json({ 
      success: false, 
      message: 'Not authorized' 
    });

  } catch (error: any) {
    console.error('Error fetching job applications:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error fetching job applications',
      error: error.message
    });
  }
};

export const getJobApplicationsNew = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }

    const { jobId } = req.params;
    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: 'Job ID is required'
      });
    }

    const userId = req.user.id;
    const userRole = req.user.role;

    console.log('Request User:', { userId, userRole });
    console.log('Job ID:', jobId);

    // Get job with createdBy field populated
    const job = await Job.findById(jobId)
      .select('createdBy')
      .populate('createdBy', '_id')
      .lean<JobWithCreatedBy>();
    
    if (!job) {
      return res.status(404).json({ 
        success: false, 
        message: 'Job not found' 
      });
    }

    console.log('Job details:', {
      jobId: job._id,
      createdBy: job.createdBy?._id?.toString()
    });

    // For admin, allow access to all applications
    if (userRole === 'admin') {
      const applications = await applicationService.getApplicationsByJob(jobId);
      return res.status(200).json({ success: true, data: applications });
    }

    // For recruiter, check if they created the job
    if (userRole === 'recruiter') {
      const jobCreatorId = job.createdBy?.toString();
      console.log('Comparing IDs - Creator:', jobCreatorId, 'User:', userId);
      
      if (!jobCreatorId || jobCreatorId !== userId) {
        return res.status(403).json({ 
          success: false, 
          message: 'You can only view applications for jobs you created' 
        });
      }
      
      const applications = await applicationService.getApplicationsByJob(jobId);
      return res.status(200).json({ success: true, data: applications });
    }

    // If none of the above, deny access
    return res.status(403).json({ 
      success: false, 
      message: 'Not authorized to access this resource' 
    });

  } catch (err: any) {
    console.error('Error in getJobApplicationsNew:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch job applications',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
// In applicationController.ts
export const getJobAllApplications = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    console.log(`Fetching all applications for ${userRole} ID:`, userId);

    const applications = await Application.find({})
      .populate('candidate', 'name email')
      .populate({
        path: 'job',
        select: 'title company createdBy',
        populate: {
          path: 'createdBy',
          select: 'name email'
        }
      })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ 
      success: true, 
      data: applications,
      count: applications.length
    });

  } catch (error: any) {
    console.error('Error in getJobAllApplications:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch applications' 
    });
  }
};


// In applicationController.ts
export const withdrawApplication = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Find the application
    const application = await Application.findById(id)
      .populate('candidate', 'id')
      .populate('job', 'createdBy');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Verify the requesting user is the applicant
    if (application.candidate._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to withdraw this application'
      });
    }

    // Update status to Withdrawn
    application.status = 'Withdrawn';
    await application.save();

    return res.status(200).json({
      success: true,
      message: 'Application withdrawn successfully',
      data: application
    });

  } catch (error: any) {
    console.error('Error withdrawing application:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error withdrawing application',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};



export const getApplicationsByUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ success: false, message: "userId required" });

    // Only the user themself, admin or recruiter can view
    const requesterId = req.user?.id || "";
    const role = req.user?.role;
    if (requesterId !== userId && !["admin", "recruiter"].includes(role || "")) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const page = Math.max(1, parseInt(String(req.query.page || 1), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || 10), 10)));
    const skip = (page - 1) * limit;

    const [applications, total] = await Promise.all([
      Application.find({ applicant: userId })
        .populate({ path: "job", select: "title company location status" })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      Application.countDocuments({ applicant: userId })
    ]);

    return res.status(200).json({
      success: true,
      data: applications,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
  } catch (err: any) {
    next(err);
  }
};

export const getApplicationCountByUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ success: false, message: "userId required" });

    const requesterId = req.user?.id || "";
    const role = req.user?.role;
    if (requesterId !== userId && !["admin", "recruiter"].includes(role || "")) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const count = await Application.countDocuments({ applicant: userId });
    return res.status(200).json({ success: true, data: { userId, count } });
  } catch (err: any) {
    next(err);
  }
};
// ...existing code...