// Strict request type for authenticated routes
import { Request } from 'express';
export interface AuthenticatedRequest extends Request {
  user: User;
}
import { JwtPayload } from 'jsonwebtoken';

export type UserRole = 'candidate' | 'recruiter' | 'admin';

export interface User extends JwtPayload {
  id: string;
  role: UserRole;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export {};
