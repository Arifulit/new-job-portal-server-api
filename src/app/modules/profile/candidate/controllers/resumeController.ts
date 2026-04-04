import { Request, Response } from "express";
import fs from "fs";
import cloudinary from "../../../../config/cloudinary";
import * as resumeService from "../services/resumeService";

function buildCloudinaryUrlFromPublicId(publicId: string, format?: string): string {
  return cloudinary.url(publicId, {
    secure: true,
    resource_type: "raw",
    type: "upload",
    format,
  });
}

function buildCloudinarySignedDownloadUrl(publicId: string, format = "pdf"): string {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30; // 30 days

  return cloudinary.utils.private_download_url(publicId, format, {
    resource_type: "raw",
    type: "upload",
    expires_at: expiresAt,
    attachment: false,
  });
}

function parseCloudinaryPublicIdAndFormat(fileUrl: string): { publicId: string; format?: string } | null {
  try {
    const marker = "/raw/upload/";
    const idx = fileUrl.indexOf(marker);
    if (idx === -1) return null;

    const afterMarker = fileUrl.slice(idx + marker.length);
    const withoutVersion = afterMarker.replace(/^v\d+\//, "");
    const cleanPath = withoutVersion.split("?")[0];

    const extMatch = cleanPath.match(/\.([a-zA-Z0-9]+)$/);
    if (extMatch) {
      const format = extMatch[1].toLowerCase();
      const publicId = cleanPath.replace(/\.[a-zA-Z0-9]+$/, "");
      return { publicId, format };
    }

    return { publicId: cleanPath };
  } catch {
    return null;
  }
}

function fixMalformedCloudinaryPdfUrl(fileUrl: string): string {
  // Repair accidentally generated links like ...resume_123.pdf.pdf
  return fileUrl.replace(/\.pdf\.pdf(\?|$)/i, ".pdf$1");
}

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
    const singleUploadedFile = (req as any).file;
    const uploadedFiles = (req as any).files as
      | Record<string, Express.Multer.File[]>
      | Express.Multer.File[]
      | undefined;

    const uploadedFile =
      singleUploadedFile ||
      (Array.isArray(uploadedFiles)
        ? uploadedFiles[0]
        : uploadedFiles?.resume?.[0] || uploadedFiles?.file?.[0]);
    if (uploadedFile) {
      // File was uploaded via multer — now push to Cloudinary
      console.log("🟦 File uploaded via multer, uploading to Cloudinary:", uploadedFile.path);

      const cloudResult = await cloudinary.uploader.upload(uploadedFile.path, {
        folder: "resumes",
        resource_type: "raw",
        type: "upload",
        access_mode: "public",
        public_id: `resume_${req.user!.id}_${Date.now()}`,
        overwrite: true,
      });

      // Remove temp file from disk after successful upload
      fs.unlink(uploadedFile.path, (err) => {
        if (err) console.warn("⚠️ Could not delete temp file:", uploadedFile.path);
      });

      // Use Cloudinary's secure delivery URL directly so it works in browsers.
      fileUrl = cloudResult.secure_url || buildCloudinaryUrlFromPublicId(cloudResult.public_id, cloudResult.format);
      fileName = uploadedFile.originalname || uploadedFile.filename;

      console.log("🟦 Cloudinary URL:", fileUrl);
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
    const resumeObj: any = (resume as any).toObject ? (resume as any).toObject() : resume;

    if (typeof resumeObj.fileUrl === "string" && resumeObj.fileUrl.includes("res.cloudinary.com")) {
      resumeObj.fileUrl = fixMalformedCloudinaryPdfUrl(resumeObj.fileUrl);
      const parsed = parseCloudinaryPublicIdAndFormat(resumeObj.fileUrl);
      if (parsed?.publicId) {
        resumeObj.fileUrl = buildCloudinarySignedDownloadUrl(parsed.publicId, parsed.format || "pdf");
        resumeObj.publicFileUrl = buildCloudinaryUrlFromPublicId(parsed.publicId, parsed.format);
      }
    }
    
    console.log("✅ Controller: Resume uploaded successfully");
    res.status(201).json({ success: true, data: resumeObj });
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

      // Normalize old Cloudinary URLs to signed browser-openable URL.
      const resumeObj: any = (resume as any).toObject ? (resume as any).toObject() : resume;
      if (typeof resumeObj.fileUrl === "string" && resumeObj.fileUrl.includes("res.cloudinary.com")) {
        resumeObj.fileUrl = fixMalformedCloudinaryPdfUrl(resumeObj.fileUrl);
        const parsed = parseCloudinaryPublicIdAndFormat(resumeObj.fileUrl);
        if (parsed?.publicId) {
          resumeObj.fileUrl = buildCloudinarySignedDownloadUrl(parsed.publicId, parsed.format || "pdf");
          resumeObj.publicFileUrl = buildCloudinaryUrlFromPublicId(parsed.publicId, parsed.format);
        }
      }

      console.log("✅ Controller: Resume retrieved successfully");
      return res.status(200).json({ success: true, data: resumeObj });
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

    // Normalize old Cloudinary URLs to signed browser-openable URL.
    const resumeObj: any = (resume as any).toObject ? (resume as any).toObject() : resume;
    if (typeof resumeObj.fileUrl === "string" && resumeObj.fileUrl.includes("res.cloudinary.com")) {
      resumeObj.fileUrl = fixMalformedCloudinaryPdfUrl(resumeObj.fileUrl);
      const parsed = parseCloudinaryPublicIdAndFormat(resumeObj.fileUrl);
      if (parsed?.publicId) {
        resumeObj.fileUrl = buildCloudinarySignedDownloadUrl(parsed.publicId, parsed.format || "pdf");
        resumeObj.publicFileUrl = buildCloudinaryUrlFromPublicId(parsed.publicId, parsed.format);
      }
    }
    
    console.log("✅ Controller: Resume retrieved successfully");
    res.status(200).json({ success: true, data: resumeObj });
  } catch (error: any) {
    console.error("❌ Controller Error (get resume):", error.message);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Error getting resume" 
    });
  }
};