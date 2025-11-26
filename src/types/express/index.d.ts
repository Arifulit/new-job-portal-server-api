import { Request } from 'express';
import { JwtPayload } from 'jsonwebtoken';

export type UserRole = 
  | 'super_admin' 
  | 'admin' 
  | 'recruiter' 
  | 'candidate';

export interface IUser extends JwtPayload {
  id: string;
  role: UserRole;
  email?: string;
  [key: string]: any;
}

// Export User type for external use
export type User = IUser;

// Extend Express types
declare global {
  namespace Express {
    interface User extends IUser {}  // This is the key change - extends IUser

    // Extend the Express Request interface
    interface Request {
      /**
       * The authenticated user object. This is populated after authentication.
       * Can be undefined for public routes.
       */
      user?: User;
      
      /**
       * Additional query options that can be used for filtering, sorting, etc.
       */
      queryOptions?: any;
    }
  }
}

/**
 * Extended Request type for authenticated routes
 * Use this when you are certain the request is authenticated
 */
export interface AuthenticatedRequest extends Request {
  user: User;
}

// No need for empty export {} here since we're using import/export syntax