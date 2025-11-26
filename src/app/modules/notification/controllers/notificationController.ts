import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../../../types/express";
import * as notificationService from "../services/notificationService";

export const getNotifications = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    const notifications = await notificationService.getUserNotifications(req.user.id);
    res.status(200).json({ success: true, data: notifications });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const markRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const notification = await notificationService.markNotificationRead(req.params.id);
    res.status(200).json({ success: true, data: notification });
  } catch (err: any) {
    next(err);
  }
};
