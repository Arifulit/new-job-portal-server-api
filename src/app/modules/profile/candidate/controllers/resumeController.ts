import { Request, Response } from "express";
import fs from "fs";
import axios from "axios";
import { analyzeResumeWithGemini } from "../../../../integrations/openai/resumeParser";
import cloudinary from "../../../../config/cloudinary";
import * as resumeService from "../services/resumeService";

function isValidCloudinaryUrl(url: string): boolean {
  return typeof url === "string" && url.includes("res.cloudinary.com");
}

function createPublicRawUrl(publicId: string, version?: number, attachment?: boolean): string {
  return cloudinary.url(publicId, {
    resource_type: "raw",
    type: "upload",
    secure: true,
    sign_url: false,
    version,
    flags: attachment ? "attachment" : undefined,
  });
}

function extractCloudinaryRawAsset(url?: string): { publicId: string; version?: number } | null {
  if (!url || typeof url !== "string") {
    return null;
  }

  const withoutQuery = url.split("?")[0];
  const match = withoutQuery.match(/\/raw\/upload\/(?:s--[^/]+--\/)?(?:fl_attachment\/)?(?:v(\d+)\/)?(.+)$/);
  if (!match) {
    return null;
  }

  const version = match[1] ? Number(match[1]) : undefined;
  const publicId = decodeURIComponent(match[2]);
  if (!publicId) return null;

  return {
    publicId,
    version: version && Number.isFinite(version) ? version : undefined,
  };
}

function buildResumeLinks(url?: string): { sourceUrl: string | undefined; downloadUrl: string | undefined } {
  if (!url || typeof url !== "string") {
    return { sourceUrl: url, downloadUrl: url };
  }

  const asset = extractCloudinaryRawAsset(url);
  if (asset?.publicId) {
    return {
      sourceUrl: createPublicRawUrl(asset.publicId, asset.version, false),
      downloadUrl: createPublicRawUrl(asset.publicId, asset.version, true),
    };
  }

  if (url.includes("fl_attachment")) {
    return {
      sourceUrl: url.replace("/fl_attachment/", "/"),
      downloadUrl: url,
    };
  }

  if (url.includes("/raw/upload/")) {
    const cleanUrl = url.replace(/\/s--[^/]+--/, "");
    return {
      sourceUrl: cleanUrl,
      downloadUrl: cleanUrl.replace("/raw/upload/", "/raw/upload/fl_attachment/"),
    };
  }

  return {
    sourceUrl: url,
    downloadUrl: url,
  };
}

async function streamResumeFromUrl(
  resumeUrl: string,
  res: Response,
  disposition: "inline" | "attachment",
): Promise<void> {
  const cleanUrl = resumeUrl.replace(/\/s--[^/]+--/, "");
  const targetUrl =
    disposition === "attachment"
      ? cleanUrl.replace("/raw/upload/", "/raw/upload/fl_attachment/")
      : cleanUrl;

  try {
    const response = await axios.get(targetUrl, {
      responseType: "stream",
      timeout: 15000,
    });

    res.setHeader("Content-Type", response.headers["content-type"] || "application/pdf");
    res.setHeader("Content-Disposition", `${disposition}; filename="resume.pdf"`);
    res.setHeader("Cache-Control", "no-cache");
    response.data.pipe(res);
    return;
  } catch (error: any) {
    const status = error?.response?.status;
    if (![401, 403, 404].includes(status)) {
      throw error;
    }

    const asset = extractCloudinaryRawAsset(resumeUrl);
    if (!asset?.publicId) {
      throw error;
    }

    const retryUrl = createPublicRawUrl(asset.publicId, asset.version, disposition === "attachment");
    const retryResponse = await axios.get(retryUrl, {
      responseType: "stream",
      timeout: 15000,
    });

    res.setHeader("Content-Type", retryResponse.headers["content-type"] || "application/pdf");
    res.setHeader("Content-Disposition", `${disposition}; filename="resume.pdf"`);
    res.setHeader("Cache-Control", "no-cache");
    retryResponse.data.pipe(res);
  }
}

