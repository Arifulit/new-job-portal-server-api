import multer from "multer";
import path from "path";
import fs from "fs";

// Ensure uploads directory exists
const uploadsDir = "uploads";
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("✅ Created uploads directory");
}

// Disk storage setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Ensure directory exists before saving
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
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
