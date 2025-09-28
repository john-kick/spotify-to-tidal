import {
  authorize,
  callback,
  deleteAllLikedTracks,
  removeAllPlaylists
} from "@/controller/tidalController";
import { Router } from "express";

const router = Router();

router.get("/auth", authorize);
router.get("/callback", callback);

router.delete("/tracks", deleteAllLikedTracks);
router.delete("/playlists", removeAllPlaylists);

export default router;
