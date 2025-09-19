import {
  authorize,
  callback,
  getLikedPlaylist
} from "@/controller/tidalController";
import { Router } from "express";

const router = Router();

router.get("/auth", authorize);
router.get("/callback", callback);
router.get("/likedplaylist", getLikedPlaylist);

export default router;
