// import "dotenv/config";
// import express, { Request, Response } from "express";
// import cookieParser from "cookie-parser";
// import cors from "cors";
// import session from "express-session";
// import router from "./app/routes";
// import { errorHandler } from "./app/middleware/errorHandler";
// import notFound from "./app/middleware/notFound";

// const app = express();

// app.use(cookieParser());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// app.set("trust proxy", 1);

// app.use(
//   session({
//     secret: process.env.EXPRESS_SESSION_SECRET ?? process.env.JWT_SECRET ?? "change_this_secret",
//     resave: false,
//     saveUninitialized: false,
//     cookie: {
//       secure: process.env.NODE_ENV === "production",
//       httpOnly: true,
//       sameSite: "lax",
//       maxAge: 1000 * 60 * 60 * 24 * 7,
//     },
//   })
// );

// app.use(
//   cors({
//     origin: process.env.FRONTEND_URL ?? true,
//     credentials: true,
//   })
// );

// app.use("/api/v1", router);

// app.get("/", (req: Request, res: Response) => {
//   res.status(200).json({ message: "Welcome to the Job Portal API" });
// });

// app.use(errorHandler);

// app.use(notFound);


// export default app;

import "dotenv/config";
import express, { Request, Response } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import session from "express-session";
import router from "./app/routes";
import { errorHandler } from "./app/middleware/errorHandler";
import notFound from "./app/middleware/notFound";

const app = express();

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("trust proxy", 1);

app.use(
  session({
    secret: process.env.EXPRESS_SESSION_SECRET ?? process.env.JWT_SECRET ?? "change_this_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

// sanitize FRONTEND_URL (remove trailing slash) and fallback
// ...existing code...
// sanitize FRONTEND_URL (remove trailing slash) and allow localhost + render URL
const allowedOrigins = [
  (process.env.FRONTEND_URL ?? "https://job-portal-client-jade-one.vercel.app").replace(/\/+$/, ""),
  "http://localhost:5173"
];

// preflight handler: respond to OPTIONS and include Private-Network header when requested
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

app.use("/api/v1", router);

app.get("/", (req: Request, res: Response) => {
  res.status(200).json({ message: "Welcome to the Job Portal API" });
});

app.use(notFound);
app.use(errorHandler);

export default app;