import {
  authorize,
  callback,
  getLikedPlaylist,
  findTrack,
  addTrackToLikedTracks
} from "@/controller/tidalController";
import { Router } from "express";

const router = Router();

router.get("/auth", authorize);
router.get("/callback", callback);
router.get("/likedplaylist", getLikedPlaylist);
router.get("/track", findTrack);

router.post("/track", addTrackToLikedTracks);

export default router;
