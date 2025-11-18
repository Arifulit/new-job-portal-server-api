import { Request, Response, NextFunction } from "express";
import ApiError from "../core/errors/ApiError";
import { ApiResponse } from "../core/response/ApiResponse";

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("❌ Error Handler:", err);
  console.error("❌ Error name:", err.name);
  console.error("❌ Error message:", err.message);
  console.error("❌ Error stack:", err.stack);

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json(ApiResponse.fail(err.message, err.errors));
  }

  // In development, show detailed error
  const isDevelopment = process.env.NODE_ENV === "development";
  
  res.status(500).json({
    success: false,
    message: isDevelopment ? err.message || "Internal Server Error" : "Internal Server Error",
    ...(isDevelopment && {
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack
      }
    })
  });
};
