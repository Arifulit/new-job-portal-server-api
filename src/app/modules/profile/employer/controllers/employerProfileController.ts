// import { Request, Response } from "express";
// import * as employerProfileService from "../services/employerProfileService";

// export const createEmployerProfileController = async (req: Request, res: Response) => {
//   const profile = await employerProfileService.createEmployerProfile(req.body);
//   res.status(201).json({ success: true, data: profile });
// };

// export const getEmployerProfileController = async (req: Request, res: Response) => {
//   const profile = await employerProfileService.getEmployerProfile(req.params.userId);
//   res.status(200).json({ success: true, data: profile });
// };

// export const updateEmployerProfileController = async (req: Request, res: Response) => {
//   const profile = await employerProfileService.updateEmployerProfile(req.params.userId, req.body);
//   res.status(200).json({ success: true, data: profile });
// };

// src/modules/profile/employer/controllers/employerProfileController.ts
import { Request, Response } from "express";
import * as employerProfileService from "../services/employerProfileService";

export const createEmployerProfileController = async (req: Request, res: Response) => {
  try {
    const profile = await employerProfileService.createEmployerProfile(req.body);
    return res.status(201).json({ success: true, data: profile });
  } catch (err: any) {
    console.error("createEmployerProfileController error:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};

export const getCurrentEmployerProfileController = async (req: Request, res: Response) => {
  try {
    console.log("🟦 Controller: Getting current employer profile");
    console.log("🟦 User from request:", req.user);
    console.log("🟦 Authorization header:", req.headers.authorization);
    
    // If user is authenticated, get their profile
    if (req.user?.id) {
      console.log("🟦 User authenticated, userId:", req.user.id);
      const profile = await employerProfileService.getEmployerProfile(req.user.id);
      if (!profile) {
        console.log("⚠️ Controller: Profile not found for userId:", req.user.id);
        return res.status(404).json({ success: false, message: "Profile not found" });
      }
      console.log("✅ Controller: Profile retrieved successfully");
      return res.status(200).json({ success: true, data: profile });
    }
    
    // If not authenticated, return error asking for userId
    console.log("⚠️ Controller: No user authenticated");
    return res.status(401).json({ 
      success: false, 
      message: "Please authenticate with a valid token or provide userId in the URL path" 
    });
  } catch (err: any) {
    console.error("❌ Controller Error (getCurrentEmployerProfile):", err.message);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};

export const getEmployerProfileController = async (req: Request, res: Response) => {
  try {
    const profile = await employerProfileService.getEmployerProfile(req.params.userId);
    if (!profile) return res.status(404).json({ success: false, message: "Profile not found" });
    return res.status(200).json({ success: true, data: profile });
  } catch (err: any) {
    console.error("getEmployerProfileController error:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};

export const updateCurrentEmployerProfileController = async (req: Request, res: Response) => {
  try {
    console.log("🟦 Controller: Updating current employer profile");
    console.log("🟦 User from request:", req.user);
    console.log("🟦 Update data:", req.body);
    
    // If user is authenticated, update their profile
    if (req.user?.id) {
      console.log("🟦 User authenticated, userId:", req.user.id);
      await employerProfileService.updateEmployerProfile(
        req.user.id,
        req.body
      );
      
      const profile = await employerProfileService.getEmployerProfile(req.user.id);
      
      if (!profile) {
        console.log("⚠️ Controller: Profile not found after update");
        return res.status(404).json({
          success: false,
          message: "Profile not found"
        });
      }
      
      console.log("✅ Controller: Profile updated successfully");
      return res.status(200).json({ 
        success: true, 
        message: "Profile successfully updated",
        data: profile 
      });
    }
    
    // If not authenticated, return error
    console.log("⚠️ Controller: No user authenticated");
    return res.status(401).json({ 
      success: false, 
      message: "Please authenticate with a valid token to update your profile" 
    });
  } catch (err: any) {
    console.error("❌ Controller Error (updateCurrentEmployerProfile):", err.message);
    
    // Handle validation errors
    if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: err.errors
      });
    }
    
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};

export const updateEmployerProfileController = async (req: Request, res: Response) => {
  try {
    const profile = await employerProfileService.updateEmployerProfile(req.params.userId, req.body);
    if (!profile) return res.status(404).json({ success: false, message: "Profile not found" });
    return res.status(200).json({ 
      success: true, 
      message: "Profile successfully updated",
      data: profile 
    });
  } catch (err: any) {
    console.error("updateEmployerProfileController error:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};
