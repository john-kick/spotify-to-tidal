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
import type { TidalTrack } from "@/types/tidal";
import type Progress from "@/util/progress";
import ProgressHandler from "@/util/progressHandler";
import { type Request, type Response } from "express";

type MigrationOption = Record<string, boolean>;

type LikedSongsMigrationResult = {
  fetchedFromSpotify: string[];
  savedInTidal: TidalTrack[];
  notFoundInTidal: SpotifyTrack[];
};
export type PlaylistsMigrationResult = {
  playlists: {
    name: string;
    tracks: TidalTrack[];
    notFoundTracks: SpotifyTrack[];
  }[];
};
type MigrationResult = {
  likedSongs?: LikedSongsMigrationResult;
  playlistsMigrated?: PlaylistsMigrationResult;
  albumsMigrated?: [];
  artistsMigrated?: [];
};

const progressHandler = ProgressHandler.getInstance();
const results: Record<string, MigrationResult> = {};

export async function migrate(req: Request, res: Response): Promise<void> {
  const { options }: { options: MigrationOption } = req.body;

  const spotifyToken = req.cookies[SPOTIFY_TOKEN_COOKIE_KEY];
  const tidalToken = req.cookies[TIDAL_TOKEN_COOKIE_KEY];

  const { progress, uuid } = progressHandler.createProgress();

  if (!progress) {
    res.status(500).json({ message: "Could not create progress object" });
    return;
  }

  try {
    if (options.albums) {
      res.status(400).send("Transferring liked albums is not supported yet.");
      return;
    }
    if (options.artists) {
      res.status(400).send("Transferring liked artists is not supported yet.");
      return;
    }

    progress.text = "Starting migration";

    // Early response: Send the client a unique identifier for the migration process
    res.status(202).json({ message: "Migration started", uuid });
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
    return;
  }

  const migrationResult: MigrationResult = {
    likedSongs: undefined,
    playlistsMigrated: undefined,
    albumsMigrated: undefined,
    artistsMigrated: undefined
  };

  if (options.tracks) {
    try {
      migrationResult.likedSongs = await migrateLikedSongs(
        spotifyToken,
        tidalToken,
        options.chunking,
        progress
      );
    } catch (err) {
      if (err instanceof Error) {
        console.error(err.message);
      }
      console.error("Something went wrong!");
    }
  }

  if (options.playlists) {
    migrationResult.playlistsMigrated = await migratePlaylists(
      spotifyToken,
      tidalToken,
      options["followed-playlists"],
      progress
    );
  }

  console.log("Migration result:", migrationResult);

  results[uuid] = migrationResult;
  progress.finish();
}

export async function result(req: Request, res: Response): Promise<void> {
  try {
    const { uuid } = req.query;
    if (!uuid) {
      res.status(400).send("'uuid' parameter is required.");
      return;
    }
    const result = results[uuid.toString()];
    if (!result) {
      res.status(404).send(`No result for uuid ${uuid} found.`);
      return;
    }
    res.status(200).json(result);
    // delete results[uuid.toString()];
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
    return;
  }
}

async function migrateLikedSongs(
  spotifyToken: string,
  tidalToken: string,
  chunked: boolean,
  progress: Progress
): Promise<LikedSongsMigrationResult> {
  const spotifyTracks: SpotifyTrack[] = (
    await getLikedSongs(spotifyToken, progress)
  ).reverse();

  const result = await getTracksFromSpotifyTracks(
    spotifyTracks,
    tidalToken,
    progress
  );

  const { foundTracks, notFoundTracks } = result as {
    foundTracks: TidalTrack[];
    notFoundTracks: SpotifyTrack[];
  };

  await addTracksToLikedSongs(foundTracks, tidalToken, chunked, progress);

  return {
    fetchedFromSpotify: spotifyTracks.map((track) => {
      return (
        track.title +
        " - " +
        track.artists.reduce(
          (prev, curr, index) =>
            index === 0 ? curr.name : prev + ", " + curr.name,
          ""
        )
      );
    }),
    notFoundInTidal: notFoundTracks,
    savedInTidal: foundTracks
  };
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
  includeFollowedPlaylists: boolean,
  progress: Progress
): Promise<PlaylistsMigrationResult> {
  const spotifyPlaylists = await getUserPlaylists(
    spotifyToken,
    includeFollowedPlaylists,
    progress
  );
  const result = await createPlaylistsFromSpotifyPlaylists(
    spotifyPlaylists,
    tidalToken,
    progress
  );

  return {
    playlists: result
  };
}
