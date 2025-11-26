import { Router, RequestHandler } from "express";
import { createPaymentController, getPaymentsController } from "../controllers/paymentController";
import { authMiddleware } from "../../../middleware/auth";

const router = Router();

// Using type assertion to ensure proper typing with the auth middleware
router.post("/", authMiddleware() as RequestHandler, createPaymentController as RequestHandler);
router.get("/", authMiddleware() as RequestHandler, getPaymentsController as RequestHandler);

export default router;
