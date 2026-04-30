import { Router } from "express";

const router = Router();

// GET /auth/google/success
router.get("/google/success", (req, res) => {
  res.status(200).send("<h2>Google Login Successful! You can close this tab and return to the app.</h2>");
});

export default router;
