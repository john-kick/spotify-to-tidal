import {
  TOKEN_COOKIE_KEY as SPOTIFY_TOKEN_COOKIE_KEY,
  getLikedSongs,
  getUserPlaylists
} from "@/controller/spotifyController";
import {
  TOKEN_COOKIE_KEY as TIDAL_TOKEN_COOKIE_KEY,
  addTracksToLikedSongs,
  createPlaylist,
  createPlaylistsFromSpotifyPlaylists,
  getTracksFromISRC
} from "@/controller/tidalController";
import type {
  SpotifyError,
  SpotifyPlaylist,
  SpotifyTrack
} from "@/types/spotify";
import { type Request, type Response } from "express";

export default async function migrate(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const spotifyToken = req.cookies[SPOTIFY_TOKEN_COOKIE_KEY];
    const tidalToken = req.cookies[TIDAL_TOKEN_COOKIE_KEY];
    // await migrateLikedSongs(spotifyToken, tidalToken);
    const data = await migratePlaylists(spotifyToken, tidalToken);
    res.status(200).send(data);
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
}

async function migrateLikedSongs(
  spotifyToken: string,
  tidalToken: string
): Promise<void> {
  const spotifyTracks: SpotifyTrack[] = await getLikedSongs(spotifyToken);
  const tidalTrackIDs = await getTracksFromISRC(
    spotifyTracks.map((track) => track.isrc),
    tidalToken
  );

  addTracksToLikedSongs(tidalTrackIDs, tidalToken);
}

async function migratePlaylists(
  spotifyToken: string,
  tidalToken: string
): Promise<unknown> {
  const [spotifyPlaylists, spotifyErrors] = await getUserPlaylists(
    spotifyToken
  );
  return await createPlaylistsFromSpotifyPlaylists(
    spotifyPlaylists,
    tidalToken
  );
}
