import { Types } from "mongoose";
import { User } from "../../../auth/models/User";

// Get all users from the database
export const impersonateUser = async (adminId: string, targetUserId: string) => {
  try {
    // Verify admin user exists
    const adminUser = await User.findById(adminId);
    if (!adminUser) {
      throw new Error('Admin user not found');
    }

    // Verify target user exists
    const targetUser = await User.findById(targetUserId).select('-password -refreshToken');
    if (!targetUser) {
      throw new Error('Target user not found');
    }

    // Generate an impersonation token
    const payload = {
      _id: targetUser._id,
      email: targetUser.email,
      role: targetUser.role,
      isImpersonated: true,
      originalAdmin: adminId
    };

    // In a real implementation, you would generate a JWT token here
    // For now, we'll return the user details and a flag indicating impersonation
    return {
      success: true,
      message: 'Impersonation successful',
      data: {
        user: targetUser,
        isImpersonated: true,
        originalAdmin: adminId
      }
    };
  } catch (error) {
    console.error('Error in user impersonation:', error);
    throw error;
  }
};

export const suspendUserById = async (userId: string) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Toggle the isSuspended status
    user.isSuspended = !user.isSuspended;
    await user.save();
    
    return {
      success: true,
      message: `User ${user.isSuspended ? 'suspended' : 'activated'} successfully`,
      data: {
        userId: user._id,
        isSuspended: user.isSuspended
      }
    };
  } catch (error) {
    console.error('Error suspending user:', error);
    throw error;
  }
};

export const getAllUsersFromDB = async () => {
  try {
    const users = await User.find({})
      .select('-password -__v -refreshToken')
      .sort({ createdAt: -1 }) // Sort by newest first
      .lean();
    return users;
  } catch (error) {
    console.error('Error fetching all users:', error);
    throw error;
  }
};

export const getAllCandidates = async () => {
  try {
    const candidates = await User.find({ role: 'Candidate' })
      .select('-password -__v -refreshToken')
      .sort({ createdAt: -1 })
      .lean();
    return candidates;
  } catch (error) {
    console.error('Error fetching candidates:', error);
    throw error;
  }
};

export const getAllRecruiters = async () => {
  try {
    const recruiters = await User.find({ role: 'Recruiter' })
      .select('-password -__v -refreshToken')
      .sort({ createdAt: -1 })
      .lean();
    return recruiters;
  } catch (error) {
    console.error('Error fetching recruiters:', error);
    throw error;
  }
};

// export const getAllUsers = async () => {
//   try {
//     const [allUsers, candidates, recruiters] = await Promise.all([
//       getAllUsersFromDB(),
//       getAllCandidates(),
//       getAllRecruiters()
//     ]);
    
//     const result: any = {
//       totalUsers: allUsers.length,
//       totalCandidates: candidates.length,
//       totalRecruiters: recruiters.length
//     };
    
//     // Only include non-empty arrays in the response
//     if (allUsers.length > 0) result.allUsers = allUsers;
//     if (candidates.length > 0) result.candidates = candidates;
//     if (recruiters.length > 0) result.recruiters = recruiters;
    
//     return result;
//   } catch (error) {
//     console.error('Error fetching users data:', error);
//     throw error;
//   }
// };


export const getAllUsers = async () => {
  try {
    const allUsers = await getAllUsersFromDB();
    
    // Filter out admin users
    const nonAdminUsers = allUsers.filter(user => user.role !== 'admin');
    
    // Count users by role (excluding admins)
    const roleCounts = nonAdminUsers.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Separate users by role (excluding admins)
    const candidates = nonAdminUsers.filter(user => user.role === 'candidate');
    const recruiters = nonAdminUsers.filter(user => user.role === 'recruiter');

    const result: any = {
      totalUsers: nonAdminUsers.length,
      ...roleCounts,  // This will include candidate: Y, recruiter: Z
      allUsers: nonAdminUsers
    };

    // Only include non-empty arrays in the response
    if (candidates.length > 0) result.candidates = candidates;
    if (recruiters.length > 0) result.recruiters = recruiters;

    return result;
  } catch (error) {
    console.error('Error fetching users data:', error);
    throw error;
  }
};