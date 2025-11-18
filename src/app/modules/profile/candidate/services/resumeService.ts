import { Resume } from "../models/Resume";
import { Types } from "mongoose";

export const uploadResume = async (data: any) => {
  try {
    console.log("📝 Service: Uploading resume with data:", data);
    
    // Validate required fields before processing
    const missingFields: string[] = [];
    if (!data.fileUrl || (typeof data.fileUrl === "string" && data.fileUrl.trim() === "")) {
      missingFields.push("fileUrl");
    }
    if (!data.fileName || (typeof data.fileName === "string" && data.fileName.trim() === "")) {
      missingFields.push("fileName");
    }
    if (!data.candidate) {
      missingFields.push("candidate");
    }
    
    if (missingFields.length > 0) {
      const error: any = new Error(`Missing required fields: ${missingFields.join(", ")}`);
      error.missingFields = missingFields;
      throw error;
    }
    
    // Convert candidate to ObjectId if it's a string
    if (data.candidate && typeof data.candidate === "string" && Types.ObjectId.isValid(data.candidate)) {
      data.candidate = new Types.ObjectId(data.candidate);
    }
    
    console.log("📝 Service: Processed resume data:", data);
    const resume = await Resume.create(data);
    console.log("✅ Service: Resume uploaded successfully:", resume._id);
    return resume;
  } catch (error: any) {
    console.error("❌ Service Error (upload resume):", error.message);
    throw error;
  }
};

export const getResumeByCandidate = async (candidateId: string) => {
  try {
    console.log("📝 Service: Getting resume for candidateId:", candidateId);
    const resume = await Resume.findOne({ candidate: candidateId });
    
    if (!resume) {
      console.log("⚠️ Service: Resume not found for candidateId:", candidateId);
    } else {
      console.log("✅ Service: Resume found:", resume._id);
    }
    
    return resume;
  } catch (error: any) {
    console.error("❌ Service Error (get resume):", error.message);
    throw error;
  }
};