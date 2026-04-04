import multer from "multer";
import path from "path";
import fs from "fs";

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

const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  // For resume uploads, only accept PDF files
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed for resume upload"), false);
  }
};

export const upload = multer({ storage, fileFilter });

const resumeFileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  const isPdfMime = file.mimetype === "application/pdf";
  const isPdfByExt = path.extname(file.originalname || "").toLowerCase() === ".pdf";

  if (isPdfMime || isPdfByExt) {
    cb(null, true);
    return;
  }

  cb(new Error("Only PDF files are allowed for resume upload"), false);
};

export const resumeUpload = multer({
  storage,
  fileFilter: resumeFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1,
  },
});
