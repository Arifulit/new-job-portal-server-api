import { Request, Response } from "express";
import { getHomePageData } from "../services/homeService";

export const getHomePageController = async (_req: Request, res: Response) => {
  try {
    const data = await getHomePageData();
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load home page data",
    });
  }
};