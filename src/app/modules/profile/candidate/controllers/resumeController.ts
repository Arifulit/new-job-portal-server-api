import { Request, Response } from "express";
import * as resumeService from "../services/resumeService";

export const uploadResumeController = async (req: Request, res: Response) => {
  try {
    console.log("🟦 Controller: Uploading resume");
    console.log("🟦 Request body:", JSON.stringify(req.body, null, 2));
    console.log("🟦 Request file:", (req as any).file ? {
      fieldname: (req as any).file.fieldname,
      originalname: (req as any).file.originalname,
      filename: (req as any).file.filename,
      mimetype: (req as any).file.mimetype,
      size: (req as any).file.size
    } : "No file");
    console.log("🟦 Request files:", (req as any).files);
    console.log("🟦 User from request:", req.user);
    
    // Automatically add candidate ID from authenticated user
    if (!req.user?.id) {
      console.log("⚠️ Controller: No user authenticated");
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Please authenticate to upload resume"
      });
    }
    
    let fileUrl: string;
    let fileName: string;
    
    // Check if file was uploaded via form-data (multer)
    const uploadedFile = (req as any).file;
    if (uploadedFile) {
      // File was uploaded via multer
      console.log("🟦 File uploaded via multer:", uploadedFile);
      
      // Construct file URL - adjust based on your server setup
      // Option 1: Local file path (if serving static files)
      fileUrl = `/uploads/${uploadedFile.filename}`;
      // Option 2: Full URL (if you have a base URL)
      // fileUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/uploads/${uploadedFile.filename}`;
      
      fileName = uploadedFile.originalname || uploadedFile.filename;
      
      console.log("🟦 Generated fileUrl:", fileUrl);
      console.log("🟦 Generated fileName:", fileName);
    } else {
      // Check if fileUrl and fileName are in request body (JSON request)
      if (!req.body || typeof req.body !== "object") {
        console.log("⚠️ Controller: No request body or invalid body");
        return res.status(400).json({
          success: false,
          message: "Please provide resume file (form-data) or fileUrl and fileName (JSON)"
        });
      }
      
      // Get from request body (JSON request)
      if (!req.body.fileUrl || (typeof req.body.fileUrl === "string" && req.body.fileUrl.trim() === "")) {
        console.log("⚠️ Controller: fileUrl missing");
        return res.status(400).json({
          success: false,
          message: "fileUrl is required. Either upload a file (form-data) or provide fileUrl in request body"
        });
      }
      
      if (!req.body.fileName || (typeof req.body.fileName === "string" && req.body.fileName.trim() === "")) {
        console.log("⚠️ Controller: fileName missing");
        return res.status(400).json({
          success: false,
          message: "fileName is required. Either upload a file (form-data) or provide fileName in request body"
        });
      }
      
      fileUrl = req.body.fileUrl.trim();
      fileName = req.body.fileName.trim();
    }
    
    // Prepare resume data with candidate ID from authenticated user
    const resumeData = {
      fileUrl,
      fileName,
      candidate: req.user.id // Use authenticated user's ID
    };
    
    console.log("🟦 Resume data with candidate:", resumeData);
    
    const resume = await resumeService.uploadResume(resumeData);
    
    console.log("✅ Controller: Resume uploaded successfully");
    res.status(201).json({ success: true, data: resume });
  } catch (error: any) {
    console.error("❌ Controller Error (upload):", error.message);
    console.error("❌ Error name:", error.name);
    console.error("❌ Error code:", error.code);
    console.error("❌ Error stack:", error.stack);
    
    // Handle multer errors
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size too large"
      });
    }
    
    if (error.message && (error.message.includes("File type not supported") || error.message.includes("Only PDF files are allowed"))) {
      return res.status(400).json({
        success: false,
        message: "Only PDF files are allowed for resume upload"
      });
    }
    
    // Handle validation errors from Mongoose
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.errors
      });
    }
    
    // Handle missing fields error
    if (error.missingFields) {
      return res.status(400).json({
        success: false,
        message: error.message || "Missing required fields",
        missingFields: error.missingFields
      });
    }
    
    // Return detailed error for debugging
    return res.status(500).json({ 
      success: false, 
      message: error.message || "Error uploading resume",
      error: process.env.NODE_ENV === "development" ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    });
  }
};

export const getCurrentResumeController = async (req: Request, res: Response) => {
  try {
    console.log("🟦 Controller: Getting current user's resume");
    console.log("🟦 Request method:", req.method);
    console.log("🟦 User from request:", req.user);
    console.log("🟦 Authorization header:", req.headers.authorization);
    console.log("🟦 Request URL:", req.originalUrl);
    
    // If user is authenticated, get their resume
    if (req.user?.id) {
      console.log("🟦 User authenticated, userId:", req.user.id);
      const resume = await resumeService.getResumeByCandidate(req.user.id);
      if (!resume) {
        console.log("⚠️ Controller: Resume not found for userId:", req.user.id);
        return res.status(404).json({ 
          success: false, 
          message: "Resume not found. Please upload your resume first." 
        });
      }
      console.log("✅ Controller: Resume retrieved successfully");
      return res.status(200).json({ success: true, data: resume });
    }
    
    // If not authenticated, return helpful error message
    console.log("⚠️ Controller: No user authenticated");
    return res.status(401).json({ 
      success: false, 
      message: "Authentication required. Please provide a valid token in Authorization header (Bearer <token>) or use GET /api/v1/candidate/resume/:candidateId to view a specific candidate's resume" 
    });
  } catch (error: any) {
    console.error("❌ Controller Error (getCurrentResume):", error.message);
    return res.status(500).json({ 
      success: false, 
      message: error.message || "Error getting resume" 
    });
  }
};

export const getResumeController = async (req: Request, res: Response) => {
  try {
    console.log("🟦 Controller: Getting resume");
    console.log("🟦 CandidateId param:", req.params.candidateId);
    
    const resume = await resumeService.getResumeByCandidate(req.params.candidateId);
    
    if (!resume) {
      console.log("⚠️ Controller: Resume not found");
      return res.status(404).json({ 
        success: false, 
        message: "Resume not found" 
      });
    }
    
    console.log("✅ Controller: Resume retrieved successfully");
    res.status(200).json({ success: true, data: resume });
  } catch (error: any) {
    console.error("❌ Controller Error (get resume):", error.message);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Error getting resume" 
    });
  }
};