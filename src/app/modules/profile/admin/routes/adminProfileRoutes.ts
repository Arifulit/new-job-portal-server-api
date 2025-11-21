import { Router } from "express";
import { authMiddleware, optionalAuth } from "../../../../middleware/auth";
import {
  createAdminController,
  getAdminController,
  updateAdminController,
  getAllAdminsController
} from "../controllers/adminProfileController";

const router = Router();

// Protected routes (require admin role for create/update/delete)
router.post("/", authMiddleware(["admin"]), createAdminController);
router.put("/", authMiddleware(["admin"]), updateAdminController);

// Get current admin's profile
router.get("/", authMiddleware(["admin", "user"]), getAdminController);

// Get specific admin profile by ID (admin only)
router.get("/all", authMiddleware(["admin"]), getAllAdminsController);

// Get admin profile by ID (public route with optional auth)
router.get("/:id", optionalAuth, getAdminController);

export default router;
