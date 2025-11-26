// middleware/auditLogger.ts
import { Request, Response, NextFunction } from "express";
import { createAuditLog } from "../modules/audit/services/auditService";
import { Types } from "mongoose";

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: 'recruiter' | 'candidate' | 'admin';
    email?: string;
    [key: string]: any;
  };
}

export const auditLogger = (action: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    res.on("finish", async () => {
      // Only log if user is authenticated
      if (req.user?.id) {
        await createAuditLog({
          user: new Types.ObjectId(req.user.id),
          action,
          resource: req.originalUrl,
          method: req.method,
          ip: req.ip || 'unknown',
          status: res.statusCode < 400 ? "Success" : "Failed",
          description: `${res.statusCode} ${res.statusMessage || ''}`.trim()
        });
      }
    });
    next();
  };
};
