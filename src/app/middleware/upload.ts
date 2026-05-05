// এই middleware upload path তৈরি, file filter, এবং multer upload process handle করে।
import multer from "multer";
import path from "path";
import fs from "fs";
import { Request } from "express";

const uploadsDir = process.env.VERCEL ? "/tmp/uploads" : path.join(process.cwd(), "uploads");

const ensureUploadsDir = () => {
  if (fs.existsSync(uploadsDir)) {
    return;
  }

  fs.mkdirSync(uploadsDir, { recursive: true });
};

// Disk storage setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    try {
      ensureUploadsDir();
      cb(null, uploadsDir);
    } catch (error) {
      cb(error as Error, uploadsDir);
    }
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: (error: Error | null, value?: boolean) => void) => {
  // For resume uploads, accept PDF, DOC and DOCX files
  const allowedMimes = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]);

  if (allowedMimes.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF, DOC or DOCX files are allowed for resume upload"), false);
  }
};

export const upload = multer({ storage, fileFilter });
export const imageUpload = upload;

const resumeFileFilter = (req: Request, file: Express.Multer.File, cb: (error: Error | null, value?: boolean) => void) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const allowedExts = new Set([".pdf", ".doc", ".docx"]);
  const allowedMimes = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]);

  const isAllowedMime = allowedMimes.has(file.mimetype);
  const isAllowedExt = allowedExts.has(ext);

  if (isAllowedMime || isAllowedExt) {
    cb(null, true);
    return;
  }

  cb(new Error("Only PDF, DOC or DOCX files are allowed for resume upload"), false);
};

export const resumeUpload = multer({
  storage,
  fileFilter: resumeFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1,
  },
});

const allowedAvatarMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const allowedAvatarExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const avatarFileFilter = (req: Request, file: Express.Multer.File, cb: (error: Error | null, value?: boolean) => void) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const isAllowedMime = allowedAvatarMimeTypes.has(file.mimetype);
  const isAllowedExt = allowedAvatarExtensions.has(ext);

  if (isAllowedMime || isAllowedExt) {
    cb(null, true);
    return;
  }

  cb(new Error("Only image files (jpg, jpeg, png, webp, gif) are allowed for profile picture upload"), false);
};

export const avatarUpload = multer({
  storage,
  fileFilter: avatarFileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB
    files: 1,
  },
});

const allowedProfileResumeMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const allowedProfileResumeExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf", ".doc", ".docx"]);

const profileMediaFileFilter = (req: Request, file: Express.Multer.File, cb: (error: Error | null, value?: boolean) => void) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const isAllowedMime = allowedProfileResumeMimeTypes.has(file.mimetype);
  const isAllowedExt = allowedProfileResumeExtensions.has(ext);

  if (isAllowedMime || isAllowedExt) {
    cb(null, true);
    return;
  }

  cb(new Error("Only image files and PDF resumes are allowed for candidate profile upload"), false);
};

export const candidateProfileUpload = multer({
  storage,
  fileFilter: profileMediaFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 2,
  },
});
