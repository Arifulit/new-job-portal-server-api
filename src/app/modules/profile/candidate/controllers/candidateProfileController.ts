import { Request, Response } from "express";
import * as candidateProfileService from "../services/candidateProfileService";
import { CandidateProfile } from "../models/CandidateProfile";
import { User } from "../../../auth/models/User";

const buildCandidateUpdatePayload = (body: Record<string, any>) => {
  const payload = { ...body };

  if (payload.biodata !== undefined && payload.bio === undefined) {
    payload.bio = payload.biodata;
  }

  if (payload.location !== undefined && payload.address === undefined) {
    payload.address = payload.location;
  }

  delete payload.biodata;
  delete payload.location;
  delete payload.role;
  delete payload.user;

  return payload;
};

const formatCandidateProfileResponse = (profile: any) => {
  if (!profile) return profile;

  const userProfile =
    profile.user && typeof profile.user === "object" ? profile.user : undefined;

  return {
    ...profile,
    name: profile.name ?? userProfile?.name ?? "",
    email: profile.email ?? userProfile?.email ?? "",
    phone: profile.phone ?? "",
    bio: profile.bio ?? profile.biodata ?? "",
    biodata: profile.biodata ?? profile.bio ?? "",
    address: profile.address ?? profile.location ?? "",
    location: profile.location ?? profile.address ?? "",
    skills: Array.isArray(profile.skills) ? profile.skills : [],
    experience: Array.isArray(profile.experience) ? profile.experience : [],
    education: Array.isArray(profile.education) ? profile.education : [],
  };
};

const getAuthUserId = (req: Request): string => {
  const user = (req as any).user;
  return String(user?.id || user?._id || "").trim();
};

const getAuthUserRole = (req: Request): string => {
  const user = (req as any).user;
  return String(user?.role || "").toLowerCase().trim();
};

export const createCandidateProfileController = async (req: Request, res: Response) => {
  try {
    console.log("🟦 Controller: Creating/Updating profile");
    console.log("🟦 Request user:", req.user);
    console.log("🟦 Request body:", req.body);
    
    // Check if user is authenticated
    if (!req.user?.id) {
      console.log("⚠️ Controller: No user authenticated");
      return res.status(401).json({ 
        success: false, 
        message: "Authentication required. Please log in to create a profile."
      });
    }

    const userId = req.user.id;
    console.log("🟦 User authenticated, userId:", userId);
    
    // Prepare profile data with authenticated user ID
    const profileData = {
      user: userId,
      name: req.body.name || "",
      phone: req.body.phone || "",
      address: req.body.address || "",
      email: req.user.email || "",
      skills: req.body.skills || [],
      bio: req.body.bio,
      experience: req.body.experience,
      education: req.body.education,
      resume: req.body.resume,
      ...req.body // Spread any other valid fields from the request
    };
    
    // Use findOneAndUpdate with upsert: true to create or update
    const profile = await CandidateProfile.findOneAndUpdate(
      { user: userId },
      profileData,
      { new: true, upsert: true, runValidators: true }
    )
      .populate("resume")
      .populate({ path: "user", select: "-password -__v" })
      .lean();
    
    console.log("✅ Controller: Profile created/updated successfully");
    res.status(201).json({ success: true, data: formatCandidateProfileResponse(profile) });
  } catch (error: any) {
    console.error("❌ Controller Error (create):", error.message);
    
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
    const userId = getAuthUserId(req);
    const userRole = getAuthUserRole(req);
    
    // If user is not authenticated
    if (!userId) {
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

    if (userRole && userRole !== "candidate") {
      return res.status(403).json({
        success: false,
        message: "Only candidate users can access candidate profile"
      });
    }

    console.log("🟦 User authenticated, userId:", userId);
    let profile = await candidateProfileService.getCandidateProfile(userId);
    
    // If no profile exists, initialize a profile so subsequent reads return data.
    if (!profile) {
      const profileData = {
        user: userId,
        name: "",
        phone: "",
        address: "",
        bio: "",
        email: (req as any).user?.email || "",
        skills: [],
        experience: [],
        education: []
      };

      profile = await candidateProfileService.createCandidateProfile(profileData);

      return res.status(200).json({
        success: true,
        isNew: true,
        message: "Profile initialized successfully. Please update your details.",
        data: formatCandidateProfileResponse(profile)
      });
    }

    console.log("✅ Controller: Profile retrieved successfully");
    return res.status(200).json({ 
      success: true, 
      message: "Candidate profile retrieved successfully",
      data: formatCandidateProfileResponse(profile)
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
    res.status(200).json({ success: true, data: formatCandidateProfileResponse(profile) });
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
    const updatePayload = buildCandidateUpdatePayload(req.body || {});
    console.log("🟦 Update data:", updatePayload);
    
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
        name: updatePayload.name || "",
        phone: updatePayload.phone || "",
        address: updatePayload.address || "",
        bio: updatePayload.bio || "",
        email: req.user.email || "", 
        skills: updatePayload.skills || [],
        experience: updatePayload.experience || [],
        education: updatePayload.education || [],
        ...updatePayload
      };
      
      profile = await candidateProfileService.createCandidateProfile(profileData);
      console.log("✅ Controller: New profile created successfully");
      return res.status(201).json({
        success: true,
        message: "Profile created successfully",
        data: formatCandidateProfileResponse(profile)
      });
    }
    
    // If profile exists, update it
    console.log("ℹ️  Updating existing profile");
    await candidateProfileService.updateCandidateProfile(userId, updatePayload);

    if (updatePayload.name !== undefined || updatePayload.email !== undefined) {
      const userUpdates: Record<string, string> = {};
      if (typeof updatePayload.name === "string") userUpdates.name = updatePayload.name.trim();
      if (typeof updatePayload.email === "string") userUpdates.email = updatePayload.email.trim().toLowerCase();
      if (Object.keys(userUpdates).length > 0) {
        await User.findByIdAndUpdate(userId, { $set: userUpdates }, { new: false });
      }
    }
    
    // Get the updated profile
    const updatedProfile = await candidateProfileService.getCandidateProfile(userId);
    
    console.log("✅ Controller: Profile updated successfully");
    return res.status(200).json({ 
      success: true, 
      message: "Profile updated successfully",
      data: formatCandidateProfileResponse(updatedProfile)
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
    const updatePayload = buildCandidateUpdatePayload(req.body || {});
    console.log("🟦 Update data:", updatePayload);
    
    await candidateProfileService.updateCandidateProfile(
      req.params.userId,
      updatePayload
    );

    if (updatePayload.name !== undefined || updatePayload.email !== undefined) {
      const userUpdates: Record<string, string> = {};
      if (typeof updatePayload.name === "string") userUpdates.name = updatePayload.name.trim();
      if (typeof updatePayload.email === "string") userUpdates.email = updatePayload.email.trim().toLowerCase();
      if (Object.keys(userUpdates).length > 0) {
        await User.findByIdAndUpdate(req.params.userId, { $set: userUpdates }, { new: false });
      }
    }
    
    const profile = (await candidateProfileService.getCandidateProfile(req.params.userId)) as any;
    
    if (!profile) {
      console.log("⚠️ Controller: Profile not found for update");
      return res.status(404).json({
        success: false,
        message: "Profile not found"
      });
    }
    
    console.log("✅ Controller: Profile updated successfully");
    res.status(200).json({ success: true, data: formatCandidateProfileResponse(profile) });
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