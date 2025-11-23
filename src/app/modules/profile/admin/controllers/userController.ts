import { Request, Response } from "express";
import * as userService from "../services/userService";

export const getAllUsersFromDBController = async (req: Request, res: Response) => {
  try {
    const users = await userService.getAllUsersFromDB();
    
    res.status(200).json({
      success: true,
      message: "All users retrieved successfully",
      data: {
        users,
        total: users.length
      }
    });
  } catch (error: any) {
    console.error("Error in getAllUsersFromDBController:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error retrieving all users",
      error: {
        code: "ALL_USERS_FETCH_ERROR",
        description: "An error occurred while fetching all users"
      }
    });
  }
};

// export const getAllUsersController = async (req: Request, res: Response) => {
//   try {
//     const users = await userService.getAllUsers();
    
//     res.status(200).json({
//       success: true,
//       message: "Users retrieved successfully",
//       data: users
//     });
//   } catch (error: any) {
//     console.error("Error in getAllUsersController:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message || "Error retrieving users",
//       error: {
//         code: "USER_FETCH_ERROR",
//         description: "An error occurred while fetching users"
//       }
//     });
//   }
// };


export const getAllUsersController = async (req: Request, res: Response) => {
  try {
    const users = await userService.getAllUsers();
    
    res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      data: users
    });
  } catch (error: any) {
    console.error("Error in getAllUsersController:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error retrieving users",
      error: {
        code: "USERS_FETCH_ERROR",
        description: "An error occurred while fetching users"
      }
    });
  }
};

export const getAllCandidatesController = async (req: Request, res: Response) => {
  try {
    const candidates = await userService.getAllCandidates();
    
    res.status(200).json({
      success: true,
      message: "Candidates retrieved successfully",
      data: {
        candidates,
        total: candidates.length
      }
    });
  } catch (error: any) {
    console.error("Error in getAllCandidatesController:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error retrieving candidates",
      error: {
        code: "CANDIDATE_FETCH_ERROR",
        description: "An error occurred while fetching candidates"
      }
    });
  }
};

export const impersonateUserController = async (req: Request, res: Response) => {
  try {
    const { userId: targetUserId } = req.params;
    
    // Get admin ID from the authenticated user in the request
    // The exact path might vary based on your auth middleware
    const adminId = req.user?._id || req.user?.id || req.user?.user?._id;
    
    if (!adminId) {
      console.error('Admin ID not found in request:', { 
        user: req.user,
        params: req.params,
        headers: req.headers
      });
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required',
        error: {
          code: 'AUTH_REQUIRED',
          description: 'Admin user ID not found in the request'
        }
      });
    }

    const result = await userService.impersonateUser(adminId.toString(), targetUserId);
    
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error: any) {
    console.error("Error in impersonateUserController:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error during user impersonation",
      error: {
        code: "USER_IMPERSONATION_ERROR",
        description: "An error occurred while trying to impersonate the user"
      }
    });
  }
};

export const suspendUserController = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const result = await userService.suspendUserById(userId);
    
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error: any) {
    console.error("Error in suspendUserController:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error suspending user",
      error: {
        code: "USER_SUSPEND_ERROR",
        description: "An error occurred while suspending the user"
      }
    });
  }
};

export const updateUserRoleController = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({
        success: false,
        message: "Role is required",
        error: {
          code: "MISSING_ROLE",
          description: "The 'role' field is required in the request body"
        }
      });
    }

    const result = await userService.updateUserRole(userId, role);
    
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error: any) {
    console.error("Error in updateUserRoleController:", error);
    
    let statusCode = 500;
    let errorCode = "ROLE_UPDATE_ERROR";
    
    if (error.message.includes("User not found")) {
      statusCode = 404;
      errorCode = "USER_NOT_FOUND";
    } else if (error.message.includes("Cannot change role of a suspended user")) {
      statusCode = 400;
      errorCode = "USER_SUSPENDED";
    } else if (error.message.includes("Invalid role")) {
      statusCode = 400;
      errorCode = "INVALID_ROLE";
    }
    
    res.status(statusCode).json({
      success: false,
      message: error.message || "Error updating user role",
      error: {
        code: errorCode,
        description: error.message || "An error occurred while updating the user role"
      }
    });
  }
};

export const getAllRecruitersController = async (req: Request, res: Response) => {
  try {
    const recruiters = await userService.getAllRecruiters();
    
    res.status(200).json({
      success: true,
      message: "Recruiters retrieved successfully",
      data: {
        recruiters,
        total: recruiters.length
      }
    });
  } catch (error: any) {
    console.error("Error in getAllRecruitersController:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error retrieving recruiters",
      error: {
        code: "RECRUITER_FETCH_ERROR",
        description: "An error occurred while fetching recruiters"
      }
    });
  }
};

