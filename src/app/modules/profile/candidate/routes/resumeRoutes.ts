// import { Router } from "express";
// import { uploadResumeController, getResumeController } from "../controllers/resumeController";
// import { authMiddleware } from "../../../../middleware/auth";

// const router = Router();

// router.post("/", authMiddleware(["Candidate"]), uploadResumeController);
// router.get("/:candidateId", authMiddleware(["Candidate", "Admin"]), getResumeController);

// export default router;
import { Router } from "express";
import { uploadResumeController, getResumeController } from "../controllers/resumeController";
import authMiddleware from "../../../../middleware/auth";

const router = Router();

// POST /api/v1/candidate/resume
router.post("/", authMiddleware(["Candidate"]), uploadResumeController);

// GET /api/v1/candidate/resume/:candidateId
router.get("/:candidateId", authMiddleware(["Candidate", "Admin"]), getResumeController);

export default router;
