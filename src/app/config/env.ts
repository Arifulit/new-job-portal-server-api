import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });

const dbUrl = process.env.DB_URL || process.env.DB_URI || process.env.MONGODB_URI;
const jwtSecret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET;
const clientUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:3000";

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT ? Number(process.env.PORT) : 5000,

  // Database
  DB_URL: dbUrl || "mongodb://localhost:27017/career-code",
  DB_URI: dbUrl || "mongodb://localhost:27017/career-code",

  // Redis
  REDIS_HOST: process.env.REDIS_HOST || "127.0.0.1",
  REDIS_PORT: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,

  // JWT
  JWT_SECRET: jwtSecret || "secretkey",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,

  // Client
  FRONTEND_URL: clientUrl,
  CLIENT_URL: clientUrl,

  // Mailer (SMTP)
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM || 'noreply@careercode.com',

  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
};
