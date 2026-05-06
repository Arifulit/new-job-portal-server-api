import { Router } from "express";
import { getHomePageController } from "../controllers/homeController";

const router = Router();

router.get("/", getHomePageController);

export default router;