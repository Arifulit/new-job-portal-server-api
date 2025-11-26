import { Request } from 'express';

declare global {
  namespace Express {
    interface User {
      id: string;
      role: 'admin' | 'recruiter' | 'candidate';
      email?: string;
      [key: string]: any;
    }

    interface Request {
      user?: User;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    role: 'admin' | 'recruiter' | 'candidate';
    email?: string;
    [key: string]: any;
  };
}
