
// ...existing code...
declare global {
  namespace Express {
    interface Request {
      /**
       * Populated after authentication; optional for public routes.
       */
      user?: User;
    }
  }

  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV?: "development" | "production" | "test";
      PORT?: string;
      DB_URL?: string;
      FRONTEND_URL?: string;
      EXPRESS_SESSION_SECRET?: string;
      REDIS_URL?: string;
      [key: string]: string | undefined;
    }
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
    csrfToken?: string;
    flash?: Record<string, any>;
    [key: string]: any;
  }
}

export {};
// ...existing code...