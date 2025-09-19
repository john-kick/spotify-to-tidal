import { Router, type Request, type Response } from "express";
import {
  authorize,
  callback,
  getLikedSongs,
  TOKEN_COOKIE_KEY
} from "@/controller/spotifyController";

const router = Router();

router.get("/auth", authorize);
router.get("/callback", callback);
router.get("/likedsongs", async (req: Request, res: Response) => {
  try {
    const token = req.cookies[TOKEN_COOKIE_KEY];
    if (!token) {
      res.status(401).json({ message: "No Spotify access token" });
      return;
    }
    const likedSongs = await getLikedSongs(token);
    res.status(200).json(likedSongs);
  } catch (err) {
    res.status(500).json(err);
  }
});

export default router;
