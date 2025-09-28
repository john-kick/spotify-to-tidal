import {
  authorize,
  callback,
  getLikedPlaylist,
  findTrack,
  addTrackToLikedTracks,
  removeAllPlaylists,
  deleteAllLikedTracks
} from "@/controller/tidalController";
import { Router } from "express";

const router = Router();

router.get("/auth", authorize);
router.get("/callback", callback);
router.get("/likedplaylist", getLikedPlaylist);
router.get("/track", findTrack);

router.post("/track", addTrackToLikedTracks);

router.delete("/tracks", deleteAllLikedTracks);
router.delete("/playlists", removeAllPlaylists);

export default router;
