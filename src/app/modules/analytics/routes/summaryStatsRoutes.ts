import { Router } from "express";
import { getSummaryStats } from "../controllers/summaryStatsController";

const router = Router();

router.get("/summary", getSummaryStats);

export default router;
