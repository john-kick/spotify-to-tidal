import { Router } from "express";
import { migrate, progress } from "@/controller/migrationController";

const router = Router();

router.get("/progress", progress);
router.post("/", migrate);

export default router;
