import {
  TOKEN_COOKIE_KEY as SPOTIFY_TOKEN_COOKIE_KEY,
  getLikedSongs,
  getSavedAlbums,
  getUserPlaylists
} from "@/controller/spotifyController";
import {
  TOKEN_COOKIE_KEY as TIDAL_TOKEN_COOKIE_KEY,
  addTracksToLikedSongs,
  createPlaylistsFromSpotifyPlaylists,
  getTracksFromSpotifyTracks
} from "@/controller/tidalController";
import type { SpotifyAPIAlbumItem, SpotifyTrack } from "@/types/spotify";
import type { TidalAPIError, TidalTrack } from "@/types/tidal";
import ProgressHandler from "@/util/progressHandler";
import { type Request, type Response } from "express";

type MigrationOption = Record<string, boolean>;

const progressHandler = new ProgressHandler();

export async function test(req: Request, res: Response): Promise<void> {
  const uuid = progressHandler.addProgressBar([
    "Step 1: Initializing migration",
    "Step 2: Migrating data",
    "Step 3: Finalizing migration"
  ]);

  res.status(200).json({ uuid });
}

export async function migrate(req: Request, res: Response): Promise<void> {
  const { options }: { options: MigrationOption } = req.body;

  const spotifyToken = req.cookies[SPOTIFY_TOKEN_COOKIE_KEY];
  const tidalToken = req.cookies[TIDAL_TOKEN_COOKIE_KEY];

  try {
    if (options.albums) {
      res.status(400).send("Transferring liked albums is not supported yet.");
      return;
    }
    if (options.artists) {
      res.status(400).send("Transferring liked artists is not supported yet.");
      return;
    }

    const uuid = progressHandler.addProgressBar(
      Object.keys(options).filter((key) => options[key])
    );

    // Early response: Send the client a unique identifier for the migration process
    res.status(202).json({ message: "Migration started", uuid });
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }

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
}

export async function progress(req: Request, res: Response): Promise<void> {
  // Set headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  let { uuid } = req.query;

  if (!uuid) {
    res.status(400).json({ message: "UUID is required" });
    return;
  }

  uuid = uuid.toString();

  const progressBar = progressHandler.getProgressBar(uuid);

  if (!progressBar) {
    res.status(404).json({ message: "Progress bar not found" });
    return;
  }

  const sendProgress = () => {
    if (progressBar.isComplete()) {
      res.write(`Complete\n\n`);
      clearInterval(intervalId);
      progressHandler.removeProgressBar(uuid);
      res.end();
      return;
    }

    const current = progressBar.getCurrent();
    res.write(`data: ${JSON.stringify(current)}\n\n`);
  };

  const intervalId = setInterval(sendProgress, 1000);
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
