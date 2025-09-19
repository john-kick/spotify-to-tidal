import { authorize, callback } from "@/controller/tidalController";
import { Router } from "express";

const router = Router();

router.get("/auth", authorize);
router.get("/callback", callback);

export default router;
