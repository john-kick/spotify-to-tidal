import { Router } from "express";
import migrate, {
  testPlaylistCreation
} from "@/controller/migrationController";

const router = Router();

router.post("/", migrate);
router.post("/test", testPlaylistCreation);

export default router;
