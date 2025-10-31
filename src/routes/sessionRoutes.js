import { Router } from "express";
import { getSessions, removeSessions } from "../controllers/sessionController.js";

const router = Router();

router.get("/", getSessions);
router.delete("/", removeSessions);

export default router;
