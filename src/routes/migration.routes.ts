import { Router } from "express";
import { migrate, result } from "@/controller/migrationController";

const router = Router();

router.post("/", migrate);
router.get("/result", result);

export default router;
