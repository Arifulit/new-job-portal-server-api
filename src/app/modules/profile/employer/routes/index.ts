// import { Router, Request, Response } from "express";
// import asyncHandler from "../../../../utils/asyncHandler";

// const router = Router();

// router.get(
//   "/",
//   asyncHandler(async (req: Request, res: Response) => {
//     res.status(200).json({ message: "List employers" });
//   })
// );

// router.get(
//   "/:id",
//   asyncHandler(async (req: Request, res: Response) => {
//     res.status(200).json({ message: "Get employer profile", id: req.params.id });
//   })
// );

// router.post(
//   "/",
//   asyncHandler(async (req: Request, res: Response) => {
//     res.status(201).json({ message: "Create employer profile", body: req.body });
//   })
// );

// router.put(
//   "/:id",
//   asyncHandler(async (req: Request, res: Response) => {
//     res.status(200).json({ message: "Update employer profile", id: req.params.id, body: req.body });
//   })
// );

// router.delete(
//   "/:id",
//   asyncHandler(async (req: Request, res: Response) => {
//     res.status(204).send();
//   })
// );

// export default router;

// src/modules/profile/employer/routes.ts
import { Router, Request, Response, NextFunction } from "express";
import {
  createEmployerProfileController,
  getEmployerProfileController,
  updateEmployerProfileController,
  getCurrentEmployerProfileController,
  updateCurrentEmployerProfileController
} from "../controllers/employerProfileController";
import authMiddleware, { optionalAuth } from "../../../../middleware/auth";
import asyncHandler from "../../../../utils/asyncHandler";

const router = Router();

// Debug middleware
router.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`🔍 Employer Routes - ${req.method} ${req.path} | Original: ${req.originalUrl} | Base: ${req.baseUrl}`);
  next();
});

// IMPORTANT: Define specific routes BEFORE router.use() for sub-routes
// GET /api/v1/profile/employer - Get current user's employer profile (if authenticated)
router.get("/", optionalAuth, asyncHandler(getCurrentEmployerProfileController));

// POST /api/v1/profile/employer - Create employer profile
router.post("/", authMiddleware(["Employer"]), asyncHandler(createEmployerProfileController));

// PUT /api/v1/profile/employer - Update current user's employer profile
router.put("/", authMiddleware(["Employer"]), asyncHandler(updateCurrentEmployerProfileController));

// GET /api/v1/profile/employer/:userId - Public access (optional auth for additional info)
router.get("/:userId", optionalAuth, asyncHandler(getEmployerProfileController));

// PUT /api/v1/profile/employer/:userId
router.put("/:userId", authMiddleware(["Employer"]), asyncHandler(updateEmployerProfileController));

export default router;
