import { Request, Response } from "express";
import fs from "fs";
import * as recruiterProfileService from "../services/recruiterProfileService";
import cloudinary from "../../../../config/cloudinary";
import { User } from "../../../auth/models/User";

const formatRecruiterProfileResponse = (profile: any) => {
  if (!profile) return profile;

  const companyDetails = profile.company ?? null;
  const userData = profile.user ?? {};

  return {
    _id: profile._id,
    name: userData.name ?? profile.name ?? "",
    email: userData.email ?? profile.email ?? "",
    avatar: profile.avatar ?? userData.avatar ?? "",
    phone: profile.phone ?? "",
    designation: profile.designation ?? "",
    biodata: profile.biodata ?? profile.bio ?? "",
    location: profile.location ?? "",
    role: userData.role ?? "recruiter",
    company: companyDetails,
    companyDetails,
    jobsPosted: profile.jobsPosted ?? 0,
    applicantsCount: profile.applicantsCount ?? 0,
    hires: profile.hires ?? 0,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
};

const getUploadedAvatarFile = (req: Request): Express.Multer.File | undefined => {
  const uploadedFile = (req as any).file as Express.Multer.File | undefined;
  const uploadedFiles = (req as any).files as
    | Record<string, Express.Multer.File[]>
    | Express.Multer.File[]
    | undefined;

  if (uploadedFile) {
    return uploadedFile;
  }

  if (Array.isArray(uploadedFiles)) {
    return uploadedFiles[0];
  }

  return (
    uploadedFiles?.avatar?.[0] ||
    uploadedFiles?.profilePicture?.[0] ||
    uploadedFiles?.image?.[0] ||
    uploadedFiles?.file?.[0]
  );
};

const uploadAvatarToCloudinary = async (file: Express.Multer.File): Promise<string> => {
  try {
    const cloudResult = await cloudinary.uploader.upload(file.path, {
      folder: "job-portal/profile-avatars",
      resource_type: "image",
      type: "upload",
    });

    return cloudResult.secure_url || cloudResult.url;
  } finally {
    if (file.path) {
      fs.unlink(file.path, () => {});
    }
  }
};

const getUploadedCompanyLogoFile = (req: Request): Express.Multer.File | undefined => {
  const uploadedFile = (req as any).file as Express.Multer.File | undefined;
  const uploadedFiles = (req as any).files as
    | Record<string, Express.Multer.File[]>
    | Express.Multer.File[]
    | undefined;

  if (uploadedFile && ["companyLogo", "logo"].includes(uploadedFile.fieldname)) {
    return uploadedFile;
  }

  if (Array.isArray(uploadedFiles)) {
    return uploadedFiles.find((file) => ["companyLogo", "logo"].includes(file.fieldname));
  }

  return uploadedFiles?.companyLogo?.[0] || uploadedFiles?.logo?.[0];
};

const uploadCompanyLogoToCloudinary = async (file: Express.Multer.File): Promise<string> => {
  try {
    const cloudResult = await cloudinary.uploader.upload(file.path, {
      folder: "job-portal/company-logos",
      resource_type: "image",
      type: "upload",
    });

    return cloudResult.secure_url || cloudResult.url;
  } finally {
    if (file.path) {
      fs.unlink(file.path, () => {});
    }
  }
};

const normalizeRecruiterPayload = (input: Record<string, unknown>): Record<string, unknown> => {
  const normalized: Record<string, unknown> = {};
  const company: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (key.startsWith("company[") && key.endsWith("]")) {
      const field = key.slice(8, -1);
      company[field] = value;
      continue;
    }

    normalized[key] = value;
  }

  if (typeof normalized.company === "string") {
    const rawCompany = normalized.company.trim();
    if (rawCompany.startsWith("{") && rawCompany.endsWith("}")) {
      try {
        normalized.company = JSON.parse(rawCompany);
      } catch {
        // Keep raw value if parsing fails.
      }
    }
  }

  if (Object.keys(company).length > 0) {
    const existingCompany =
      normalized.company && typeof normalized.company === "object"
        ? (normalized.company as Record<string, unknown>)
        : {};
    normalized.company = { ...existingCompany, ...company };
  }

  return normalized;
};

