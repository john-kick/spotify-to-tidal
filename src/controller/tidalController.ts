import TidalConnector from "@/connector/tidalConnector";
import type { SpotifyPlaylist, SpotifyTrack } from "@/types/spotify";
import type {
  TidalAPIArtist,
  TidalAPIArtistRel,
  TidalAPIError,
  TidalAPIGetCurrentUserResponse,
  TidalAPIPostPlaylistResponse,
  TidalAPITracks,
  TidalAPIUserPlaylists,
  TidalAPIUserPlaylistsData,
  TidalArtist,
  TidalTrack
} from "@/types/tidal";
import { generateRandomString, generateS256challenge } from "@/util";
import Progress from "@/util/progress";
import ProgressBar from "@/util/progressBar";
import ProgressHandler from "@/util/progressHandler";
import type { Request, Response } from "express";

const CLIENT_ID = process.env.TIDAL_CLIENT_ID;
const CLIENT_SECRET = process.env.TIDAL_CLIENT_SECRET;
const REDIRECT_URI = process.env.TIDAL_REDIRECT_URI;
const COUNTRY_CODE = process.env.COUNTRY_CODE || "DE";
const AUTHORIZATION_ENDPOINT = "https://login.tidal.com/authorize";
const TOKEN_ENDPOINT = "https://auth.tidal.com/v1/oauth2/token";
const CHUNK_SIZE = 20;

const STATE_COOKIE_KEY = "tidal_auth_state";
export const TOKEN_COOKIE_KEY = "tidal_access_token";
const CODE_VERIFIER_KEY = "tidal_code_verifier";

const connector: TidalConnector = new TidalConnector();

const artistsCache: Record<string, TidalArtist> = {};

export function status(req: Request, res: Response): void {
  const token = req.cookies[TOKEN_COOKIE_KEY];
  if (token) {
    res.status(200).json({ authorized: true });
  } else {
    res.status(200).json({ authorized: false });
  }
}

export async function authorize(req: Request, res: Response) {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    return res.status(500).send("Configuration incomplete");
  }

  const scope =
    "collection.read collection.write playlists.read playlists.write";

  const { codeChallenge, codeVerifier } = await generateS256challenge();
  res.cookie(CODE_VERIFIER_KEY, codeVerifier);

  const state = generateRandomString();
  res.cookie(STATE_COOKIE_KEY, state);

  const queryParams = {
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
    state
  };

  const encodedQuery = new URLSearchParams(queryParams).toString();
  res.redirect(`${AUTHORIZATION_ENDPOINT}?${encodedQuery}`);
}

export async function callback(req: Request, res: Response) {
  const { code, state, error, error_description } = req.query;

  if (error) {
    return res
      .status(400)
      .json({ message: `Authorization failed: ${error_description}` });
  }

  if (state !== req.cookies[STATE_COOKIE_KEY]) {
    return res.status(400).json({ message: "State mismatch" });
  }

  if (!code) {
    return res
      .status(400)
      .json({ message: "Code was not delivered with callback" });
  }

  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    return res.status(500).send("Configuration incomplete");
  }

  const codeVerifier = req.cookies[CODE_VERIFIER_KEY];
  if (!codeVerifier) {
    return res.status(500).json({ message: "Could not verify received code" });
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code: code as string,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier
  });

  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return res
        .status(response.status)
        .json({ message: "Could not get access token", details: errorBody });
    }

    const { access_token, expires_in } = await response.json();

    res.cookie(TOKEN_COOKIE_KEY, access_token, {
      httpOnly: true,
      secure: true,
      maxAge: expires_in * 1000
    });

    res.redirect("/auth");
  } catch (err) {
    res.status(500).json({ message: "Token exchange failed", error: err });
  }
}

