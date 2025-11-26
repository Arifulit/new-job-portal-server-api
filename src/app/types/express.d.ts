import { JwtPayload } from 'jsonwebtoken';

export interface User extends JwtPayload {
  id: string;
  role: string;
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
