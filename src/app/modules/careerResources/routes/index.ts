import { Router } from "express";
import { getCareerResources, postCareerResource, getCareerResourceById } from "../controllers/careerResourcesController";
import { authMiddleware } from "../../../middleware/auth";

const router = Router();


// Public endpoint for all career resources
router.get("/", getCareerResources);

// Public endpoint for single career resource by id
router.get("/:id", getCareerResourceById);


// Anyone can post a new career resource
router.post("/", postCareerResource);

export default router;