export async function deleteAllLikedTracks(req: Request, res: Response) {
  const token = req.cookies[TOKEN_COOKIE_KEY];
  if (!token) {
    res.redirect("/auth");
    return;
  }

  const userID = await getUserID(token);

  const progressHandler = ProgressHandler.getInstance();
  const { progress, uuid } = progressHandler.createProgress();

  // Early response: Pass uuid of the progress object to the client
  res.status(202).json({ uuid });

  const tracks = await connector.getPaginated<TidalAPITracks>(
    `/userCollections/${userID}/relationships/tracks`,
    token,
    progress,
    "Fetching liked tracks from Tidal"
  );

  // Delete tracks in chunks of 20
  console.log(`Deleting ${tracks.length} tracks...`);
  progress.progressBar = new ProgressBar(tracks.length);
  progress.text = "Deleting liked tracks from Tidal";

  const chunkSize = 20;
  for (let i = 0; i < tracks.length; i += chunkSize) {
    progress.progressBar.next(chunkSize);
    console.log(`Deleting tracks ${i}-${i + chunkSize}...`);
    const chunk = tracks.slice(i, i + chunkSize);
    const body = {
      data: chunk.map((track) => {
        return { id: track.id, type: "tracks" };
      })
    };
    const deleteResponse = await connector.delete(
      `/userCollections/${userID}/relationships/tracks`,
      token,
      {},
      body,
      "application/vnd.api+json"
    );

    if (!deleteResponse.ok) {
      const deleteResult: TidalAPIError = await deleteResponse.json();
      deleteResult.errors.forEach((error) =>
        console.error(
          `Error while deleting liked songs: (${error.code}) ${error.detail}`
        )
      );
      res
        .status(400)
        .send("Error while deleting liked songs. See console for more details");
    }
  }

  progress.finish();
}

async function getUserID(token: string): Promise<string> {
  const response = await connector.get("/users/me", token);

  if (!response.ok) {
    const errResult: TidalAPIError = await response.json();
    errResult.errors.forEach((error) =>
      console.error(
        `Error while fetching user ID: (${error.code}) ${error.detail}`
      )
    );
    throw new Error(
      "Error while fetching user ID. See server console for more details."
    );
  }

  const result: TidalAPIGetCurrentUserResponse = await response.json();
  return result.data.id;
}

export async function getTracksFromSpotifyTracks(
  spotifyTracks: SpotifyTrack[],
  token: string,
  progress?: Progress
): Promise<{
  foundTracks: TidalTrack[];
  notFoundTracks: SpotifyTrack[];
}> {
  let allTidalTracks: TidalTrack[] = [];
  let notFoundTracks: SpotifyTrack[] = [];
  console.log(`Get ${spotifyTracks.length} tracks from Tidal...`);
  if (progress) {
    progress.text = "Fetching tracks from Tidal";
    const progressBar = new ProgressBar(spotifyTracks.length);
    progress.progressBar = progressBar;
  }

  let chunkCounter = 0;
  const chunkSize = 20;
  for (let i = 0; i < spotifyTracks.length; i += chunkSize) {
    console.log(`Chunk ${++chunkCounter}...`);
    const chunk = spotifyTracks.slice(i, i + chunkSize);

    const isrcs = chunk.map((track) => track.isrc.toUpperCase());
    const response = await connector.get("/tracks", token, {
      "filter[isrc]": isrcs
    });

    if (!response.ok) {
      const errResult: TidalAPIError = await response.json();
      errResult.errors.forEach((error) =>
        console.error(
          `Error while fetching tracks: (${error.code}) ${error.detail}`
        )
      );
      const firstErr = errResult.errors[0];
      throw new Error(
        `${errResult.errors.length} error(s) occurred. First error: (${firstErr.code}) ${firstErr.detail}`
      );
    }

    const result: TidalAPITracks = await response.json();

    // Map the received track data to internal type
    let tracks: TidalTrack[] = [];
    for (const apiTrack of result.data) {
      let artists: (TidalArtist | undefined)[] = [];

      const artistsResponse = await connector.get(
        apiTrack.relationships.artists.links.self,
        token
      );
      const artistsResult = (await artistsResponse.json()) as TidalAPIArtistRel;

      if (!artistsResult.data || artistsResult.data.length === 0) {
        throw new Error(`No artists for Song found: ${apiTrack.id}`);
      }

      for (const artist of artistsResult.data) {
        artists = artists.concat(await getArtistData(artist.id, token));
      }

      const matchedTrack = spotifyTracks.find(
        (sTrack) => sTrack.isrc === apiTrack.attributes.isrc
      );

      if (!matchedTrack) {
        continue;
      }

      const filteredArtists = artists.filter((artist) => artist !== undefined);

      tracks = tracks.concat({
        artists: filteredArtists,
        name: matchedTrack.title,
        id: apiTrack.id,
        isrc: apiTrack.attributes.isrc,
        addedAt: matchedTrack.addedAt
      });
    }

    allTidalTracks = allTidalTracks.concat(tracks);

    if (progress) {
      progress.progressBar!.next(chunkSize);
    }
  }

  console.log("All Tidal Tracks:", allTidalTracks);

  // Check if all tracks were found
  spotifyTracks.forEach((spotifyTrack) => {
    if (
      !allTidalTracks.map((track) => track.isrc).includes(spotifyTrack.isrc)
    ) {
      notFoundTracks.concat(spotifyTrack);
      console.warn(`Track with ISRC ${spotifyTrack.isrc} was not found!`);
    }
  });

  if (progress) {
    progress.text = "Fetching tracks from Tidal (DONE)";

    // Remove the progress bar
    progress.progressBar = undefined;
  }

  return {
    foundTracks: allTidalTracks.sort(
      (trackA, trackB) => trackA.addedAt - trackB.addedAt
    ),
    notFoundTracks
  };
}

