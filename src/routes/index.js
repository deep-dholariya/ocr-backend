import { Router } from "express";

import authRoutes from "./auth.routes.js";
import userRoutes from "./user.routes.js";
import ocrRoutes from "./ocr.routes.js";
import cameraRoutes from "./camera.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/user", userRoutes);
router.use("/ocr", ocrRoutes);
router.use("/camera", cameraRoutes);

export default router;