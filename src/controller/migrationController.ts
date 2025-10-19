import {
  TOKEN_COOKIE_KEY as SPOTIFY_TOKEN_COOKIE_KEY,
  getLikedSongs,
  getSavedAlbums,
  getUserPlaylists,
} from "@/controller/spotifyController";
import {
  TOKEN_COOKIE_KEY as TIDAL_TOKEN_COOKIE_KEY,
  addTracksToLikedSongs,
  createPlaylistsFromSpotifyPlaylists,
  getTracksFromSpotifyTracks,
} from "@/controller/tidalController";
import type { SpotifyAPIAlbumItem, SpotifyTrack } from "@/types/spotify";
import type { TidalAPIError, TidalTrack } from "@/types/tidal";
import { type Request, type Response } from "express";

type MigrationOption = Record<string, boolean>;

export default async function migrate(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { options }: { options: MigrationOption } = req.body;

    if (options.albums) {
      res.status(400).send("Transferring liked albums is not supported yet.");
      return;
    }
    if (options.artists) {
      res.status(400).send("Transferring liked artists is not supported yet.");
      return;
    }

    const spotifyToken = req.cookies[SPOTIFY_TOKEN_COOKIE_KEY];
    const tidalToken = req.cookies[TIDAL_TOKEN_COOKIE_KEY];

    if (options.tracks) {
      const errResult: TidalAPIError | undefined = await migrateLikedSongs(
        spotifyToken,
        tidalToken,
        options.chunking
      );
      if (errResult) {
        errResult.errors.forEach((error) =>
          console.error(
            `Error while migrating liked songs: (${error.code}) ${error.detail}`
          )
        );
      }
    }
    if (options.playlists) {
      await migratePlaylists(
        spotifyToken,
        tidalToken,
        options["followed-playlists"]
      );
    }
    res.status(200).json({ message: "Success" });
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
}

async function migrateLikedSongs(
  spotifyToken: string,
  tidalToken: string,
  chunked: boolean
): Promise<TidalAPIError | undefined> {
  const spotifyTracks: SpotifyTrack[] = (
    await getLikedSongs(spotifyToken)
  ).reverse();

  const { success, result } = await getTracksFromSpotifyTracks(
    spotifyTracks,
    tidalToken
  );

  if (!success) {
    const errResult = result as TidalAPIError;
    return errResult;
  }

  const tidalTracks = result as TidalTrack[];
  const { success: addTracksSuccess, errorResult } =
    await addTracksToLikedSongs(tidalTracks, tidalToken, chunked);
  if (!addTracksSuccess) {
    if (!errorResult) {
      console.error("Something went wrong!");
      return undefined;
    }
    return errorResult;
  }
}

async function migrateLikedAlbums(
  spotifyToken: string,
  tidalToken: string
): Promise<void> {
  const spotifyAlbums: SpotifyAPIAlbumItem[] = await getSavedAlbums(
    spotifyToken
  );
}

async function migratePlaylists(
  spotifyToken: string,
  tidalToken: string,
  includeFollowedPlaylists: boolean
): Promise<void> {
  const spotifyPlaylists = await getUserPlaylists(
    spotifyToken,
    includeFollowedPlaylists
  );
  await createPlaylistsFromSpotifyPlaylists(spotifyPlaylists, tidalToken);
}
