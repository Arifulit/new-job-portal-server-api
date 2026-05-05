import { Request, Response } from "express";
import CareerResource from "../models/CareerResource";

// GET: Single resource by id
export const getCareerResourceById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const resource = await CareerResource.findById(id);
    if (!resource) {
      return res.status(404).json({ success: false, message: "Resource not found" });
    }
    res.json({ success: true, data: resource });
  } catch {
    res.status(400).json({ success: false, message: "Invalid resource id" });
  }
};

// GET: Anyone can get all career resources
export const getCareerResources = async (req: Request, res: Response) => {
  try {
    const resources = await CareerResource.find().sort({ createdAt: -1 });
    res.json({ success: true, data: resources });
  } catch {
    res.status(500).json({ success: false, message: "Failed to fetch resources" });
  }
};

// POST: Only admin can add new resource
export const postCareerResource = async (req: Request, res: Response) => {
  const { category, title, description } = req.body;
  if (!category || !title || !description) {
    return res.status(400).json({ success: false, message: "All fields are required." });
  }
  try {
    const newResource = await CareerResource.create({ category, title, description });
    res.status(201).json({ success: true, data: newResource });
  } catch {
    res.status(500).json({ success: false, message: "Failed to create resource" });
  }
};
