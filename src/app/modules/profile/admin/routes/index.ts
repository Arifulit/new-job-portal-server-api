import adminProfileRoutes from "./adminProfileRoutes";
import announcementRoutes from "./announcementRoutes";
import userRoutes from "./userRoutes";
import { Router } from "express";

const router = Router();

router.use("/profile", adminProfileRoutes);
router.use("/announcement", announcementRoutes);
router.use("/users", userRoutes);

export default router;