export const createRecruiterProfileController = async (req: Request, res: Response) => {
  try {
    const avatarFile = getUploadedAvatarFile(req);
    let uploadedAvatarUrl: string | undefined;
    if (avatarFile) {
      uploadedAvatarUrl = await uploadAvatarToCloudinary(avatarFile);
    }

    // Add the user ID from the authenticated request to the profile data
    const profileData = {
      ...req.body,
      user: req.user?.id
    };

    const profile = await recruiterProfileService.createRecruiterProfile(profileData);

    if (uploadedAvatarUrl && req.user?.id) {
      await User.findByIdAndUpdate(req.user.id, { $set: { avatar: uploadedAvatarUrl } }, { new: false });
    }

    res.status(201).json({ success: true, data: formatRecruiterProfileResponse(profile) });
  } catch (error) {
    console.error('Error creating recruiter profile:', error);
    res.status(500).json({ success: false, message: 'Error creating recruiter profile' });
  }
};

// In recruiterProfileController.ts
export const getRecruiterProfileController = async (req: Request, res: Response) => {
  try {
    // If user is not authenticated
    if (!req.user?.id) {
      return res.status(401).json({ 
        success: false, 
        message: "Authentication required. Please log in to view your profile.",
        error: {
          code: "AUTH_REQUIRED",
          description: "No valid authentication token provided"
        }
      });
    }

    const userId = req.params.userId === 'me' || !req.params.userId ? req.user.id : req.params.userId;
    
    const profile = await recruiterProfileService.getRecruiterProfile(userId);
    
    if (!profile) {
      return res.status(404).json({ 
        success: false, 
        message: "Recruiter profile not found",
        error: {
          code: "PROFILE_NOT_FOUND",
          description: "No recruiter profile exists for this user. Please create a profile first.",
          solution: "Make a POST request to create a new profile"
        }
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: "Recruiter profile retrieved successfully",
      data: formatRecruiterProfileResponse(profile)
    });
    
  } catch (error: any) {
    console.error("❌ Controller Error (getRecruiterProfile):", error.message);
    
    // Handle specific error types
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
        error: {
          code: "INVALID_ID_FORMAT",
          description: "The provided user ID is not in the correct format"
        }
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: "An unexpected error occurred while retrieving the profile",
      error: {
        code: "SERVER_ERROR",
        description: error.message || "Internal server error"
      }
    });
  }
};

export const updateRecruiterProfileController = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const updateData = normalizeRecruiterPayload({ ...(req.body || {}) });

    const avatarFile = getUploadedAvatarFile(req);
    if (avatarFile) {
      updateData.avatar = await uploadAvatarToCloudinary(avatarFile);
    }

    const companyLogoFile = getUploadedCompanyLogoFile(req);
    if (companyLogoFile) {
      const uploadedLogo = await uploadCompanyLogoToCloudinary(companyLogoFile);
      const existingCompany =
        updateData.company && typeof updateData.company === "object"
          ? (updateData.company as Record<string, unknown>)
          : {};
      updateData.company = { ...existingCompany, logo: uploadedLogo };
    }

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No update data provided' 
      });
    }

    // Validate phone number format if provided
    if (updateData.phone && !/^\+?[0-9]{11,15}$/.test(String(updateData.phone))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide a valid phone number' 
      });
    }

    const updatedProfile = await recruiterProfileService.updateRecruiterProfile(userId, updateData);

    if (!updatedProfile) {
      return res.status(404).json({ 
        success: false, 
        message: 'Recruiter profile not found. Please create a profile first.' 
      });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Profile updated successfully',
      data: formatRecruiterProfileResponse(updatedProfile)
    });

  } catch (error) {
    console.error('Error updating recruiter profile:', error);
    res.status(500).json({ 
      success: false, 
      message: 'An error occurred while updating the profile',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
