import { Router } from "express";
import { getCameraStatus, reportCameraStatus } from "../controllers/camera.controller.js";

const router = Router();

/**
 * GET /api/camera/status
 * Camera/secure-context diagnostics — see camera.controller.js for details.
 * No auth required: the frontend needs to call this BEFORE login/scan flows
 * to decide whether to even show the camera UI.
 */
router.get("/status", getCameraStatus);

/**
 * POST /api/camera/report
 * Optional client-side outcome reporting (see camera.controller.js).
 */
router.post("/report", reportCameraStatus);

export default router;
