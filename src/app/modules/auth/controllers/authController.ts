import { Request, Response } from "express";
import { Types } from "mongoose";
import * as authService from "../services/authService";
import { User } from "../models/User";
import { CandidateProfile } from "../../profile/candidate/models/CandidateProfile";
import { RecruiterProfile } from "../../profile/recruiter/models/RecruiterProfile";
import { AdminProfile } from "../../profile/admin/models/AdminProfile";
import { RecruitmentAgency } from "../../agency/models/recruitmentAgency.model";
import Company from "../../company/models/Company";

const ACCESS_TTL = "24h";
const REFRESH_TTL = "30d";
const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_COOKIE_MAXAGE = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

const toAuthUserPayload = (user: any) => {
  const base = {
    _id: user._id,
    id: user._id,
    name: user.name,
    email: user.email,
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

    // Required field validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required",
      });
    }

    // Create user
    const user = await authService.registerUser(
      name,
      email,
      password,
      role as any,
    );

    if (role === "recruiter") {
      (user as any).isRecruiterApproved = false;
    }

    // Create corresponding profile based on role
    const userId = user._id.toString();

    switch (role) {
      case "candidate":
        if (!phone || !biodata || !location) {
          return res.status(400).json({
            success: false,
            message:
              "Phone number, biodata and location are required for candidate registration",
          });
        }
        await CandidateProfile.create({
          user: userId,
          name,
          phone,
          bio: String(biodata).trim(),
          address: String(location).trim(),
          skills: skills || [],
        });
        break;

      case "recruiter": {
        if (
          !phone ||
          !biodata ||
          !location ||
          !designation ||
          !companyName ||
          !yearOfEstablishment ||
          !companyAddress ||
          !industryType ||
          !websiteUrl
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Phone, biodata, location, designation, companyName, yearOfEstablishment, companyAddress, industryType and websiteUrl are required for recruiter registration",
          });
        }

        const normalizedCompanyName = String(companyName).trim();
        const companyDoc = await Company.findOneAndUpdate(
          { name: { $regex: `^${normalizedCompanyName}$`, $options: "i" } },
          {
            $set: {
              industry: String(industryType).trim(),
              website: String(websiteUrl).trim(),
              address: String(companyAddress).trim(),
              yearOfEstablishment: Number(yearOfEstablishment),
            },
            $setOnInsert: {
              name: normalizedCompanyName,
              isVerified: false,
            },
          },
          { new: true, upsert: true },
        );

        let agencyId = agency;
        if (!agencyId || !Types.ObjectId.isValid(agencyId)) {
          let agencyDoc = await RecruitmentAgency.findOne({
            name: { $regex: `^${normalizedCompanyName}$`, $options: "i" },
          });

          if (!agencyDoc) {
            agencyDoc = await RecruitmentAgency.create({
              name: normalizedCompanyName,
              website: String(websiteUrl).trim(),
              industry: String(industryType).trim(),
            });
          }

          agencyId = agencyDoc._id;
        }

        await RecruiterProfile.create({
          user: userId,
          phone,
          designation,
          bio: String(biodata).trim(),
          location: String(location).trim(),
          agency: agencyId,
          company: companyDoc._id,
        });
        break;
      }

      case "admin":
        if (!phone || !biodata || !location) {
          return res.status(400).json({
            success: false,
            message:
              "Phone number, biodata and location are required for admin registration",
          });
        }
        await AdminProfile.create({
          user: userId,
          name,
          email,
          phone,
          biodata: String(biodata).trim(),
          location: String(location).trim(),
          role: "Admin",
        });
        break;

      default:
        return res.status(400).json({
          success: false,
          message: "Invalid role specified",
        });
    }

    // Generate tokens
    const accessToken = authService.signToken(
      { id: userId, role: user.role, email: user.email },
      ACCESS_TTL,
    );
    const refreshToken = authService.signToken({ id: userId }, REFRESH_TTL);

    // Set refresh token cookie
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: REFRESH_COOKIE_MAXAGE,
    });

    res.status(201).json({
      success: true,
      message:
        role === "recruiter"
          ? "Recruiter registered successfully. Waiting for admin approval."
          : "Registration successful",
      data: {
        user: toAuthUserPayload(user),
        accessToken,
        refreshToken,
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || "Registration failed",
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Authenticate user
    const { user } = await authService.loginUser(email, password);
    const userId = user._id.toString();

    // Generate tokens
    const accessToken = authService.signToken(
      { id: userId, role: user.role, email: user.email },
      ACCESS_TTL,
    );

    const refreshToken = authService.signToken({ id: userId }, REFRESH_TTL);

    // Set refresh token cookie
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: REFRESH_COOKIE_MAXAGE,
    });

    res.status(200).json({
      success: true,
      data: {
        user: toAuthUserPayload(user),
        accessToken,
        refreshToken,
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || "Login failed. Please check your credentials.",
    });
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const refreshToken =
      req.cookies?.[REFRESH_COOKIE_NAME] || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token is required",
      });
    }

    const decoded: any = authService.verifyToken(refreshToken);
    const userId = decoded.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Generate new tokens
    const newAccessToken = authService.signToken(
      { id: userId, role: user.role, email: user.email },
      ACCESS_TTL,
    );

    const newRefreshToken = authService.signToken({ id: userId }, REFRESH_TTL);

    // Update refresh token cookie
    res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: REFRESH_COOKIE_MAXAGE,
    });

    res.status(200).json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (_error: any) {
    res.status(401).json({
      success: false,
      message: "Invalid refresh token",
    });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    // Clear the refresh token cookie
    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    res.status(200).json({
      success: true,
      message: "Successfully logged out",
    });
  } catch (_error: any) {
    res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};

export const me = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    } else if (req.cookies?.[REFRESH_COOKIE_NAME]) {
      token = req.cookies[REFRESH_COOKIE_NAME];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is required",
      });
    }

    const decoded: any = authService.verifyToken(token);
    const userId = decoded.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

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

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      ...(user.role === "recruiter"
        ? {
            isRecruiterApproved: (user as any).isRecruiterApproved ?? false,
            recruiterApprovedAt: (user as any).recruiterApprovedAt ?? null,
            recruiterApprovedBy: (user as any).recruiterApprovedBy ?? null,
          }
        : {}),
      profile,
    };

    res.status(200).json({
      success: true,
      data: userResponse,
    });
  } catch (error: any) {
    res.status(401).json({
      success: false,
      message: error.message || "Invalid or expired token",
    });
  }
};
