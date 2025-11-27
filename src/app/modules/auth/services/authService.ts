

import { User, IUser } from "../models/User";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key-do-not-use-in-production";

export const registerUser = async (name: string, email: string, password: string, role: IUser["role"]) => {
  try {
    // চেক করুন ইমেইল ইতিমধ্যে ব্যবহৃত হয়েছে কিনা
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error("Email already exists");
    }

    // নতুন user তৈরি করুন। Password automatically hash হবে pre-save middleware এর মাধ্যমে
    const user = new User({ name, email, password, role });
    await user.save();

    // Create a new object without the password field using destructuring
    const { password: _, ...userResponse } = user.toObject();
    
    return userResponse;
  } catch (error) {
    throw error;
  }
};

export const loginUser = async (email: string, password: string) => {
  try {
    // User খুঁজুন এবং স্পষ্টভাবে password field select করুন
    const user = await User.findOne({ email }).select("+password");
    
    if (!user) {
      throw new Error("User not found");
    }

    // Password verify করুন
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      throw new Error("Password incorrect");
    }

    // Remove password field from response using destructuring
    const { password: pwd, ...userResponse } = user.toObject();
    
    return { user: userResponse };
  } catch (error) {
    throw error;
  }
};

export const signToken = (
  payload: object, 
  expiresIn: string | number = "24h"
): string => {
  return jwt.sign(
    payload, 
    JWT_SECRET as jwt.Secret, 
    { 
      expiresIn: expiresIn as string,
      algorithm: 'HS256' // Explicitly set the algorithm
    } as jwt.SignOptions
  );
};

export const verifyToken = (token: string): any => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET as jwt.Secret);
    return decoded;
  } catch (error) {
    throw new Error("Invalid token");
  }
};

export const generateAccessToken = (userId: string, role: string, email: string): string => {
  const payload = { id: userId, role, email };
  return signToken(payload, "24h");
};

export const generateRefreshToken = (userId: string): string => {
  const payload = { id: userId };
  return signToken(payload, "30d");
};

// Optional: Refresh token database এ save করার function
export const saveRefreshToken = async (userId: string, refreshToken: string): Promise<void> => {
  try {
    await User.findByIdAndUpdate(userId, { refreshToken });
  } catch (error) {
    throw new Error("Failed to save refresh token");
  }
};

// Optional: Refresh token database থেকে মুছে ফেলার function
export const removeRefreshToken = async (userId: string): Promise<void> => {
  try {
    await User.findByIdAndUpdate(userId, { refreshToken: null });
  } catch (error) {
    throw new Error("Failed to remove refresh token");
  }
};

// Optional: Refresh token validate করার function
export const validateRefreshToken = async (refreshToken: string): Promise<boolean> => {
  try {
    const decoded: any = verifyToken(refreshToken);
    const user = await User.findOne({ 
      _id: decoded.id, 
      refreshToken: refreshToken 
    });

    return !!user; // User পাওয়া গেলে true, না হলে false
  } catch (error) {
    return false;
  }
};

// Optional: User এর refresh token verify করার function
export const isValidRefreshTokenForUser = async (userId: string, refreshToken: string): Promise<boolean> => {
  try {
    const user = await User.findOne({ 
      _id: userId, 
      refreshToken: refreshToken 
    });
    return !!user;
  } catch (error) {
    return false;
  }
};