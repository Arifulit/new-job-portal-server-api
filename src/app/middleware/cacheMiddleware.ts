import { Request, Response, NextFunction } from "express";
import { createClient } from "redis";

// Extend the Express Response type to include our custom properties
declare module 'express-serve-static-core' {
  interface Response {
    originalJson: Response['json'];
  }
}

const client = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

client.connect().catch(console.error);

export const cacheMiddleware = (keyPrefix: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = keyPrefix + req.originalUrl;
    
    try {
      // Try to get data from cache
      const cachedData = await client.get(key);
      
      if (cachedData) {
        return res.status(200).json({
          success: true,
          data: JSON.parse(cachedData),
          cached: true
        });
      }

      // Store the original json method
      const originalJson = res.json.bind(res);
      
      // Override the json method to cache the response before sending
      res.json = (body: any): Response<any> => {
        // Don't cache error responses
        if (res.statusCode >= 400) {
          return originalJson(body);
        }
        
        // Cache the response
        client.setEx(key, 3600, JSON.stringify(body)) // cache for 1 hour
          .catch(console.error);
          
        return originalJson(body);
      };
      
      next();
    } catch (err) {
      console.error('Cache error:', err);
      next();
    }
  };
};
