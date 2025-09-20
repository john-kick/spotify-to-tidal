import { Router } from "express";
import migrate from "@/controller/migrationController";


const router = Router();

router.post("/", migrate);

export default router;
