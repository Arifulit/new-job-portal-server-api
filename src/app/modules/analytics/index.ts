import { Router } from "express";
// import { getDashboardStatsController } from "../controllers/analyticsController";
import { authMiddleware } from "../../../middleware/auth";
import { getDashboardStatsController } from "./controllers/analyticsController";

const router = Router();

// Only Admin or Employer can access analytics
router.get("/dashboard", authMiddleware(["Admin", "Employer"]), getDashboardStatsController);

export default router;