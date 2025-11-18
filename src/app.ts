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

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? true,
    credentials: true,
  })
);

app.use("/api/v1", router);

app.get("/", (req: Request, res: Response) => {
  res.status(200).json({ message: "Welcome to the Job Portal API" });
});

app.use(errorHandler);

app.use(notFound);

export default app;