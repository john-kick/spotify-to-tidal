import {
  TOKEN_COOKIE_KEY as SPOTIFY_TOKEN_COOKIE_KEY,
  getLikedSongs,
  getUserPlaylists
} from "@/controller/spotifyController";
import {
  TOKEN_COOKIE_KEY as TIDAL_TOKEN_COOKIE_KEY,
  addTracksToLikedSongs,
  createPlaylistsFromSpotifyPlaylists,
  getTracksFromISRC
} from "@/controller/tidalController";
import type { SpotifyTrack } from "@/types/spotify";
import type { TidalAPIError } from "@/types/tidal";
import { type Request, type Response } from "express";

export default async function migrate(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const spotifyToken = req.cookies[SPOTIFY_TOKEN_COOKIE_KEY];
    const tidalToken = req.cookies[TIDAL_TOKEN_COOKIE_KEY];
    // await migrateLikedSongs(spotifyToken, tidalToken);
    await migratePlaylists(spotifyToken, tidalToken);
    res.status(200).send("OK");
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
}

async function migrateLikedSongs(
  spotifyToken: string,
  tidalToken: string
): Promise<TidalAPIError | undefined> {
  const spotifyTracks: SpotifyTrack[] = await getLikedSongs(spotifyToken);
  const { success, result } = await getTracksFromISRC(
    spotifyTracks.map((track) => track.isrc),
    tidalToken
  );

  if (!success) {
    const errResult = result as TidalAPIError;
    return errResult;
  }

  const tidalTrackIDs = result as string[];
  addTracksToLikedSongs(tidalTrackIDs, tidalToken);
}

async function migratePlaylists(
  spotifyToken: string,
  tidalToken: string
): Promise<void> {
  const [spotifyPlaylists, spotifyErrors] = await getUserPlaylists(
    spotifyToken
  );
  spotifyErrors.forEach((spotifyError) => {
    console.error(
      `Error while getting user playlists: (${spotifyError.error.status}) ${spotifyError.error.status}`
    );
  });
  await createPlaylistsFromSpotifyPlaylists(spotifyPlaylists, tidalToken);
}
