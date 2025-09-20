import spotifyRouter from "@/routes/spotify.routes";
import tidalRouter from "@/routes/tidal.routes";
import migrationRouter from "@/routes/migration.routes";
import cookieParser from "cookie-parser";
import express from "express";
import path from "path";
import {
  getTracksFromISRC,
  TOKEN_COOKIE_KEY as TIDAL_TOKEN_COOKIE_KEY,
  type TidalTrack
} from "@/controller/tidalController";
import {
  getLikedSongs,
  TOKEN_COOKIE_KEY as SPOTIFY_TOKEN_COOKIE_KEY,
  type SpotifyTrack
} from "@/controller/spotifyController";

const PORT = process.env.PORT || 3000;
const app = express();

app.use(cookieParser());
app.use(express.json());

app.use("/spotify", spotifyRouter);
app.use("/tidal", tidalRouter);
app.use("/migrate", migrationRouter);

app.get("/test", async (req, res) => {
  try {
    const spotifyToken = req.cookies[SPOTIFY_TOKEN_COOKIE_KEY];
    const spotifyTracks: SpotifyTrack[] = await getLikedSongs(spotifyToken);
    const tidalToken = req.cookies[TIDAL_TOKEN_COOKIE_KEY];
    const tidalTracks: TidalTrack[] = await getTracksFromISRC(
      spotifyTracks.map((track) => track.isrc),
      tidalToken
    );
    res.status(200).json(tidalTracks);
  } catch (err) {
    console.log(err);
    res.status(500).json(err);
  }
});

app.use(express.static(path.join(__dirname, "../public")));

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
