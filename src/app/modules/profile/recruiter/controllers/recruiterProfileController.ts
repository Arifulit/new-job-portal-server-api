import { Request, Response } from "express";
import * as recruiterProfileService from "../services/recruiterProfileService";

const formatRecruiterProfileResponse = (profile: any) => {
  if (!profile) return profile;

  return {
    ...profile,
    biodata: profile.biodata ?? profile.bio ?? "",
    location: profile.location ?? "",
  };
};

export const createRecruiterProfileController = async (req: Request, res: Response) => {
  try {
    // Add the user ID from the authenticated request to the profile data
    const profileData = {
      ...req.body,
      user: req.user?.id
    };
    const profile = await recruiterProfileService.createRecruiterProfile(profileData);
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
    const updateData = req.body;

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
    if (updateData.phone && !/^\+?[0-9]{11,15}$/.test(updateData.phone)) {
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
