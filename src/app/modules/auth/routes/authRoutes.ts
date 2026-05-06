// এই ফাইলটি auth module এর endpoint route mapping করে।


import { Router } from "express";
import {
	register,
	login,
	refresh,
	logout,
	me,
	googleAuth,
	googleCallback,
	googleDebug,
	forgotPassword,
	resetPassword,
} from "../controllers";
import { imageUpload } from "../../../../app/middleware/upload";

const router = Router();

router.post("/register", imageUpload.single('companyLogo'), register);
router.post("/login", login);
router.get("/google/debug", googleDebug);

router.get("/google", googleAuth);
router.get("/google/callback", googleCallback);


router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", me);
export default router;