import { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import * as authService from "../services/authService";
import { User } from "../models/User";
import passport from "../../../config/passport";
import { env } from "../../../config/env";
import { CandidateProfile } from "../../profile/candidate/models/CandidateProfile";
import { RecruiterProfile } from "../../profile/recruiter/models/RecruiterProfile";
import { AdminProfile } from "../../profile/admin/models/AdminProfile";
import { RecruitmentAgency } from "../../agency/models/recruitmentAgency.model";
import Company from "../../company/models/Company";
import axios from "axios";

const ACCESS_TTL = "24h";
const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_COOKIE_MAXAGE = 30 * 24 * 60 * 60 * 1000; // 30 days
const hasGoogleOAuthConfig = Boolean(
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALLBACK_URL,
);

const mask = (value: string, visiblePrefix = 6, visibleSuffix = 4) => {
  if (!value) return "";
  if (value.length <= visiblePrefix + visibleSuffix) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, visiblePrefix)}***${value.slice(-visibleSuffix)}`;
};

const decodeOAuthRedirectState = (state: unknown): string => {
  if (typeof state !== "string" || !state) return "/";
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8").trim();
    if (decoded.startsWith("/")) return decoded;
  } catch (_e) {
    // ignore
  }
  return "/";
};

const toAuthUserPayload = (user: any) => {
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
      name,
      email,
      password,
      role,
      phone,
      designation,
      agency,
      companyName,
      yearOfEstablishment,
      companyAddress,
      industryType,
      websiteUrl,
      skills,
      biodata,
      location,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email, and password are required" });
    }

    const user = await authService.registerUser(name, email, password, role as any);

    if (role === "recruiter") {
      (user as any).isRecruiterApproved = false;
    }

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

        let agencyId = agency;
        if (!agencyId || !Types.ObjectId.isValid(agencyId)) {
          let agencyDoc = await RecruitmentAgency.findOne({ name: { $regex: `^${normalizedCompanyName}$`, $options: "i" } });
          if (!agencyDoc) {
            agencyDoc = await RecruitmentAgency.create({ name: normalizedCompanyName, website: String(websiteUrl).trim(), industry: String(industryType).trim() });
          }
          agencyId = agencyDoc._id;
        }

        await RecruiterProfile.create({ user: userId, phone, designation, bio: String(biodata).trim(), location: String(location).trim(), agency: agencyId, company: companyDoc._id });
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

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: REFRESH_COOKIE_MAXAGE });

    res.status(201).json({ success: true, message: role === "recruiter" ? "Recruiter registered successfully. Waiting for admin approval." : "Registration successful", data: { user: toAuthUserPayload(user), accessToken, refreshToken } });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || "Registration failed" });
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

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: REFRESH_COOKIE_MAXAGE });

    res.status(200).json({ success: true, data: { user: toAuthUserPayload(user), accessToken, refreshToken } });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || "Login failed. Please check your credentials." });
  }
};

export const googleAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!hasGoogleOAuthConfig) return res.status(503).json({ success: false, message: "Google login is not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL." });

  const requestedRedirect = typeof req.query.redirect === "string" && req.query.redirect.startsWith("/") ? req.query.redirect : "/";
  const state = Buffer.from(requestedRedirect, "utf8").toString("base64url");

  passport.authenticate("google", { scope: ["email", "profile"], session: false, state })(req, res, next);
};

export const googleDebug = (_req: Request, res: Response) => {
  const configuredCallbackUrl = env.GOOGLE_CALLBACK_URL ?? "";
  return res.status(200).json({ success: true, googleOAuth: { configured: hasGoogleOAuthConfig, callbackUrl: configuredCallbackUrl, clientIdMasked: env.GOOGLE_CLIENT_ID ? mask(env.GOOGLE_CLIENT_ID, 10, 10) : "", expectedAuthorizedRedirectUris: configuredCallbackUrl ? [configuredCallbackUrl] : [], notes: ["Google Console -> Credentials -> OAuth Client (Web application) must include the callbackUrl in Authorized redirect URIs (exact match).", "If Consent Screen is Testing, add your Gmail to Test users.", "If you have multiple OAuth clients, ensure GOOGLE_CLIENT_ID matches the client you edited in Console."] } });
};

export const googleCallback = (req: Request, res: Response, next: NextFunction) => {
  if (!hasGoogleOAuthConfig) return res.status(503).json({ success: false, message: "Google login is not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL." });

  passport.authenticate("google", { session: false }, async (error: Error | null, user: any) => {
    if (error || !user) return res.status(401).json({ success: false, message: error?.message || "Google authentication failed" });

    const userId = user._id.toString();
    // If user is candidate, ensure candidate profile exists
    if (user.role === "candidate") {
      const existingProfile = await CandidateProfile.findOne({ user: userId });
      if (!existingProfile) {
        await CandidateProfile.create({ user: userId, name: user.name || "", phone: "", bio: "", address: "", skills: [] });
      }
    }

    const accessToken = authService.signToken({ id: userId, role: user.role, email: user.email }, ACCESS_TTL);
    const refreshToken = authService.generateRefreshToken(userId);

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: REFRESH_COOKIE_MAXAGE });


    // Log full user info and tokens
    console.log("[Google Registration/Login]", {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        password: user.password,
        avatar: user.avatar,
        authProvider: user.authProvider,
        role: user.role,
        savedJobs: user.savedJobs,
        isEmailVerified: user.isEmailVerified,
        isSuspended: user.isSuspended,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        __v: user.__v,
        googleId: user.googleId
      },
      accessToken,
      refreshToken
    });

    if (req.query.mode === "json") return res.status(200).json({ success: true, data: { user: toAuthUserPayload(user), accessToken, refreshToken } });

    // Always redirect to root (/) with accessToken
    const frontendUrl = new URL(env.FRONTEND_URL);
    frontendUrl.pathname = "/";
    frontendUrl.searchParams.set("accessToken", accessToken);
    return res.redirect(frontendUrl.toString());
  })(req, res, next);
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });
    await authService.requestPasswordReset(email);
    return res.status(200).json({ success: true, message: "If that email is registered, a password reset link has been sent." });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message || "Failed to process request" });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ success: false, message: "Token and new password are required" });
    await authService.resetPassword(token, password);
    return res.status(200).json({ success: true, message: "Password has been reset successfully" });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message || "Failed to reset password" });
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body.refreshToken;
    if (!refreshToken) return res.status(401).json({ success: false, message: "Refresh token is required" });

    const decoded: any = authService.verifyRefreshToken(refreshToken);
    const userId = decoded.id;
    if (!userId) return res.status(401).json({ success: false, message: "Invalid refresh token" });

    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ success: false, message: "User not found" });

    const newAccessToken = authService.signToken({ id: userId, role: user.role, email: user.email }, ACCESS_TTL);
    const newRefreshToken = authService.generateRefreshToken(userId);

    res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: REFRESH_COOKIE_MAXAGE });

    res.status(200).json({ success: true, data: { accessToken: newAccessToken, refreshToken: newRefreshToken } });
  } catch (_error: any) {
    res.status(401).json({ success: false, message: "Invalid refresh token" });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    res.clearCookie(REFRESH_COOKIE_NAME, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" });
    res.status(200).json({ success: true, message: "Successfully logged out" });
  } catch (_error: any) {
    res.status(500).json({ success: false, message: "Logout failed" });
  }
};

export const me = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;
    if (authHeader && authHeader.startsWith("Bearer ")) token = authHeader.substring(7);
    else if (req.cookies?.[REFRESH_COOKIE_NAME]) token = req.cookies[REFRESH_COOKIE_NAME];
    if (!token) return res.status(401).json({ success: false, message: "Authentication token is required" });

    const decoded: any = authService.verifyToken(token);
    const userId = decoded.id;
    if (!userId) return res.status(401).json({ success: false, message: "Invalid token" });

    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    let profile: any = null;
    switch (user.role) {
      case "candidate":
        profile = await CandidateProfile.findOne({ user: userId }).lean();
        break;
      case "recruiter":
        profile = await RecruiterProfile.findOne({ user: userId }).lean();
        break;
      case "admin":
        profile = await AdminProfile.findOne({ user: userId }).lean();
        break;
    }

    const userResponse = { id: user._id, name: user.name, email: user.email, avatar: (user as any).avatar ?? "", role: user.role, ...(user.role === "recruiter" ? { isRecruiterApproved: (user as any).isRecruiterApproved ?? false, recruiterApprovedAt: (user as any).recruiterApprovedAt ?? null, recruiterApprovedBy: (user as any).recruiterApprovedBy ?? null } : {}), profile };

    res.status(200).json({ success: true, data: userResponse });
  } catch (error: any) {
    res.status(401).json({ success: false, message: error.message || "Invalid or expired token" });
  }
};
