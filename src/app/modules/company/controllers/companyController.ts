import { Request, Response } from "express";
import * as companyService from "../services/companyService";

export const createCompany = async (req: Request, res: Response) => {
  try {
    const requesterRole = (req as any).user?.role;
    const payload: any = {
      ...req.body,
      isVerified: req.body?.isVerified ?? req.body?.verified ?? false
    };

    delete payload.verified;

    // Recruiters can create a company, but verification is always pending until admin approves.
    if (requesterRole === 'recruiter') {
      payload.isVerified = false;
      payload.verifiedAt = null;
      payload.verifiedBy = null;
    }

    const company = await companyService.createCompany(payload);
    res.status(201).json({ success: true, data: company });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const getCompanies = async (req: Request, res: Response) => {
  try {
    const companies = await companyService.getAllCompanies();
    res.status(200).json({ success: true, data: companies });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getPendingCompanies = async (req: Request, res: Response) => {
  try {
    const companies = await companyService.getPendingCompanies();
    return res.status(200).json({
      success: true,
      data: companies,
      total: companies.length
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const getCompany = async (req: Request, res: Response) => {
  try {
    const company = await companyService.getCompanyById(req.params.id);
    res.status(200).json({ success: true, data: company });
  } catch (err: any) {
    res.status(404).json({ success: false, message: err.message });
  }
};

export const getCompanyProfile = async (req: Request, res: Response) => {
  try {
    const profile = await companyService.getCompanyProfile(req.params.id, {
      reviewsLimit: Number(req.query.reviewsLimit || 10),
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || req.query.jobsLimit || 10),
    });

    return res.status(200).json({ success: true, data: profile });
  } catch (err: any) {
    return res.status(404).json({ success: false, message: err.message });
  }
};

export const createCompanyReview = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id?.toString() || (req.user as any)?.id?.toString();
    const companyId = req.params.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    // Check if recruiter is trying to review their own company
    const RecruiterProfile = require("../../profile/recruiter/models/RecruiterProfile").RecruiterProfile;
    const recruiterProfile = await RecruiterProfile.findOne({ user: userId });
    
    if (recruiterProfile && recruiterProfile.company?.toString() === companyId) {
      return res.status(403).json({ 
        success: false, 
        message: "You cannot review your own company" 
      });
    }

    const review = await companyService.createCompanyReview(req.params.id, userId, {
      rating: req.body?.rating,
      review: req.body?.review,
    });

    return res.status(201).json({ success: true, data: review });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const updateCompanyReview = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id?.toString() || (req.user as any)?.id?.toString();
    const companyId = req.params.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    // Check if recruiter is trying to update review for their own company
    const RecruiterProfile = require("../../profile/recruiter/models/RecruiterProfile").RecruiterProfile;
    const recruiterProfile = await RecruiterProfile.findOne({ user: userId });
    
    if (recruiterProfile && recruiterProfile.company?.toString() === companyId) {
      return res.status(403).json({ 
        success: false, 
        message: "You cannot review your own company" 
      });
    }

    const review = await companyService.updateCompanyReview(req.params.id, userId, {
      rating: req.body?.rating,
      review: req.body?.review,
    });

    return res.status(200).json({ success: true, data: review });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const deleteCompanyReview = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id?.toString() || (req.user as any)?.id?.toString();

    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    await companyService.deleteCompanyReview(req.params.id, userId);
    return res.status(200).json({ success: true, message: "Review deleted successfully" });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const moderateCompanyReview = async (req: Request, res: Response) => {
  try {
    const adminId = (req.user as any)?._id?.toString() || (req.user as any)?.id?.toString();

    if (!adminId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const moderated = await companyService.moderateCompanyReview(
      req.params.id,
      req.params.reviewId,
      adminId,
      { isVisible: Boolean(req.body?.isVisible) },
    );

    return res.status(200).json({ success: true, data: moderated });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const updateCompany = async (req: Request, res: Response) => {
  try {
    const payload: any = {
      ...req.body,
      ...(req.body?.verified !== undefined ? { isVerified: Boolean(req.body.verified) } : {})
    };
    delete payload.verified;

    const company = await companyService.updateCompany(req.params.id, payload);
    res.status(200).json({ success: true, data: company });
  } catch (err: any) {
    res.status(404).json({ success: false, message: err.message });
  }
};

export const deleteCompany = async (req: Request, res: Response) => {
  try {
    await companyService.deleteCompany(req.params.id);
    res.status(200).json({ success: true, message: "Company deleted" });
  } catch (err: any) {
    res.status(404).json({ success: false, message: err.message });
  }
};

export const setCompanyVerification = async (req: Request, res: Response) => {
  try {
    const { approved = true } = req.body || {};
    const adminId = (req.user as any)?._id?.toString() || (req.user as any)?.id?.toString();

    const company = await companyService.updateCompany(req.params.id, {
      isVerified: Boolean(approved),
      verifiedAt: approved ? new Date() : null,
      verifiedBy: approved && adminId ? (adminId as any) : null
    } as any);

    return res.status(200).json({
      success: true,
      message: approved ? 'Company verified successfully' : 'Company verification revoked successfully',
      data: company
    });
  } catch (err: any) {
    return res.status(404).json({ success: false, message: err.message });
  }
};
