import { RecruiterProfile } from "../models/RecruiterProfile";
import { User } from "../../../auth/models/User";
import { Job } from "../../../job/models/Job";
import { Application } from "../../../application/models/Application";

// dto/index.ts does not export a module; use simple local types until the dto barrel file is fixed
type CreateRecruiterProfileDTO = any;
type UpdateRecruiterProfileDTO = any;

export const createRecruiterProfile = async (data: CreateRecruiterProfileDTO) => {
  return await RecruiterProfile.create(data);
};

export const getRecruiterProfile = async (userId: string) => {
  const profile = await RecruiterProfile.findOne({ user: userId })
    .populate("user", "name email role avatar")
    .populate("company", "name industry size yearOfEstablishment address location website logo email phone description isVerified verifiedAt verifiedBy createdAt updatedAt")
    .lean();

  if (!profile) {
    return null;
  }

  // Calculate stats
  const jobsPosted = await Job.countDocuments({ createdBy: userId });
  
  // Count applications for jobs created by this recruiter
  const recruiterJobIds = await Job.find({ createdBy: userId }).select("_id").lean();
  const jobIdsList = recruiterJobIds.map(job => job._id);
  const applicantsCount = await Application.countDocuments({ job: { $in: jobIdsList } });

  return {
    ...profile,
    jobsPosted,
    applicantsCount,
  };
};

export const updateRecruiterProfile = async (userId: string, data: any) => {
  const { name, email, avatar, ...rest } = data || {};

  // Name/email are stored in User model, so update those separately.
  const userUpdates: Record<string, string> = {};
  if (typeof name === "string" && name.trim()) {
    userUpdates.name = name.trim();
  }
  if (typeof email === "string" && email.trim()) {
    userUpdates.email = email.trim().toLowerCase();
  }
  if (typeof avatar === "string" && avatar.trim()) {
    userUpdates.avatar = avatar.trim();
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

  const allowedProfileFields = ["phone", "designation", "company", "bio", "location"];
  const profileUpdates = Object.fromEntries(
    Object.entries(normalizedRest).filter(([key, value]) => allowedProfileFields.includes(key) && value !== undefined)
  );

  const profile = await RecruiterProfile.findOneAndUpdate(
    { user: userId },
    { $set: profileUpdates },
    { new: true, runValidators: true }
  )
  .populate('user', 'name email role avatar')
  .populate('company', 'name industry size yearOfEstablishment address location website logo email phone description isVerified verifiedAt verifiedBy createdAt updatedAt')
  .lean();
  
  if (!profile) {
    throw new Error('Recruiter profile not found');
  }

  // Calculate stats
  const jobsPosted = await Job.countDocuments({ createdBy: userId });
  
  // Count applications for jobs created by this recruiter
  const recruiterJobIds = await Job.find({ createdBy: userId }).select("_id").lean();
  const jobIdsList = recruiterJobIds.map(job => job._id);
  const applicantsCount = await Application.countDocuments({ job: { $in: jobIdsList } });

  return {
    ...profile,
    jobsPosted,
    applicantsCount,
  };
};
