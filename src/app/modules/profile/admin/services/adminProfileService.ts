import { AdminProfile } from "../models/AdminProfile";
import bcrypt from 'bcrypt';

export interface CreateAdminProfileDTO {
  name?: string;
  email?: string;
  role?: string;
  // add other properties expected when creating an admin profile
  [key: string]: any;
}

export interface UpdateAdminProfileDTO {
  name?: string;
  email?: string;
  role?: string;
  // partial update shape for admin profile
  [key: string]: any;
}

export const createAdminProfile = async (data: CreateAdminProfileDTO) => {
  // Create a new instance to trigger pre-save hooks
  const admin = new AdminProfile(data);
  // Save the admin (this will trigger the pre-save hook for password hashing)
  await admin.save();
  return admin;
};

export const getAdminProfile = async (id: string) => {
  return await AdminProfile.findById(id);
};

// In adminProfileService.ts
export const updateAdminProfile = async (id: string, data: UpdateAdminProfileDTO) => {
  // If password is being updated, hash it
  if (data.password) {
    const salt = await bcrypt.genSalt(10);
    data.password = await bcrypt.hash(data.password, salt);
  }

  return await AdminProfile.findByIdAndUpdate(
    id, 
    { $set: data },
    { new: true, runValidators: true }
  );
};

export const getAllAdmins = async () => {
  return await AdminProfile.find();
};

export const getAdminByEmail = async (email: string) => {
  return await AdminProfile.findOne({ email }).select('+password');
};
