import { Response, Request } from "express";
import { AuthenticatedRequest } from "@/types/express";
import * as adminService from "../services/adminProfileService";
import bcrypt from "bcryptjs";
import { AdminProfile } from "../models/AdminProfile";
import { User } from "../../../auth/models/User";

const toIdString = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toString" in value) {
    return (value as { toString: () => string }).toString();
  }
  return "";
};

const getAuthUserId = (req: Request | AuthenticatedRequest): string => {
  return toIdString((req as any).user?.id || (req as any).user?._id);
};

const isAdminRole = (role: unknown): boolean => {
  return String(role || "").toLowerCase().trim() === "admin";
};

// Create initial admin if not exists
export const ensureAdminExists = async () => {
  try {
    const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || "admin@example.com";
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || "admin123";
    
    let admin = await AdminProfile.findOne({ email: adminEmail });
    
    if (!admin) {
      // Create a new admin instance to trigger pre-save hooks
      admin = new AdminProfile({
        name: process.env.DEFAULT_ADMIN_NAME || "Admin User",
        email: adminEmail,
        password: adminPassword, // Will be hashed by pre-save hook
        role: "Admin",
        phone: process.env.DEFAULT_ADMIN_PHONE || ""
      });
      
      // Save the admin (this will trigger the pre-save hook)
      await admin.save();
      
      console.log("✅ Initial admin user created:", admin.email);
      console.log("🔑 Default password:", adminPassword);
      console.log("⚠️ Please change this password after first login!");
    } else {
      console.log("ℹ️  Admin user already exists:", admin.email);
    }
    return admin;
  } catch (error) {
    console.error("❌ Error ensuring admin exists:", error);
    throw error;
  }
};

// Admin Profile Controllers
interface CreateAdminRequest extends Request {
  body: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    [key: string]: any;  // This allows for other properties that might be added by middleware
  };
}

export const createAdminController = async (req: CreateAdminRequest, res: Response) => {
  try {
    const { name, email, password, phone } = req.body;
    
    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required"
      });
    }
    
    // Check if email already exists
    const existingAdmin = await AdminProfile.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: "Email already in use"
      });
    }
    
    // Create admin profile with all required fields
    const admin = new AdminProfile({
      name,
      email,
      password, // Will be hashed by pre-save hook
      role: "Admin",
      phone: phone || ""
    });
    
    // Save the admin (this will trigger the pre-save hook)
    await admin.save();
    
    // Convert to object and exclude password before sending response
    const { password: _, ...adminObject } = admin.toObject();
    
    res.status(201).json({ 
      success: true, 
      message: "Admin created successfully",
      data: adminObject
    });
  } catch (error: any) {
    res.status(400).json({ 
      success: false, 
      message: error.message || "Failed to create admin" 
    });
  }
};

// Get admin profile (works for both authenticated and unauthenticated requests)
export const getAdminController = async (req: Request, res: Response) => {
  try {
    // Use either the ID from params (for public access) or from the authenticated user
    const requestedId = toIdString(req.params.id);
    const authUserId = getAuthUserId(req);
    const userId = requestedId || authUserId;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Include all fields except the ones we explicitly exclude
    const admin = await AdminProfile.findOne({
      $or: [
        { user: userId },
        { _id: userId },
      ],
    })
      .select('+password')  // Include password if needed
      .lean();

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found"
      });
    }

    // If the request is not from the owner or an admin, return limited profile data
    const ownerId = toIdString((admin as any).user) || toIdString((admin as any)._id);
    const isOwner = !!authUserId && ownerId === authUserId;
    const isAdmin = isAdminRole((req as any).user?.role);

    if (!isOwner && !isAdmin) {
      // Return only public profile data
      const { _id, name, email, avatar } = admin;
      return res.json({ 
        success: true, 
        data: { _id, name, email, avatar } 
      });
    }

    // Return full profile data for owner or admin
    res.status(200).json({
      success: true,
      data: admin
    });
  } catch (error: any) {
    console.error('Error in getAdminController:', error);
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching admin profile"
    });
  }
};
export const updateAdminController = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    
    const adminId = getAuthUserId(req);
    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'User ID is missing in authentication token'
      });
    }

    const updateData = { ...req.body };
    const normalizedBiodata = updateData.biodata ?? updateData.bio;
    const normalizedLocation = updateData.location ?? updateData.address;

    if (updateData.name !== undefined || updateData.email !== undefined) {
      const userUpdates: Record<string, string> = {};
      if (typeof updateData.name === 'string') userUpdates.name = updateData.name.trim();
      if (typeof updateData.email === 'string') userUpdates.email = updateData.email.trim().toLowerCase();
      if (Object.keys(userUpdates).length > 0) {
        await User.findByIdAndUpdate(adminId, { $set: userUpdates }, { new: false });
      }
    }

    // Find the admin
    let admin = await AdminProfile.findOne({
      $or: [
        { user: adminId },
        { _id: adminId },
      ],
    });

    if (!admin) {
      // If admin doesn't exist, ensure required fields for creation are present
      if (!updateData.name || !(updateData.email || req.user.email)) {
        return res.status(400).json({
          success: false,
          message: 'Name and email are required to create an admin profile'
        });
      }

      // Create new admin with provided fields
      admin = new AdminProfile({
        user: adminId,
        name: updateData.name,
        email: (updateData.email || req.user.email || '').toLowerCase(),
        role: 'Admin',
        ...(updateData.phone !== undefined && { phone: updateData.phone }),
        ...(normalizedBiodata !== undefined && { biodata: normalizedBiodata }),
        ...(normalizedLocation !== undefined && { location: normalizedLocation }),
        ...(updateData.avatar !== undefined && { avatar: updateData.avatar })
      });
    } else {
      // Role is immutable by schema; keep profile fields editable.
      if (updateData.name !== undefined) {
        admin.name = updateData.name;
      }
      if (updateData.email !== undefined) {
        admin.email = String(updateData.email).toLowerCase();
      }
      if (updateData.phone !== undefined) {
        admin.phone = updateData.phone;
      }
      if (normalizedBiodata !== undefined) {
        (admin as any).biodata = normalizedBiodata;
      }
      if (normalizedLocation !== undefined) {
        (admin as any).location = normalizedLocation;
      }
      if (updateData.avatar !== undefined) {
        admin.avatar = updateData.avatar;
      }
    }

    // Role is protected by the schema's immutable: true setting
    // No need to manually delete it here

    // Save changes
    const savedAdmin = await admin.save();
    const { password, ...result } = savedAdmin.toObject();

    res.status(200).json({
      success: true,
      message: "Operation successful",
      data: result
    });

  } catch (error: any) {
    console.error('Error in updateAdminController:', error);
    res.status(400).json({
      success: false,
      message: error.message || "Operation failed. Please check your input and try again."
    });
  }
};

export const getAllAdminsController = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    
    const [admins, total] = await Promise.all([
      AdminProfile.find().select('-password').skip(skip).limit(limit).lean(),
      AdminProfile.countDocuments()
    ]);
    
    res.status(200).json({
      success: true,
      data: admins,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching admins"
    });
  }
};
