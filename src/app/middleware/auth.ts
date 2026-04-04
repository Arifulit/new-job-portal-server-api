
// // import { Request, Response, NextFunction, RequestHandler } from "express";

import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest } from "../../types/express";
import { User } from "../modules/auth/models/User";

const isAuthDebug = process.env.AUTH_DEBUG === "true";
const authDebugLog = (...args: any[]) => {
  if (isAuthDebug) console.log(...args);
};

function extractToken(req: Request): string | undefined {
  // 1. Check Authorization header first
  const authHeader = (req.headers.authorization || "").toString();
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  
  // 2. Check cookies
  if ((req as any).cookies?.accessToken) {
    return (req as any).cookies.accessToken;
  }
  if ((req as any).cookies?.refreshToken) {
    return (req as any).cookies.refreshToken;
  }
  
  return undefined;
}

const normalizeRole = (value: unknown): "admin" | "recruiter" | "candidate" => {
  const role = String(value || "candidate").toLowerCase().trim();

  if (role === "admin" || role === "super_admin") return "admin";
  if (role === "recruiter" || role === "recruiters" || role === "employer") return "recruiter";
  if (role === "candidate" || role === "user") return "candidate";

  return "candidate";
};

export const authMiddleware = (allowedRoles?: string[]): RequestHandler => {
  return async (req: Request | AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      authDebugLog("🔐 authMiddleware: Starting authentication check");
      authDebugLog("🔐 Request method:", req.method);
      authDebugLog("🔐 Request path:", req.path);
      authDebugLog("🔐 Allowed roles:", allowedRoles || "Any authenticated user");
      
      // Extract token from request
      const token = extractToken(req);
      if (!token) {
        authDebugLog("⚠️ authMiddleware: No authentication token found");
        return res.status(401).json({ 
          success: false, 
          message: "Authentication required" 
        });
      }

      // Get JWT secret
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        console.error("❌ authMiddleware: JWT_SECRET is not configured");
        return res.status(500).json({ 
          success: false, 
          message: "Server configuration error" 
        });
      }

      try {
        // Verify and decode the token
        const decoded = jwt.verify(token, secret) as any;
        authDebugLog("✅ authMiddleware: Token verified successfully");
        
        // Ensure required fields exist in the token
        if (!decoded.id) {
          throw new Error("Token missing required fields");
        }

        // Resolve role from token payload first. If missing, fall back to DB lookup.
        let resolvedRoleRaw = decoded.role ?? decoded?.user?.role;
        let resolvedEmail = decoded.email || decoded?.user?.email || "";

        if (!resolvedRoleRaw) {
          const tokenUser = await User.findById(decoded.id).select("role email").lean();
          if (!tokenUser) {
            return res.status(401).json({
              success: false,
              message: "Invalid authentication token"
            });
          }
          resolvedRoleRaw = tokenUser.role;
          resolvedEmail = resolvedEmail || tokenUser.email || "";
        }

        const userRole = normalizeRole(resolvedRoleRaw);
        
        req.user = {
          id: decoded.id,
          email: resolvedEmail,
          role: userRole as 'admin' | 'recruiter' | 'candidate',
          ...decoded
        };

        // Ensure user exists before accessing properties
        if (!req.user) {
          return next(new Error('User not found in request after authentication'));
        }
        
        const user = req.user;
        authDebugLog("🔐 Authenticated user:", {
          id: user.id,
          role: user.role,
          email: user.email
        });

        // Check role-based access if required
        if (allowedRoles && allowedRoles.length > 0) {
          const allowed = allowedRoles.map(r => r.toString().toLowerCase().trim());
          
          authDebugLog("🔐 Checking access - User role:", `'${userRole}'`, "| Allowed roles:", allowed);
          
          // If user has 'admin' role, always allow access
          if (userRole === 'admin') {
            authDebugLog("✅ Admin access granted");
            next();
            return;
          }
          // If user is a recruiter, allow access to admin routes
          if (userRole === 'recruiter' && allowed.includes('admin')) {
            authDebugLog("✅ Recruiter has admin access");
            next();
            return;
          }
          // Check if user has any of the allowed roles
          else if (userRole && allowed.includes(userRole)) {
            authDebugLog(`✅ Access granted for role: ${userRole}`);
            next();
            return;
          }
          
          // If we get here, access is denied
          authDebugLog(`⚠️ authMiddleware: Access denied - Role '${userRole}' not in`, allowed);
          return res.status(403).json({ 
            success: false, 
            message: `Forbidden - You don't have permission to access this resource` 
          });
        }

        authDebugLog("✅ authMiddleware: Authentication successful, proceeding to route handler");
        next();
      } catch (verifyError: any) {
        console.error("❌ authMiddleware: Token verification failed:", verifyError.message);
        return res.status(401).json({ 
          success: false, 
          message: "Invalid or expired authentication token" 
        });
      }
    } catch (error: any) {
      console.error("❌ authMiddleware: Unexpected error:", error.message);
      return res.status(500).json({ 
        success: false, 
        message: "An error occurred during authentication" 
      });
    }
  };
};

export const optionalAuth: RequestHandler = (req, res, next) => {
  const token = extractToken(req);
  if (!token) return next();

  const secret = process.env.JWT_SECRET;
  if (!secret) return next();

  try {
    const decoded = jwt.verify(token, secret) as any;
    req.user = {
      id: decoded.id,
      email: decoded.email || '',
      role: normalizeRole(decoded.role || decoded?.user?.role),
      ...decoded
    };
    authDebugLog("🔐 Optional auth - Authenticated user:", req.user?.id);
  } catch (_error) {
    authDebugLog("ℹ️ Optional auth - Invalid token, continuing as guest");
  }
  
  next();
};

// Middleware to ensure user is authenticated and has the required role
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    authDebugLog("⚠️ requireAuth: User not authenticated");
    return res.status(401).json({ 
      success: false, 
      message: "Authentication required" 
    });
  }
  next();
};

export default authMiddleware;