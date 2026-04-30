
// এই ফাইলটি Express app setup করে: middleware chain, route mount, notFound এবং error handler।
import express, { Request, Response } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import session from "express-session";
import router from "./app/routes";
import passport from "./app/config/passport";
import { env } from "./app/config/env";
import { errorHandler } from "./app/middleware/errorHandler";
import notFound from "./app/middleware/notFound";

const app = express();

app.use(cookieParser());
// Allow larger JSON payloads for AI and batch endpoints
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.set("trust proxy", 1);

// Session config
app.use(
  session({
    secret: process.env.EXPRESS_SESSION_SECRET ?? env.JWT_SECRET ?? "change_this_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);


// Passport middleware
app.use(passport.initialize());
app.use(passport.session()); // 🔥 Added for Google OAuth session support

// Allowed origins
const allowedOrigins = [
  env.FRONTEND_URL.replace(/\/+$/, ""),
  "http://localhost:5173"
];

// Preflight OPTIONS
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    const origin = (req.headers.origin as string) || "";
    if (!origin || allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin || allowedOrigins[0]);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Requested-With,Accept");
      if (req.headers["sec-private-network"]) {
        res.setHeader("Access-Control-Allow-Private-Network", "true");
      }
      return res.sendStatus(204);
    }
    return res.status(403).send("CORS blocked: origin not allowed");
  }
  next();
});

// CORS middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS blocked: origin not allowed"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  })
);

// Routes
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ success: true, message: "Job Portal API is healthy" });
});

app.get("/api/v1/health", (_req: Request, res: Response) => {
  res.status(200).json({ success: true, message: "Job Portal API is healthy" });
});

app.use("/api/v1", router);

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Welcome to the Job Portal API",
    docs: "/api/v1/health",
  });
});

app.use(notFound);
app.use(errorHandler);

export default app;
