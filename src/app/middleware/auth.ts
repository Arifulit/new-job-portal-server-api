
// import { Request, Response, NextFunction, RequestHandler } from "express";
// import { verifyToken } from "../config/jwt";

// // Auth middleware: check token and optionally allowed roles
// export const authMiddleware = (allowedRoles?: string[]): RequestHandler => {
//   return (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const authHeader = (req.headers.authorization || "").toString();
//       const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

//       if (!token) return res.status(401).json({ success: false, message: "Unauthorized" });

//       const payload = verifyToken(token) as any;
//       if (!payload) return res.status(401).json({ success: false, message: "Unauthorized" });

//       (req as any).user = { id: payload.id ?? payload.sub, role: payload.role, ...payload };

//       // Check roles if provided
//       if (allowedRoles && allowedRoles.length > 0) {
//         const userRole = ((req as any).user.role || "").toString().toLowerCase();
//         const allowed = allowedRoles.map(r => r.toString().toLowerCase());
//         if (!allowed.includes(userRole)) return res.status(403).json({ success: false, message: "Forbidden" });
//       }

//       next();
//     } catch (err) {
//       return res.status(401).json({ success: false, message: "Unauthorized" });
//     }
//   };
// };

// // optionalAuth: attach user if token present, otherwise continue
// export const optionalAuth: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const authHeader = (req.headers.authorization || "").toString();
//     const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
//     if (!token) return next();

//     const payload = verifyToken(token) as any;
//     if (!payload) return next();

//     (req as any).user = { id: payload.id ?? payload.sub, role: payload.role, ...payload };
//     next();
//   } catch {
//     next();
//   }
// };

// // Default export (for convenience)
// export default authMiddleware;
// ...existing code...
import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt from "jsonwebtoken";

function extractToken(req: Request) {
  const authHeader = (req.headers.authorization || "").toString();
  if (authHeader.startsWith("Bearer ")) return authHeader.slice(7);
  // accept token from cookies if present (ensure cookie-parser is used in server)
  if ((req as any).cookies?.accessToken) return (req as any).cookies.accessToken;
  if ((req as any).cookies?.refreshToken) return (req as any).cookies.refreshToken;
  return undefined;
}

export const authMiddleware = (allowedRoles?: string[]): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log("🔐 authMiddleware: Checking authentication");
      console.log("🔐 Request method:", req.method);
      console.log("🔐 Request path:", req.path);
      console.log("🔐 Allowed roles:", allowedRoles);
      
      const token = extractToken(req);
      console.log("🔐 Token extracted:", token ? "Yes" : "No");
      
      if (!token) {
        console.log("⚠️ authMiddleware: No token provided");
        return res.status(401).json({ 
          success: false, 
          message: "Unauthorized - No token provided. Please include Authorization header with Bearer token" 
        });
      }

      const secret = process.env.JWT_SECRET ?? process.env.EXPRESS_SESSION_SECRET;
      if (!secret) {
        console.log("❌ authMiddleware: JWT secret missing");
        return res.status(500).json({ success: false, message: "Server misconfigured: JWT secret missing" });
      }

      try {
        const decoded = jwt.verify(token, secret) as any;
        console.log("✅ authMiddleware: Token verified successfully");
        console.log("🔐 Decoded token:", { id: decoded.id, role: decoded.role, email: decoded.email });
        
        req.user = {
          id: decoded.id ?? decoded.sub,
          email: decoded.email,
          role: decoded.role,
          ...decoded
        };

        if (allowedRoles && allowedRoles.length > 0) {
          const userRole = (((req.user as any)?.role ?? "")).toString().toLowerCase();
          const allowed = allowedRoles.map(r => r.toString().toLowerCase());
          console.log("🔐 User role:", userRole, "| Allowed roles:", allowed);
          
          if (!allowed.includes(userRole)) {
            console.log("⚠️ authMiddleware: Role mismatch - User role not in allowed roles");
            return res.status(403).json({ 
              success: false, 
              message: `Forbidden - Required role: ${allowedRoles.join(" or ")}, but user has role: ${userRole || "none"}` 
            });
          }
        }

        console.log("✅ authMiddleware: Authentication successful, proceeding...");
        next();
      } catch (verifyError: any) {
        console.log("❌ authMiddleware: Token verification failed:", verifyError.message);
        return res.status(401).json({ 
          success: false, 
          message: `Unauthorized - Invalid or expired token: ${verifyError.message}` 
        });
      }
    } catch (err: any) {
      console.log("❌ authMiddleware: Unexpected error:", err.message);
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized - Authentication failed" 
      });
    }
  };
};

export const optionalAuth: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req);
    if (token) {
      const secret = process.env.JWT_SECRET ?? process.env.EXPRESS_SESSION_SECRET;
      if (secret) {
        try {
          const decoded = jwt.verify(token, secret) as any;
          req.user = {
            id: decoded.id ?? decoded.sub,
            email: decoded.email,
            role: decoded.role,
            ...decoded
          };
          console.log("✅ optionalAuth: User authenticated:", req.user.id);
        } catch (verifyError: any) {
          console.log("⚠️ optionalAuth: Token verification failed:", verifyError.message);
          // Continue without setting req.user
        }
      } else {
        console.log("⚠️ optionalAuth: JWT secret not configured");
      }
    } else {
      console.log("⚠️ optionalAuth: No token provided");
    }
  } catch (err: any) {
    console.log("⚠️ optionalAuth: Error extracting token:", err.message);
    // Continue without setting req.user
  }
  next();
};

export default authMiddleware;
// ...existing code...