export async function addTracksToLikedSongs(
  tracks: TidalTrack[],
  token: string,
  chunked: boolean = false,
  progress?: Progress
): Promise<void> {
  if (progress) {
    progress.text = "Adding liked tracks to Tidal";
    progress.progressBar = new ProgressBar(tracks.length);
  }

  console.log(`Adding ${tracks.length} tracks to liked songs...`);
  const userID = await getUserID(token);

  if (!userID) {
    throw new Error("Could not get user ID");
  }

  let chunkCounter = 0;
  // chunked = false -> reduce chunk size to 1 to synchronize each track separately. This ensures correct ordering.
  const chunkSize = chunked ? CHUNK_SIZE : 1;
  for (let i = 0; i < tracks.length; i += chunkSize) {
    console.log(`Processing chunk ${++chunkCounter}...`);
    // Reverse the chunk
    const chunk = tracks.slice(i, i + chunkSize).reverse();

    const body = {
      data: chunk.map((track) => ({ id: track.id, type: "tracks" }))
    };

    const response = await connector.post(
      `/userCollections/${userID}/relationships/tracks`,
      token,
      {},
      body,
      "application/vnd.api+json"
    );

    if (!response.ok) {
      const errResult: TidalAPIError = await response.json();
      const firstErr = errResult.errors[0];
      throw new Error(
        `${errResult.errors.length} error(s) occurred. First error: (${firstErr.code}) ${firstErr.detail}`
      );
    }

    if (progress) {
      progress.progressBar!.next(chunkSize);
    }
  }

  if (progress) {
    progress.text = "Adding liked tracks to Tidal (DONE)";
    progress.progressBar = undefined;
  }
}

export async function createPlaylistsFromSpotifyPlaylists(
  spotifyPlaylists: SpotifyPlaylist[],
  token: string,
  progress?: Progress
): Promise<
  {
    name: string;
    tracks: TidalTrack[];
    notFoundTracks: SpotifyTrack[];
  }[]
> {
  if (progress) {
    progress.text = "Creating playlists in Tidal";
    progress.progressBar = new ProgressBar(spotifyPlaylists.length);
  }

  let createdPlaylists: {
    name: string;
    tracks: TidalTrack[];
    notFoundTracks: SpotifyTrack[];
  }[] = [];

  for (const spotifyPlaylist of spotifyPlaylists) {
    if (progress) {
      progress.progressBar!.next();
    }
    const playlistID = await createPlaylist(spotifyPlaylist, token);
    if (!playlistID) {
      console.error(`Playlist ${spotifyPlaylist.name} was not created`);
      continue;
    }

    const result = await getTracksFromSpotifyTracks(
      spotifyPlaylist.tracks,
      token
    );

    const { foundTracks, notFoundTracks } = result as {
      foundTracks: TidalTrack[];
      notFoundTracks: SpotifyTrack[];
    };

    console.log(`Searching IDs of ${foundTracks.length} tracks...`);
    const playlistData = foundTracks.map((track) => ({
      id: track.id,
      type: "tracks"
    }));

    console.log(
      `Filling playlist ${spotifyPlaylist.name} with ${playlistData.length} tracks...`
    );

    const chunkSize = 20;
    let chunkCounter = 0;
    for (let i = 0; i < foundTracks.length; i += chunkSize) {
      const chunk = playlistData.slice(i, i + chunkSize);
      console.log(`Chunk ${++chunkCounter}...`);
      const body = { data: chunk };
      const response = await connector.post(
        `/playlists/${playlistID}/relationships/items`,
        token,
        {},
        body,
        "application/vnd.api+json"
      );

      if (!response.ok) {
        const errResult: TidalAPIError = await response.json();
        errResult.errors.forEach((error) =>
          console.error(
            `Error while posting tracks to playlist ${spotifyPlaylist.name}: (${error.code}) ${error.detail}`
          )
        );
        continue;
      }
    }

    createdPlaylists.push({
      name: spotifyPlaylist.name,
      tracks: foundTracks,
      notFoundTracks
    });
  }

  if (progress) {
    progress.text = "Creating playlists in Tidal (DONE)";

    // Remove the progress bar
    progress.progressBar = undefined;
  }

  return createdPlaylists;
}

