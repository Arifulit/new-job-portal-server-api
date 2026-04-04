import { RecruiterProfile } from "../models/RecruiterProfile";
import { User } from "../../../auth/models/User";

// dto/index.ts does not export a module; use simple local types until the dto barrel file is fixed
type CreateRecruiterProfileDTO = any;
type UpdateRecruiterProfileDTO = any;

export const createRecruiterProfile = async (data: CreateRecruiterProfileDTO) => {
  return await RecruiterProfile.create(data);
};

export const getRecruiterProfile = async (userId: string) => {
  return await RecruiterProfile.findOne({ user: userId })
    .populate("user", "name email role")
    .populate("agency")
    .populate("company")
    .lean();
};

export const updateRecruiterProfile = async (userId: string, data: any) => {
  const { name, email, ...rest } = data || {};

  // Name/email are stored in User model, so update those separately.
  const userUpdates: Record<string, string> = {};
  if (typeof name === "string" && name.trim()) {
    userUpdates.name = name.trim();
  }
  if (typeof email === "string" && email.trim()) {
    userUpdates.email = email.trim().toLowerCase();
  }
  if (Object.keys(userUpdates).length > 0) {
    await User.findByIdAndUpdate(userId, { $set: userUpdates }, { new: false });
  }

  const normalizedRest = { ...rest } as any;
  if (normalizedRest.biodata !== undefined && normalizedRest.bio === undefined) {
    normalizedRest.bio = normalizedRest.biodata;
  }
  delete normalizedRest.biodata;
  delete normalizedRest.role;
  delete normalizedRest.user;

  const allowedProfileFields = ["phone", "designation", "agency", "company", "bio", "location"];
  const profileUpdates = Object.fromEntries(
    Object.entries(normalizedRest).filter(([key, value]) => allowedProfileFields.includes(key) && value !== undefined)
  );

  const profile = await RecruiterProfile.findOneAndUpdate(
    { user: userId },
    { $set: profileUpdates },
    { new: true, runValidators: true }
  )
  .populate('user', 'name email role')
  .populate('agency')
  .populate('company')
  .lean();
  
  if (!profile) {
    throw new Error('Recruiter profile not found');
  }
  
  return profile;
};
