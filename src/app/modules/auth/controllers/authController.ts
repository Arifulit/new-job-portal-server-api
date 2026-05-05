
import { NextFunction, Request, Response } from "express";
import * as authService from "../services/authService";
import { User } from "../models/User";
import passport from "../../../config/passport";
import { env } from "../../../config/env";
import { CandidateProfile, ICandidateProfile } from "../../profile/candidate/models/CandidateProfile";
import { RecruiterProfile, IRecruiterProfile } from "../../profile/recruiter/models/RecruiterProfile";
import { AdminProfile, IAdminProfile } from "../../profile/admin/models/AdminProfile";
import Company from "../../company/models/Company";

const ACCESS_TTL = "24h";
const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_COOKIE_MAXAGE = 30 * 24 * 60 * 60 * 1000;
const ACCESS_COOKIE_MAXAGE = 24 * 60 * 60 * 1000;

const hasGoogleOAuthConfig = Boolean(
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALLBACK_URL,
);

const isProduction = process.env.NODE_ENV === "production";

const COOKIE_BASE = {
  path: "/",
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
};

const mask = (value: string, visiblePrefix = 6, visibleSuffix = 4) => {
  if (!value) return "";
  if (value.length <= visiblePrefix + visibleSuffix) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, visiblePrefix)}***${value.slice(-visibleSuffix)}`;
};

const toAuthUserPayload = (user: Record<string, unknown>) => {
  const base = {
    _id: user._id,
    id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar ?? "",
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    isSuspended: user.isSuspended,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  if (user.role === "recruiter") {
    return {
      ...base,
      isRecruiterApproved: user.isRecruiterApproved ?? false,
      recruiterApprovedAt: user.recruiterApprovedAt ?? null,
      recruiterApprovedBy: user.recruiterApprovedBy ?? null,
    };
  }
  return base;
};

export const register = async (req: Request, res: Response) => {
  try {
    const {
      name, email, password, role, phone, designation,
      companyName, yearOfEstablishment, companyAddress, industryType,
      websiteUrl, skills, biodata, location,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email, and password are required" });
    }

    const user = await authService.registerUser(name, email, password, (role || "candidate") as "candidate" | "recruiter" | "admin");
    if (role === "recruiter") (user as Record<string, unknown>).isRecruiterApproved = false;

    const userId = user._id.toString();

    switch (role) {
      case "candidate":
        if (!phone || !biodata || !location) {
          return res.status(400).json({ success: false, message: "Phone, biodata and location are required for candidate registration" });
        }
        await CandidateProfile.create({ user: userId, name, phone, bio: String(biodata).trim(), address: String(location).trim(), skills: skills || [] });
        break;

      case "recruiter": {
        if (!phone || !biodata || !location || !designation || !companyName || !yearOfEstablishment || !companyAddress || !industryType || !websiteUrl) {
          return res.status(400).json({ success: false, message: "Missing recruiter required fields" });
        }
        const normalizedCompanyName = String(companyName).trim();
        const companyDoc = await Company.findOneAndUpdate(
          { name: { $regex: `^${normalizedCompanyName}$`, $options: "i" } },
          { $set: { industry: String(industryType).trim(), website: String(websiteUrl).trim(), address: String(companyAddress).trim(), yearOfEstablishment: Number(yearOfEstablishment) }, $setOnInsert: { name: normalizedCompanyName, isVerified: false } },
          { new: true, upsert: true },
        );
        await RecruiterProfile.create({ user: userId, phone, designation, bio: String(biodata).trim(), location: String(location).trim(), company: companyDoc._id });
        break;
      }

      case "admin":
        if (!phone || !biodata || !location) {
          return res.status(400).json({ success: false, message: "Phone, biodata and location are required for admin registration" });
        }
        await AdminProfile.create({ user: userId, name, email, phone, biodata: String(biodata).trim(), location: String(location).trim(), role: "Admin" });
        break;

      default:
        return res.status(400).json({ success: false, message: "Invalid role specified" });
    }

    const accessToken = authService.signToken({ id: userId, role: user.role, email: user.email }, ACCESS_TTL);
    const refreshToken = authService.generateRefreshToken(userId);

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, { ...COOKIE_BASE, maxAge: REFRESH_COOKIE_MAXAGE });
    res.cookie("accessToken", accessToken, { ...COOKIE_BASE, maxAge: ACCESS_COOKIE_MAXAGE });

    res.status(201).json({
      success: true,
      message: role === "recruiter" ? "Recruiter registered successfully. Waiting for admin approval." : "Registration successful",
      data: { user: toAuthUserPayload(user), accessToken, refreshToken },
    });
  } catch (error: Error | unknown) {
    res.status(400).json({ success: false, message: (error as Error).message || "Registration failed" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: "Email and password are required" });

    const { user } = await authService.loginUser(email, password);
    const userId = user._id.toString();

    const accessToken = authService.signToken({ id: userId, role: user.role, email: user.email }, ACCESS_TTL);
    const refreshToken = authService.generateRefreshToken(userId);

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, { ...COOKIE_BASE, maxAge: REFRESH_COOKIE_MAXAGE });
    res.cookie("accessToken", accessToken, { ...COOKIE_BASE, maxAge: ACCESS_COOKIE_MAXAGE });

    res.status(200).json({ success: true, data: { user: toAuthUserPayload(user), accessToken, refreshToken } });
  } catch (error: Error | unknown) {
    res.status(400).json({ success: false, message: (error as Error).message || "Login failed. Please check your credentials." });
  }
};

export const googleAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!hasGoogleOAuthConfig) {
    return res.status(503).json({ success: false, message: "Google login is not configured." });
  }
  const requestedRedirect =
    typeof req.query.redirect === "string" && req.query.redirect.startsWith("/")
      ? req.query.redirect
      : "/";
  const state = Buffer.from(requestedRedirect, "utf8").toString("base64url");
  passport.authenticate("google", { scope: ["email", "profile"], session: false, state })(req, res, next);
};

export const googleDebug = (_req: Request, res: Response) => {
  const configuredCallbackUrl = env.GOOGLE_CALLBACK_URL ?? "";
  return res.status(200).json({
    success: true,
    googleOAuth: {
      configured: hasGoogleOAuthConfig,
      callbackUrl: configuredCallbackUrl,
      clientIdMasked: env.GOOGLE_CLIENT_ID ? mask(env.GOOGLE_CLIENT_ID, 10, 10) : "",
    },
  });
};

// ─── FIX 1 & 3: googleCallback ────────────────────────────────────
// Bug 1 was: redirecting to /dashboard — GoogleSuccess.tsx never loaded
// Bug 3 was: not setting accessToken cookie — token was only in URL, lost after replaceState
export const googleCallback = (req: Request, res: Response, next: NextFunction) => {
  if (!hasGoogleOAuthConfig) {
    return res.status(503).json({ success: false, message: "Google login is not configured." });
  }

  passport.authenticate("google", { session: false }, async (error: Error | null, user: Record<string, unknown> | null) => {
    if (error || !user) {
      return res.status(401).json({ success: false, message: error?.message || "Google authentication failed" });
    }

    const userId = (user._id as Record<string, { toString: () => string }>)?.toString() || String(user._id);

    if (user.role === "candidate") {
      const existingProfile = await CandidateProfile.findOne({ user: userId });
      if (!existingProfile) {
        await CandidateProfile.create({ user: userId, name: user.name || "", phone: "", bio: "", address: "", skills: [] });
      }
    }

    const accessToken = authService.signToken({ id: userId, role: user.role, email: user.email }, ACCESS_TTL);
    const refreshToken = authService.generateRefreshToken(userId);

    // FIX 3: accessToken cookie set করো — httpOnly:false কারণ frontend js-cookie দিয়ে read করে
    // refreshToken httpOnly থাকে (server-side only)
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, { ...COOKIE_BASE, maxAge: REFRESH_COOKIE_MAXAGE });
    res.cookie("accessToken", accessToken, {
      path: "/",
      httpOnly: false,          // frontend Cookies.get() দিয়ে পড়বে
      secure: isProduction,
      sameSite: "lax",
      maxAge: ACCESS_COOKIE_MAXAGE,
    });

    if (req.query.mode === "json") {
      return res.status(200).json({ success: true, data: { user: toAuthUserPayload(user), accessToken, refreshToken } });
    }

    // FIX 1: /auth/google/success এ redirect করো — frontend এর actual route
    const frontendUrl = new URL(env.FRONTEND_URL);
    frontendUrl.pathname = "/auth/google/success";
    frontendUrl.searchParams.set("accessToken", accessToken);
    frontendUrl.searchParams.set("refreshToken", refreshToken);

    return res.redirect(frontendUrl.toString());
  })(req, res, next);
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });
    await authService.requestPasswordReset(email);
    return res.status(200).json({ success: true, message: "If that email is registered, a password reset link has been sent." });
  } catch (error: Error | unknown) {
    return res.status(400).json({ success: false, message: (error as Error).message || "Failed to process request" });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ success: false, message: "Token and new password are required" });
    await authService.resetPassword(token, password);
    return res.status(200).json({ success: true, message: "Password has been reset successfully" });
  } catch (error: Error | unknown) {
    return res.status(400).json({ success: false, message: (error as Error).message || "Failed to request password reset" });
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body.refreshToken;
    if (!refreshToken) return res.status(401).json({ success: false, message: "Refresh token is required" });

    const decoded: Record<string, unknown> = authService.verifyRefreshToken(refreshToken);
    const userId = decoded.id as string;
    if (!userId) return res.status(401).json({ success: false, message: "Invalid refresh token" });

    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ success: false, message: "User not found" });

    const newAccessToken = authService.signToken({ id: userId, role: user.role, email: user.email }, ACCESS_TTL);
    const newRefreshToken = authService.generateRefreshToken(userId);

    res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, { ...COOKIE_BASE, maxAge: REFRESH_COOKIE_MAXAGE });
    res.cookie("accessToken", newAccessToken, { path: "/", httpOnly: false, secure: isProduction, sameSite: "lax", maxAge: ACCESS_COOKIE_MAXAGE });

    res.status(200).json({ success: true, data: { accessToken: newAccessToken, refreshToken: newRefreshToken } });
  } catch {
    res.status(401).json({ success: false, message: "Invalid refresh token" });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    res.clearCookie(REFRESH_COOKIE_NAME, COOKIE_BASE);
    res.clearCookie("accessToken", { ...COOKIE_BASE, httpOnly: false, path: "/" });
    res.status(200).json({ success: true, message: "Successfully logged out" });
  } catch {
    res.status(500).json({ success: false, message: "Logout failed" });
  }
};

// ─── FIX 2: /auth/me response shape ──────────────────────────────
// Bug was: returning { data: userResponse } — frontend এর normalizeUser
// payload.data?.user এ access করতো, কিন্তু me() user object directly return করছিল।
// Fix: { data: { user: userResponse } } shape এ return করো।
export const me = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) return res.status(401).json({ success: false, message: "Authentication token is required" });

    const decoded: Record<string, unknown> = authService.verifyToken(token);
    const userId = decoded.id;
    if (!userId) return res.status(401).json({ success: false, message: "Invalid token" });

    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    let profile: ICandidateProfile | IRecruiterProfile | IAdminProfile | null = null;
    switch (user.role) {
      case "candidate":
        profile = await CandidateProfile.findOne({ user: userId }).lean();
        if (!profile) {
          const createdProfile = await CandidateProfile.create({
            user: userId,
            name: user.name || "",
            phone: "",
            bio: "",
            address: "",
            skills: [],
          });
          profile = createdProfile.toObject() as ICandidateProfile;
        }
        break;
      case "recruiter":
        profile = await RecruiterProfile.findOne({ user: userId }).lean();
        break;
      case "admin":
        profile = await AdminProfile.findOne({ user: userId }).lean();
        break;
    }

    const userResponse = {
      _id: user._id,
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: (user as Record<string, unknown>).avatar ?? "",
      role: user.role,
      ...(user.role === "recruiter"
        ? {
            isRecruiterApproved: (user as Record<string, unknown>).isRecruiterApproved ?? false,
            recruiterApprovedAt: (user as Record<string, unknown>).recruiterApprovedAt ?? null,
            recruiterApprovedBy: (user as Record<string, unknown>).recruiterApprovedBy ?? null,
          }
        : {}),
      profile,
    };

    // FIX 2: { data: { user: ... } } shape — frontend এর extractAuthData এবং
    // setUserFromToken দুটোই payload.data?.user থেকে read করে
    return res.status(200).json({ success: true, data: { user: userResponse } });
  } catch (error: Error | unknown) {
    return res.status(401).json({ success: false, message: (error as Error).message || "Invalid or expired token" });
  }
};