export async function createPlaylist(
  playlist: SpotifyPlaylist,
  token: string
): Promise<string | undefined> {
  console.log(`Creating playlist ${playlist.name}...`);
  const body = {
    data: {
      attributes: {
        accessType: playlist.public ? "PUBLIC" : "UNLISTED",
        description: playlist.description,
        name: playlist.name
      },
      type: "playlists"
    }
  };

  const response = await connector.post(
    "/playlists",
    token,
    { countryCode: COUNTRY_CODE },
    body,
    "application/vnd.api+json"
  );

  if (!response.ok) {
    const errResult: TidalAPIError = await response.json();
    errResult.errors.forEach((error) =>
      console.error(
        `Error while creating playlist ${playlist.name}: (${error.code}) ${error.detail}`
      )
    );
    return;
  }

  const { data }: TidalAPIPostPlaylistResponse = await response.json();
  if (!data.id) {
    console.error("No playlist ID returned");
    return;
  }
  console.log(`Playlist created with ID ${data.id}`);
  return data.id;
}

async function getAllPlaylists(
  token: string,
  progress?: Progress
): Promise<TidalAPIUserPlaylistsData[]> {
  const userID = await getUserID(token);
  const path = `/playlists?countryCode=${COUNTRY_CODE}&filter[owners.id]=${userID}`;
  return await connector.getPaginated<TidalAPIUserPlaylists>(
    path,
    token,
    progress,
    "Fetching user playlists from Tidal"
  );
}

export async function removeAllPlaylists(req: Request, res: Response) {
  const token = req.cookies[TOKEN_COOKIE_KEY];

  if (!token) {
    res.redirect("/auth");
    return;
  }

  const progressHandler = ProgressHandler.getInstance();
  const { progress, uuid } = progressHandler.createProgress();

  res.status(202).json({ uuid });

  const playlists = await getAllPlaylists(token, progress);

  console.log(`Deleting ${playlists.length} playlists...`);
  progress.text = "Deleting playlists";
  progress.progressBar = new ProgressBar(playlists.length);
  for (const [index, playlist] of playlists.entries()) {
    console.log(`Playlist ${index + 1}...`);
    progress.progressBar.next();
    const deleteResponse = await connector.delete(
      `/playlists/${playlist.id}`,
      token
    );

    if (!deleteResponse.ok) {
      console.log(deleteResponse);
      const errResult: TidalAPIError = await deleteResponse.json();
      errResult.errors.forEach((error) =>
        console.error(
          `Could not remove playlist ${playlist.name}: (${error.code}) ${error.detail}`
        )
      );
    }
  }

  progress.text = "Deleting playlists (DONE)";
  progress.progressBar = undefined;
  progress.finish();
}

export async function getArtistData(
  artistID: string,
  token: string
): Promise<TidalArtist | undefined> {
  if (!artistsCache[artistID]) {
    const response = await connector.get(`/artists/${artistID}`, token);
    if (response.status === 404) {
      return undefined;
    }
    const artistData = (await response.json()) as TidalAPIArtist;
    artistsCache[artistID] = {
      name: artistData.data.attributes.name
    };
  }
  return artistsCache[artistID];
}
