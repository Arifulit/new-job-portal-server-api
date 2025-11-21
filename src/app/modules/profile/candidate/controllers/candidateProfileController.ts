import { Request, Response } from "express";
import { Types } from "mongoose";
import * as candidateProfileService from "../services/candidateProfileService";

export const createCandidateProfileController = async (req: Request, res: Response) => {
  try {
    console.log("🟦 Controller: Creating profile");
    console.log("🟦 Request body:", req.body);
    
    const profile = await candidateProfileService.createCandidateProfile(req.body);
    
    console.log("✅ Controller: Profile created successfully");
    res.status(201).json({ success: true, data: profile });
  } catch (error: any) {
    console.error("❌ Controller Error (create):", error.message);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Profile already exists for this user"
      });
    }
    
    // Handle validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.errors
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: error.message || "Error creating profile" 
    });
  }
};

export const getCurrentCandidateProfileController = async (req: Request, res: Response) => {
  try {
    console.log("🟦 Controller: Getting current candidate profile");
    
    // If user is not authenticated
    if (!req.user?.id) {
      console.log("⚠️ Controller: No user authenticated");
      return res.status(401).json({ 
        success: false, 
        message: "Authentication required. Please log in to view your profile.",
        error: {
          code: "AUTH_REQUIRED",
          description: "No valid authentication token provided"
        }
      });
    }

    console.log("🟦 User authenticated, userId:", req.user.id);
    let profile = await candidateProfileService.getCandidateProfile(req.user.id);
    
    // If no profile exists, return an empty profile with default values
    if (!profile) {
      profile = {
        user: new Types.ObjectId(req.user.id.toString()),
        personalInfo: {
          name: "",
          email: req.user.email || "",
          phone: "",
          address: ""
        },
        education: [],
        experience: [],
        skills: [],
        resume: undefined,
        isNew: true // Flag to indicate this is a new profile
      };
      
      return res.status(200).json({
        success: true,
        data: profile,
        message: "No profile found. Please update to create a new profile."
      });
    }

    console.log("✅ Controller: Profile retrieved successfully");
    return res.status(200).json({ 
      success: true, 
      message: "Candidate profile retrieved successfully",
      data: profile 
    });
    
  } catch (error: any) {
    console.error("❌ Controller Error (getCurrentCandidateProfile):", error.message);
    
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

export const getCandidateProfileController = async (req: Request, res: Response) => {
  try {
    console.log("🟦 Controller: Getting profile");
    console.log("🟦 UserId param:", req.params.userId);
    
    const profile = await candidateProfileService.getCandidateProfile(req.params.userId);
    
    if (!profile) {
      console.log("⚠️ Controller: Profile not found");
      return res.status(404).json({ 
        success: false, 
        message: "Profile not found" 
      });
    }
    
    console.log("✅ Controller: Profile retrieved successfully");
    res.status(200).json({ success: true, data: profile });
  } catch (error: any) {
    console.error("❌ Controller Error (get):", error.message);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Error getting profile" 
    });
  }
};

export const updateCurrentCandidateProfileController = async (req: Request, res: Response) => {
  try {
    console.log("🟦 Controller: Updating/Creating current candidate profile");
    console.log("🟦 User from request:", req.user);
    console.log("🟦 Update data:", req.body);
    
    // Check if user is authenticated
    if (!req.user?.id) {
      console.log("⚠️ Controller: No user authenticated");
      return res.status(401).json({ 
        success: false, 
        message: "Authentication required. Please log in to update your profile."
      });
    }

    const userId = req.user.id;
    console.log("🟦 User authenticated, userId:", userId);
    
    // Check if profile exists
    let profile = await candidateProfileService.getCandidateProfile(userId);
    
    // If profile doesn't exist, create a new one
    if (!profile) {
      console.log("ℹ️  Profile doesn't exist, creating new one");
      const profileData = {
        user: userId,
        ...req.body,
        // Ensure required fields have default values if not provided
        personalInfo: {
          email: req.user.email || "",
          phone: "",
          address: "",
          ...req.body.personalInfo
        },
        education: req.body.education || [],
        experience: req.body.experience || [],
        skills: req.body.skills || []
      };
      
      profile = await candidateProfileService.createCandidateProfile(profileData);
      console.log("✅ Controller: New profile created successfully");
      return res.status(201).json({
        success: true,
        message: "Profile created successfully",
        data: profile
      });
    }
    
    // If profile exists, update it
    console.log("ℹ️  Updating existing profile");
    await candidateProfileService.updateCandidateProfile(userId, req.body);
    
    // Get the updated profile
    const updatedProfile = await candidateProfileService.getCandidateProfile(userId);
    
    console.log("✅ Controller: Profile updated successfully");
    return res.status(200).json({ 
      success: true, 
      message: "Profile updated successfully",
      data: updatedProfile 
    });
  } catch (error: any) {
    console.error("❌ Controller Error (updateCurrentCandidateProfile):", error.message);
    
    // Handle validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.errors
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: error.message || "Error updating profile" 
    });
  }
};

export const updateCandidateProfileController = async (req: Request, res: Response) => {
  try {
    console.log("🟦 Controller: Updating profile");
    console.log("🟦 UserId param:", req.params.userId);
    console.log("🟦 Update data:", req.body);
    
    await candidateProfileService.updateCandidateProfile(
      req.params.userId,
      req.body
    );
    
    const profile = (await candidateProfileService.getCandidateProfile(req.params.userId)) as any;
    
    if (!profile) {
      console.log("⚠️ Controller: Profile not found for update");
      return res.status(404).json({
        success: false,
        message: "Profile not found"
      });
    }
    
    console.log("✅ Controller: Profile updated successfully");
    res.status(200).json({ success: true, data: profile });
  } catch (error: any) {
    console.error("❌ Controller Error (update):", error.message);
    
    // Handle validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.errors
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: error.message || "Error updating profile" 
    });
  }
};