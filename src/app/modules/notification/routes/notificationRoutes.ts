import { Router, Request, Response, NextFunction } from "express";
import { getNotifications, markRead } from "../controllers/notificationController";
import { authMiddleware } from "../../../middleware/auth";
import { AuthenticatedRequest } from "../../../../types/express";

const router = Router();

router.get("/", authMiddleware(), (req: Request, res: Response) => {
  // At this point, authMiddleware has ensured req.user exists
  getNotifications(req as AuthenticatedRequest, res);
});

router.put("/:id/read", authMiddleware(), (req: Request, res: Response, next: NextFunction) => {
  // At this point, authMiddleware has ensured req.user exists
  markRead(req as AuthenticatedRequest, res, next);
});

export default router;
