import { type Request, type Response } from "express";
import { TOKEN_COOKIE_KEY as SPOTIFY_TOKEN_COOKIE_KEY, getLikedSongs } from "@/controller/spotifyController";
import { TOKEN_COOKIE_KEY as TIDAL_TOKEN_COOKIE_KEY, getTracksFromISRC, addTracksToLikedSongs } from "@/controller/tidalController";

export default async function migrate(req: Request, res: Response): void {
  try {
    const spotifyToken = req.cookies[SPOTIFY_TOKEN_COOKIE_KEY];
    const tidalToken = req.cookies[TIDAL_TOKEN_COOKIE_KEY];
    await migrateLikedSongs(spotifyToken, tidalToken);
    res.status(200).json(ids);
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
}

async function migrateLikedSongs(spotifyToken: string, tidalToken: string): void
{
  const spotifyTracks: SpotifyTrack[] = await getLikedSongs(spotifyToken);
  const tidalTrackIDs = await getTracksFromISRC(
    spotifyTracks.map((track) => track.isrc),
    tidalToken
  );

  addTracksToLikedSongs(tidalTrackIDs, tidalToken);
}
