import { Router } from "express";
import { migrate, progress, test } from "@/controller/migrationController";

const router = Router();

router.get("/progress", progress);

router.post("/", migrate);

router.post("/bar", test);

export default router;
