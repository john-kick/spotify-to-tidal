import {
  TOKEN_COOKIE_KEY as SPOTIFY_TOKEN_COOKIE_KEY,
  getLikedSongs,
  getUserPlaylists
} from "@/controller/spotifyController";
import {
  TOKEN_COOKIE_KEY as TIDAL_TOKEN_COOKIE_KEY,
  addTracksToLikedSongs,
  createPlaylist,
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
    await migrateLikedSongs(spotifyToken, tidalToken);
    const [spotifyPlaylists, spotifyErrors]: [
      spotifyPlaylists: SpotifyPlaylist[],
      spotifyErrors: SpotifyError[]
    ] = await migratePlaylists(spotifyToken, tidalToken);
    if (spotifyErrors.length > 0) {
      res.status(500).json({
        message: "Playlists migrated, but errors occurred",
        playlists: spotifyPlaylists,
        errors: spotifyErrors
      });
      return;
    }
    res.status(200).json(spotifyPlaylists);
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
): Promise<[SpotifyPlaylist[], SpotifyError[]]> {
  return await getUserPlaylists(spotifyToken);
}

export async function testPlaylistCreation(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const playlist: SpotifyPlaylist = {
      description: "Test playlist created with Tidal API",
      name: "Test playlist",
      public: false,
      tracks: [],
      images: []
    };
    const token = req.cookies[TIDAL_TOKEN_COOKIE_KEY];
    await createPlaylist(playlist, token);
  } catch (err) {
    res.status(500).send(err);
  }
}
