import { Request } from 'express';
import { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: 'admin' | 'candidate' | 'recruiter';
        [key: string]: any;
      } & JwtPayload;
    }
  }
}

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: 'admin' | 'candidate' | 'recruiter';
    email?: string;
    [key: string]: any;
  };
}

export { AuthenticatedRequest };

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      role: 'admin' | 'candidate' | 'recruiter';
      email?: string;
      [key: string]: any;
    };
  }
}