export const uploadResumeController = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    console.log("🟦 Controller: Uploading resume");
    console.log("🟦 Request user:", req.user?.id);
    
    // Authenticate user
    if (!req.user?.id) {
      console.log("⚠️ Controller: No user authenticated");
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Please authenticate to upload resume"
      });
    }
    
    let fileUrl: string;
    let fileName: string;
    let uploadDuration: number | undefined;
    
    // Check if file was uploaded via form-data (multer)
    const uploadedFile = (req as any).file;
    const uploadedFiles = (req as any).files as
      | Record<string, Express.Multer.File[]>
      | Express.Multer.File[]
      | undefined;

    const file =
      uploadedFile ||
      (Array.isArray(uploadedFiles)
        ? uploadedFiles[0]
        : uploadedFiles?.resume?.[0] || uploadedFiles?.file?.[0]);

    if (file) {
      // File was uploaded via multer — upload to Cloudinary
      console.log("📤 Uploading to Cloudinary:", file.originalname);

      try {
        const beforeUpload = Date.now();
        const cloudResult = await cloudinary.uploader.upload(file.path, {
          folder: "resumes",
          resource_type: "raw",
          type: "upload",
          access_mode: "public",
          public_id: `resume_${req.user!.id}_${Date.now()}`,
          overwrite: true,
        });

        const publicViewUrl = createPublicRawUrl(cloudResult.public_id, cloudResult.version, false);
        fileUrl = publicViewUrl;
        fileName = file.originalname || file.filename;
        uploadDuration = Date.now() - beforeUpload;

        console.log("✅ File uploaded to Cloudinary");
        console.log("🔗 Public View URL:", fileUrl);

        // Remove temp file from disk
        fs.unlink(file.path, (err) => {
          if (err) console.warn("⚠️ Could not delete temp file:", file.path);
        });
      } catch (uploadError: any) {
        console.error("❌ Cloudinary upload failed:", uploadError.message);

        // Fallback: keep local file and expose via /uploads static route
        try {
          const beforeFallback = Date.now();
          const extractedFileName = file.filename || (file.path && file.path.split(/[\\/]/).pop()) || Date.now().toString();
          const host = req.get("host");
          const protocol = req.protocol;
          const localUrl = `${protocol}://${host}/uploads/${extractedFileName}`;

          console.warn("⚠️ Using local uploads fallback:", localUrl);

          fileUrl = localUrl;
          fileName = file.originalname || extractedFileName;
          uploadDuration = Date.now() - beforeFallback;

          // Don't delete the temp file so it can be served from /uploads
        } catch (fallbackErr: any) {
          console.error("❌ Fallback local save failed:", fallbackErr?.message || fallbackErr);
          const totalTimeErr = Date.now() - startTime;
          return res.status(500).json({
            success: false,
            message: "Failed to upload file to cloud storage",
            error: uploadError.message,
            timings: { totalDurationMs: totalTimeErr },
          });
        }
      }
    } else {
      // Check for JSON body with fileUrl and fileName
      if (!req.body?.fileUrl || !req.body?.fileName) {
        console.log("⚠️ Controller: Missing file or fileUrl/fileName");
        return res.status(400).json({
          success: false,
          message: "Please upload a file (form-data) or provide fileUrl and fileName in request body"
        });
      }
      
      fileUrl = req.body.fileUrl.trim();
      fileName = req.body.fileName.trim();
      
      if (!isValidCloudinaryUrl(fileUrl)) {
        console.warn("⚠️ fileUrl is not a valid Cloudinary URL:", fileUrl);
      }
    }
    
    // Save resume data to database
    const resumeData = {
      fileUrl,
      fileName,
      candidate: req.user.id
    };
    
    const beforeSave = Date.now();
    console.log("💾 Saving resume to database");
    const resume = await resumeService.uploadResume(resumeData);
    const resumeObj: any = (resume as any).toObject ? (resume as any).toObject() : resume;
    const resumeLinks = buildResumeLinks(resumeObj.fileUrl);
    resumeObj.fileUrl = resumeLinks.sourceUrl;
    resumeObj.sourceUrl = resumeLinks.sourceUrl;
    resumeObj.downloadUrl = resumeLinks.downloadUrl;
    
    const afterSave = Date.now();
    const totalDuration = Date.now() - startTime;
    console.log("✅ Resume uploaded successfully, ID:", resumeObj._id);
    console.log("🔗 FileUrl:", resumeObj.fileUrl);
    console.log("📥 DownloadUrl:", resumeObj.downloadUrl);
    console.log(`⏱ timings: uploadDuration=${uploadDuration ?? -1}ms saveDuration=${afterSave - beforeSave}ms total=${totalDuration}ms`);

    // Attempt to analyze resume via AI (non-blocking for upload)
    (async () => {
      try {
        console.log("🔎 Starting resume analysis for:", resumeObj.fileUrl);
        const fetchRes = await axios.get(resumeObj.fileUrl, { responseType: "arraybuffer", timeout: 20000 });
        const buffer = Buffer.from(fetchRes.data);
        const analysis = await analyzeResumeWithGemini(undefined, buffer, "application/pdf");

        // Persist analysis results to resume document
        try {
          const updated = await resumeService.setResumeAnalysis(String(resumeObj._id), {
            score: analysis.score,
            scoreBreakdown: analysis.scoreBreakdown,
            extractedSkills: analysis.extractedSkills,
            missingSkills: analysis.missingSkills,
            suggestions: analysis.suggestions,
            strengths: analysis.strengths,
          });
          console.log("✅ Resume analysis saved for:", resumeObj._id);
        } catch (persistErr: any) {
          console.warn("⚠️ Failed to persist resume analysis:", persistErr.message || persistErr);
        }
      } catch (aiErr: any) {
        console.warn("⚠️ Resume analysis failed:", aiErr?.message || aiErr);
      }
    })();

    res.status(201).json({ 
      success: true, 
      data: resumeObj,
      message: "Resume uploaded successfully",
      timings: {
        uploadDurationMs: uploadDuration ?? null,
        saveDurationMs: afterSave - beforeSave,
        totalDurationMs: totalDuration,
      },
    });
  } catch (error: any) {
    console.error("❌ Controller Error:", error.message);
    
    // Handle validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.errors
      });
    }
    
    if (error.missingFields) {
      return res.status(400).json({
        success: false,
        message: error.message || "Missing required fields",
        missingFields: error.missingFields
      });
    }
    
    const errTotal = Date.now() - (typeof startTime !== 'undefined' ? startTime : Date.now());
    return res.status(500).json({ 
      success: false, 
      message: error.message || "Error uploading resume",
      timings: { totalDurationMs: errTotal }
    });
  }
};

