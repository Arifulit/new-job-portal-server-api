import { Router } from "express";
import { authMiddleware } from "../../../../middleware/auth";
import {
  getAllUsersController,
  getAllCandidatesController,
  getAllRecruitersController,
  getAllUsersFromDBController,
  suspendUserController,
  impersonateUserController
} from "../controllers/userController";

const router = Router();

// Get all users (both candidates and recruiters)
router.get("/", authMiddleware(["Admin"]), getAllUsersController);

// Get all users from database (all roles)
router.get("/all", authMiddleware(["Admin"]), getAllUsersFromDBController);

// Get all candidates
router.get("/candidates", authMiddleware(["Admin"]), getAllCandidatesController);

// Get all recruiters
router.get("/recruiters", authMiddleware(["Admin"]), getAllRecruitersController);

// Suspend/Unsuspend a user
router.put("/:userId/suspend", authMiddleware(["Admin"]), suspendUserController);

// Impersonate a user
router.post("/:userId/impersonate", authMiddleware(["Admin"]), impersonateUserController);

export default router;
