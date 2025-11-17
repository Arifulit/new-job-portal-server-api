// // import { Router } from "express";
// // import candidateProfileRoutes from "./candidateProfileRoutes";
// // import resumeRoutes from "./resumeRoutes";

// // const router = Router();

// // console.log("✅ Candidate Routes initialized");

// // router.use("/profile", candidateProfileRoutes);
// // router.use("/resume", resumeRoutes);
// import { Router } from "express";
// import candidateProfileRoutes from "./candidateProfileRoutes";
// import resumeRoutes from "./resumeRoutes";

// const router = Router();

// console.log("✅ Candidate Routes initialized");

// // Mount profile routes at /profile
// // Final path: /api/v1/candidate/profile/:userId
// router.use("/profile", candidateProfileRoutes);

// // Mount resume routes at /resume
// // Final path: /api/v1/candidate/resume/...
// router.use("/resume", resumeRoutes);

// export default router;

import { Router } from "express";
import candidateProfileRoutes from "./candidateProfileRoutes";
import resumeRoutes from "./resumeRoutes";

const router = Router();

console.log("✅ Candidate Routes Loaded");

// /api/v1/candidate/profile
router.use("/profile", candidateProfileRoutes);

// /api/v1/candidate/resume
router.use("/resume", resumeRoutes);

export default router;