export const getCurrentResumeController = async (req: Request, res: Response) => {
  try {
    console.log("🟦 Getting current user's resume");
    
    // If user is authenticated, get their resume
    if (req.user?.id) {
      console.log("📥 User authenticated, fetching resume for:", req.user.id);
      const resume = await resumeService.getResumeByCandidate(req.user.id);
      
      if (!resume) {
        console.log("⚠️ Resume not found for user:", req.user.id);
        return res.status(404).json({ 
          success: false, 
          message: "Resume not found. Please upload your resume first." 
        });
      }

      const resumeObj: any = (resume as any).toObject ? (resume as any).toObject() : resume;

      const resumeLinks = buildResumeLinks(resumeObj.fileUrl);
      resumeObj.fileUrl = resumeLinks.sourceUrl;
      resumeObj.sourceUrl = resumeLinks.sourceUrl;
      resumeObj.downloadUrl = resumeLinks.downloadUrl;

      console.log("✅ Resume retrieved successfully");
      return res.status(200).json({ success: true, data: resumeObj });
    }
    
    // If not authenticated
    console.log("⚠️ No user authenticated");
    return res.status(401).json({ 
      success: false, 
      message: "Authentication required. Please provide a valid token in Authorization header" 
    });
  } catch (error: any) {
    console.error("❌ Error getting resume:", error.message);
    return res.status(500).json({ 
      success: false, 
      message: error.message || "Error getting resume" 
    });
  }
};

export const getResumeController = async (req: Request, res: Response) => {
  try {
    console.log("🟦 Getting resume for candidate:", req.params.candidateId);
    
    const resume = await resumeService.getResumeByCandidate(req.params.candidateId);
    
    if (!resume) {
      console.log("⚠️ Resume not found for candidate:", req.params.candidateId);
      return res.status(404).json({ 
        success: false, 
        message: "Resume not found" 
      });
    }

    const resumeObj: any = (resume as any).toObject ? (resume as any).toObject() : resume;

    const resumeLinks = buildResumeLinks(resumeObj.fileUrl);
    resumeObj.fileUrl = resumeLinks.sourceUrl;
    resumeObj.sourceUrl = resumeLinks.sourceUrl;
    resumeObj.downloadUrl = resumeLinks.downloadUrl;
    
    console.log("✅ Resume retrieved successfully");
    res.status(200).json({ success: true, data: resumeObj });
  } catch (error: any) {
    console.error("❌ Error getting resume:", error.message);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Error getting resume" 
    });
  }
};

export const previewCurrentResumeController = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please provide a valid token.",
      });
    }

    const resume = await resumeService.getResumeByCandidate(req.user.id);
    if (!resume?.fileUrl) {
      return res.status(404).json({ success: false, message: "Resume not found" });
    }

    await streamResumeFromUrl(resume.fileUrl, res, "inline");
  } catch (error: any) {
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: error?.message || "Error previewing resume",
      });
    }
    res.end();
  }
};

export const downloadCurrentResumeController = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please provide a valid token.",
      });
    }

    const resume = await resumeService.getResumeByCandidate(req.user.id);
    if (!resume?.fileUrl) {
      return res.status(404).json({ success: false, message: "Resume not found" });
    }

    await streamResumeFromUrl(resume.fileUrl, res, "attachment");
  } catch (error: any) {
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: error?.message || "Error downloading resume",
      });
    }
    res.end();
  }
};