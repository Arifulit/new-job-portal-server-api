// // import { Router } from "express";
// // import {
// //   createCandidateProfileController,
// //   getCandidateProfileController,
// //   updateCandidateProfileController
// // } from "../controllers/candidateProfileController";
// // import { authMiddleware } from "../../../../middleware/auth";

// // const router = Router();

// // router.post("/", authMiddleware(["Candidate"]), createCandidateProfileController);
// // router.get("/:userId", authMiddleware(["Candidate", "Admin"]), getCandidateProfileController);
// // router.put("/:userId", authMiddleware(["Candidate"]), updateCandidateProfileController);

// // export default router;
// // ...existing code...
// import { Router, Request, Response } from "express";
// import asyncHandler from "../../../../utils/asyncHandler";
// import {
//   createCandidateProfileController,
//   getCandidateProfileController,
//   updateCandidateProfileController
// } from "../controllers/candidateProfileController";
// import authMiddleware, { optionalAuth } from "../../../../middleware/auth";

// const router = Router();

// // debug log: incoming params + url + base/path
// router.use((req: Request, res: Response, next) => {
//   console.log("🔎 Route hit:", req.method, req.originalUrl, "baseUrl:", req.baseUrl, "path:", req.path, "params:", req.params, "query:", req.query);
//   next();
// });

// // accept both /:userId and /profile/:userId so requests work regardless of mounting
// router.get(["/:userId", "/profile/:userId"], optionalAuth, asyncHandler(getCandidateProfileController));

// router.post("/", authMiddleware(["candidate","Candidate"]), createCandidateProfileController);
// router.put(["/:userId","/profile/:userId"], authMiddleware(["candidate","Candidate"]), updateCandidateProfileController);

// export default router;

import { Router } from "express";
import asyncHandler from "../../../../utils/asyncHandler";
import {
  createCandidateProfileController,
  getCandidateProfileController,
  updateCandidateProfileController
} from "../controllers/candidateProfileController";
import authMiddleware, { optionalAuth } from "../../../../middleware/auth";

const router = Router();

// GET /api/v1/candidate/profile/:userId
router.get("/:userId", optionalAuth, asyncHandler(getCandidateProfileController));

// POST /api/v1/candidate/profile
router.post("/", authMiddleware(["Candidate"]), asyncHandler(createCandidateProfileController));

// PUT /api/v1/candidate/profile/:userId
router.put("/:userId", authMiddleware(["Candidate"]), asyncHandler(updateCandidateProfileController));

export default router;
