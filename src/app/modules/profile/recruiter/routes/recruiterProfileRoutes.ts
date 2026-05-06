import { Router } from "express";
import { NextFunction, Request, Response } from "express";
import multer from "multer";
import {
  createRecruiterProfileController,
  getRecruiterProfileController,
  updateRecruiterProfileController
} from "../controllers/recruiterProfileController";
import { authMiddleware } from "../../../../middleware/auth";
import { avatarUpload } from "../../../../middleware/upload";

const router = Router();

const avatarUploadMiddleware = (req: Request, res: Response, next: NextFunction) => {
  avatarUpload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "profilePicture", maxCount: 1 },
    { name: "companyLogo", maxCount: 1 },
    { name: "logo", maxCount: 1 },
    { name: "image", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ])(req, res, (error: any) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: error.code,
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message || "Profile picture upload failed",
    });
  });
};

router.post("/", authMiddleware(["Recruiter"]), avatarUploadMiddleware, createRecruiterProfileController);
router.get("/profile", authMiddleware(["Recruiter", "Admin"]), getRecruiterProfileController);
router.put("/profile", authMiddleware(["Recruiter"]), avatarUploadMiddleware, updateRecruiterProfileController);

export default router;
