// import { Request, Response, NextFunction, RequestHandler } from "express";
// import jwt from "jsonwebtoken";

// export const authMiddleware = (allowedRoles?: string[]): RequestHandler => {
//   return (req: Request, res: Response, next: NextFunction) => {
//     try {
//       if (!req.user) {
//         const authHeader = (req.headers.authorization || "").toString();
//         const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
//         if (token) {
//           const secret = process.env.JWT_SECRET ?? process.env.EXPRESS_SESSION_SECRET;
//           if (!secret) return res.status(500).json({ message: "Server misconfigured: JWT secret missing" });
//           const decoded = jwt.verify(token, secret) as any;
//           req.user = {
//             id: decoded.id ?? decoded.sub,
//             email: decoded.email,
//             role: decoded.role,
//             ...decoded,
//           };
//         }
//       }

//       if (!req.user) return res.status(401).json({ message: "Unauthorized" });

//       if (allowedRoles && allowedRoles.length > 0) {
//         const userRole = (req.user.role || "").toString().toLowerCase();
//         const allowed = allowedRoles.map(r => r.toString().toLowerCase());
//         if (!allowed.includes(userRole)) return res.status(403).json({ message: "Forbidden" });
//       }

//       next();
//     } catch {
//       res.status(401).json({ message: "Unauthorized" });
//     }
//   };
// };

// export default authMiddleware;
// middleware/auth.ts
import { Request, Response, NextFunction, RequestHandler } from "express";
import { verifyToken } from "../config/jwt";

// Auth middleware: check token and optionally allowed roles
export const authMiddleware = (allowedRoles?: string[]): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = (req.headers.authorization || "").toString();
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

      if (!token) return res.status(401).json({ success: false, message: "Unauthorized" });

      const payload = verifyToken(token) as any;
      if (!payload) return res.status(401).json({ success: false, message: "Unauthorized" });

      (req as any).user = { id: payload.id ?? payload.sub, role: payload.role, ...payload };

      // Check roles if provided
      if (allowedRoles && allowedRoles.length > 0) {
        const userRole = ((req as any).user.role || "").toString().toLowerCase();
        const allowed = allowedRoles.map(r => r.toString().toLowerCase());
        if (!allowed.includes(userRole)) return res.status(403).json({ success: false, message: "Forbidden" });
      }

      next();
    } catch (err) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
  };
};

// optionalAuth: attach user if token present, otherwise continue
export const optionalAuth: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = (req.headers.authorization || "").toString();
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
    if (!token) return next();

    const payload = verifyToken(token) as any;
    if (!payload) return next();

    (req as any).user = { id: payload.id ?? payload.sub, role: payload.role, ...payload };
    next();
  } catch {
    next();
  }
};

// Default export (for convenience)
export default authMiddleware;
