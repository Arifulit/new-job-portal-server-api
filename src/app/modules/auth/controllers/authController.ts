
import { Request, Response } from "express";
import * as authService from "../services/authService";
import { User } from "../models/User";

import { CandidateProfile } from "../../profile/candidate/models/CandidateProfile";
// Employer related code removed
import { RecruiterProfile } from "../../profile/recruiter/models/RecruiterProfile";
import { AdminProfile } from "../../profile/admin/models/AdminProfile";

const ACCESS_TTL = "15m";
const REFRESH_TTL = "7d";
const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_COOKIE_MAXAGE = 7 * 24 * 60 * 60 * 1000;

// export const register = async (req: Request, res: Response) => {
//   const { name, email, password, role, phone, company, designation, agency, skills } = req.body;
//   try {
//     const user = await authService.registerUser(name, email, password, role);
//     const userId = (user as any)._id.toString();

//     // Auto-create profile
//     switch (role) {
//       case "candidate":
//         if (!phone) throw new Error("Phone is required for candidate");
//         await CandidateProfile.create({ user: userId, name, phone, skills: skills || [] });
//         break;

//       case "employer":
//         if (!phone || !company || !designation) throw new Error("Phone, company and designation are required for employer");
//         await EmployerProfile.create({ user: userId, name, phone, company, designation });
//         break;

//       case "recruiter":
//         if (!phone || !designation || !agency) throw new Error("Phone, designation and agency are required for recruiter");
//         await RecruiterProfile.create({ user: userId, name, phone, designation, agency });
//         break;

//       case "admin":
//         if (!phone) throw new Error("Phone is required for admin");
//         await AdminProfile.create({ user: userId, name, email, phone, role: "admin" });
//         break;

//       default:
//         throw new Error("Invalid role");
//     }

//     const accessToken = authService.signToken({ id: userId, role }, ACCESS_TTL);
//     const refreshToken = authService.signToken({ id: userId }, REFRESH_TTL);

//     res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === "production",
//       sameSite: "lax",
//       maxAge: REFRESH_COOKIE_MAXAGE
//     });

//     res.status(201).json({ success: true, data: { user, accessToken, refreshToken } });
//   } catch (err: any) {
//     res.status(400).json({ success: false, message: err.message });
//   }
// };


export const register = async (req: Request, res: Response) => {
  const { name, email, password, role, phone, designation, agency, skills } = req.body;

  // FIX: accept both companyName and companyId
  const company = req.body.company || req.body.companyId;

  try {
    const user = await authService.registerUser(name, email, password, role);
    const userId = (user as any)._id.toString();

    // Auto-create profile
    switch (role) {
      case "candidate":
        if (!phone) throw new Error("Phone is required for candidate");
        await CandidateProfile.create({
          user: userId,
          name,
          phone,
          skills: skills || []
        });
        break;

      // Employer registration removed

      case "recruiter":
        if (!phone || !designation || !agency)
          throw new Error("Phone, designation and agency are required for recruiter");

        await RecruiterProfile.create({
          user: userId,
          name,
          phone,
          designation,
          agency
        });
        break;

      case "admin":
        if (!phone) throw new Error("Phone is required for admin");
        await AdminProfile.create({
          user: userId,
          name,
          email,
          phone,
          role: "Admin"
        });
        break;

      default:
        throw new Error("Invalid role");
    }

    const accessToken = authService.signToken({ id: userId, role }, "15m");
    const refreshToken = authService.signToken({ id: userId }, "7d");

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      success: true,
      data: { user, accessToken, refreshToken }
    });

  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
    }

    const { user } = await authService.loginUser(email, password);
    const userId = (user as any)._id.toString();
    const userRole = (user as any).role || 'user';
    
    // Include the role in both access and refresh tokens
    const accessToken = authService.signToken({ 
      id: userId, 
      role: userRole,
      email: user.email
    }, ACCESS_TTL);
    
    const refreshToken = authService.signToken({ 
      id: userId,
      role: userRole
    }, REFRESH_TTL);

    // Remove sensitive data from user object
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      // Add other non-sensitive fields as needed
    };

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: REFRESH_COOKIE_MAXAGE
    });

    res.status(200).json({ 
      success: true, 
      data: { 
        user: userResponse, 
        accessToken, 
        refreshToken 
      } 
    });
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(400).json({ 
      success: false, 
      message: err.message || "Login failed. Please check your credentials." 
    });
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] ?? req.body?.refreshToken;
    if (!token) return res.status(401).json({ success: false, message: "Refresh token missing" });

    const decoded: any = authService.verifyToken(token);
    const userId = decoded?.id ?? decoded?.sub;
    if (!userId) return res.status(401).json({ success: false, message: "Invalid token payload" });

    const user = await User.findById(userId).lean().exec();
    if (!user) return res.status(401).json({ success: false, message: "User not found" });

    const accessToken = authService.signToken({ id: userId, role: (user as any).role }, ACCESS_TTL);
    const refreshToken = authService.signToken({ id: userId }, REFRESH_TTL);

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: REFRESH_COOKIE_MAXAGE
    });

    res.status(200).json({ success: true, data: { accessToken, refreshToken } });
  } catch (err: any) {
    res.status(401).json({ success: false, message: "Invalid refresh token" });
  }
};

export const logout = async (req: Request, res: Response) => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  res.status(200).json({ success: true, message: "Logged out" });
};
