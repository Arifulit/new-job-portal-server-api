import { Router } from "express";
import { sendContactMessageController } from "../controllers/contactController";

const router = Router();

router.post("/send", sendContactMessageController);

export default router;