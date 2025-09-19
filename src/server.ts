import cookieParser from "cookie-parser";
import express, { type Request, type Response } from "express";
import path from "path";
import {
  getLikedSongs,
  TOKEN_COOKIE_KEY as SPOTIFY_TOKEN_COOKIE_KEY,
  authorize as spotifyAuth,
  callback as spotifyCallback
} from "./spotify";
import { authorize as tidalAuth, callback as tidalCallback } from "./tidal";

const PORT = process.env.PORT || 3000;
const app = express();

app.use(cookieParser());
app.use(express.json());

app.use(express.static(path.join(__dirname, "../public")));

app.get("/spotify/auth", spotifyAuth);
app.get("/spotify/callback", spotifyCallback);
app.get("/spotify/likedsongs", async (req: Request, res: Response) => {
  try {
    const token = req.cookies[SPOTIFY_TOKEN_COOKIE_KEY];
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

app.get("/tidal/auth", tidalAuth);
app.get("/tidal/callback", tidalCallback);

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
