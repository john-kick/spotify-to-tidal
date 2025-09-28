import type { SpotifyPlaylist, SpotifyTrack } from "@/types/spotify";
import type {
  TidalAPIError,
  TidalAPIGetCurrentUserResponse,
  TidalAPIGetUserTrackRelResponse,
  TidalAPIPostPlaylistResponse,
  TidalAPIPostUserTrackRelResponse,
  TidalAPITrackData,
  TidalAPITracks,
  TidalAPIUserPlaylists,
  TidalAPIUserPlaylistsData
} from "@/types/tidal";
import { generateRandomString, generateS256challenge } from "@/util";
import { sleep } from "bun";
import type { Request, Response } from "express";
type FetchResponse = globalThis.Response;

const CLIENT_ID = process.env.TIDAL_CLIENT_ID;
const CLIENT_SECRET = process.env.TIDAL_CLIENT_SECRET;
const REDIRECT_URI = process.env.TIDAL_REDIRECT_URI;
const COUNTRY_CODE = process.env.COUNTRY_CODE || "DE";
const AUTHORIZATION_ENDPOINT = "https://login.tidal.com/authorize";
const TOKEN_ENDPOINT = "https://auth.tidal.com/v1/oauth2/token";
const API_URL = "https://openapi.tidal.com/v2";
const STATE_COOKIE_KEY = "tidal_auth_state";
export const TOKEN_COOKIE_KEY = "tidal_access_token";
const CODE_VERIFIER_KEY = "tidal_code_verifier";

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

    res.redirect("/");
  } catch (err) {
    res.status(500).json({ message: "Token exchange failed", error: err });
  }
}

export async function deleteAllLikedTracks(req: Request, res: Response) {
  try {
    const token = req.cookies[TOKEN_COOKIE_KEY];
    const userID = await getUserID(token);

    let tracks: TidalAPITrackData[] = [];
    let counter = 0;
    let next:
      | string
      | undefined = `${API_URL}/userCollections/${userID}/relationships/tracks`;
    console.log("Getting liked tracks from Tidal...");
    while (next) {
      console.log(`Page ${++counter}...`);
      const response = await fetch(next, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        console.log(response);
        const result: TidalAPIError = await response.json();
        result.errors.forEach((error) =>
          console.error(
            `Error while deleting liked songs: (${error.code}) ${error.detail}`
          )
        );
        res
          .status(400)
          .send(
            "Error while deleting liked songs. See console for more details"
          );
        return;
      }

      const result: TidalAPITracks = await response.json();
      tracks = tracks.concat(result.data);
      next = result.links.next ? API_URL + result.links.next : undefined;
      await sleep(500);
    }

    // Delete tracks in chunks of 20
    console.log(`Deleting ${tracks.length} tracks...`);

    for (let i = 0; i < tracks.length; i += 20) {
      console.log(`Deleting tracks ${i}-${i + 20}...`);
      const chunk = tracks.slice(i, i + 20);
      const body = {
        data: chunk.map((track) => {
          return { id: track.id, type: "tracks" };
        })
      };
      const deleteResponse = await fetch(
        `${API_URL}/userCollections/${userID}/relationships/tracks`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/vnd.api+json"
          },
          body: JSON.stringify(body)
        }
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
          .send(
            "Error while deleting liked songs. See console for more details"
          );
      }
      await sleep(500);
    }
    res.status(200).send("OK");
  } catch (err) {
    console.error(err);
    res.status(500).send(err);
  }
}

async function getUserID(token: string): Promise<string | null> {
  const response = await fetch(`${API_URL}/users/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    const errResult: TidalAPIError = await response.json();
    errResult.errors.forEach((error) =>
      console.error(
        `Error while fetching user ID: (${error.code}) ${error.detail}`
      )
    );
    return null;
  }

  const result: TidalAPIGetCurrentUserResponse = await response.json();
  return result.data.id;
}

export async function getTracksFromSpotifyTracks(
  spotifyTracks: SpotifyTrack[],
  token: string
): Promise<{ success: boolean; result: TidalAPIError | string[] }> {
  let allTidalTracks: TidalAPITrackData[] = [];
  console.log(`Get ${spotifyTracks.length} tracks from Tidal...`);

  let chunkCounter = 0;
  for (let i = 0; i < spotifyTracks.length; i += 20) {
    console.log(`Chunk ${++chunkCounter}...`);
    const chunk = spotifyTracks.slice(i, i + 20);

    const queryString = chunk
      .map((track) => `filter[isrc]=${track.isrc.toUpperCase()}`)
      .join("&");
    const response = await fetch(`${API_URL}/tracks?${queryString}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      const errResult: TidalAPIError = await response.json();
      errResult.errors.forEach((error) =>
        console.error(
          `Error while fetching tracks: (${error.code}) ${error.detail}`
        )
      );
      return { success: false, result: errResult };
    }

    const result: TidalAPITracks = await response.json();

    allTidalTracks = allTidalTracks.concat(result.data);
    await sleep(500); // Sleep to avoid 429
  }

  // Check if all tracks were found
  spotifyTracks.forEach((spotifyTrack) => {
    if (
      !allTidalTracks
        .map((tidalTrack) => tidalTrack.attributes.isrc)
        .includes(spotifyTrack.isrc)
    ) {
      console.warn(`Track with ISRC ${spotifyTrack} was not found!`);
    }
  });

  return { success: true, result: allTidalTracks.map((track) => track.id) };
}

export async function addTracksToLikedSongs(
  trackIDs: string[],
  token: string
): Promise<{ success: boolean; errorResult?: TidalAPIError }> {
  console.log(`Adding ${trackIDs.length} tracks to liked songs...`);
  const userID = await getUserID(token);

  if (!userID) {
    throw new Error("Could not get user ID");
  }

  let chunkCounter = 0;
  for (let i = 0; i < trackIDs.length; i += 20) {
    console.log(`Processing chunk ${++chunkCounter}...`);
    const chunk = trackIDs.slice(i, i + 20);

    const body = {
      data: chunk.map((trackID) => ({ id: trackID, type: "tracks" }))
    };

    const response = await fetch(
      `${API_URL}/userCollections/${userID}/relationships/tracks`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/vnd.api+json"
        },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      const errResult: TidalAPIError = await response.json();
      return { success: false, errorResult: errResult };
    }
    await sleep(200);
  }
  return { success: true };
}

export async function createPlaylistsFromSpotifyPlaylists(
  spotifyPlaylists: SpotifyPlaylist[],
  token: string
): Promise<void> {
  for (const spotifyPlaylist of spotifyPlaylists) {
    const playlistID = await createPlaylist(spotifyPlaylist, token);
    if (!playlistID) {
      console.error(`Playlist ${spotifyPlaylist.name} was not created`);
      continue;
    }

    const { success, result } = await getTracksFromSpotifyTracks(
      spotifyPlaylist.tracks,
      token
    );

    if (!success) {
      const errResult = result as TidalAPIError;
      errResult.errors.forEach((error) =>
        console.error(
          `Error while fetching tracks: (${error.code}) ${error.detail}`
        )
      );
      continue;
    }

    const trackIDs = result as string[];
    console.log(`Searching IDs of ${trackIDs.length} tracks...`);
    const playlistData = trackIDs.map((trackID) => ({
      id: trackID,
      type: "tracks"
    }));

    console.log(
      `Filling playlist ${spotifyPlaylist.name} with ${playlistData.length} tracks...`
    );

    const chunkSize = 20;
    let chunkCounter = 0;
    for (let i = 0; i < trackIDs.length; i += chunkSize) {
      const chunk = playlistData.slice(i, i + chunkSize);
      console.log(`Chunk ${++chunkCounter}...`);
      const body = { data: chunk };
      const response = await fetch(
        `${API_URL}/playlists/${playlistID}/relationships/items`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/vnd.api+json"
          },
          body: JSON.stringify(body)
        }
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
      await sleep(200);
    }
  }
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

  const response = await fetch(
    `${API_URL}/playlists?countryCode=${COUNTRY_CODE}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/vnd.api+json"
      },
      body: JSON.stringify(body)
    }
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

async function handleErrorResult(
  fetchResponse: FetchResponse,
  expressResponse: Response
): Promise<void> {
  const errResult: TidalAPIError = await fetchResponse.json();
  expressResponse.status(fetchResponse.status).send(errResult.errors);
}

async function getAllPlaylists(
  token: string
): Promise<TidalAPIUserPlaylistsData[]> {
  const userID = await getUserID(token);
  let userPlaylistsResults: TidalAPIUserPlaylistsData[] = [];
  let next:
    | string
    | undefined = `${API_URL}/playlists?countryCode=${COUNTRY_CODE}&filter[owners.id]=${userID}`;

  while (next) {
    const userPlaylistsResponse = await fetch(next, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!userPlaylistsResponse.ok) {
      const errResult: TidalAPIError = await userPlaylistsResponse.json();
      errResult.errors.forEach((error) =>
        console.error(
          `Could not get user playlists: (${error.code}) ${error.detail}`
        )
      );
      throw new Error(
        "Errors while getting playlists from Spotify. Please check the console for errors"
      );
    }

    const userPlaylistsResult: TidalAPIUserPlaylists =
      await userPlaylistsResponse.json();
    userPlaylistsResults = userPlaylistsResults.concat(
      userPlaylistsResult.data
    );
    next = userPlaylistsResult.links.next
      ? API_URL + userPlaylistsResult.links.next
      : undefined;
  }

  return userPlaylistsResults;
}

export async function removeAllPlaylists(req: Request, res: Response) {
  const token = req.cookies[TOKEN_COOKIE_KEY];
  const playlists = await getAllPlaylists(token);

  console.log(`Deleting ${playlists.length} playlists...`);
  for (const [index, playlist] of playlists.entries()) {
    console.log(`Playlist ${index + 1}...`);
    const deleteResponse = await fetch(`${API_URL}/playlists/${playlist.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!deleteResponse.ok) {
      console.log(deleteResponse);
      const errResult: TidalAPIError = await deleteResponse.json();
      errResult.errors.forEach((error) =>
        console.error(
          `Could not remove playlist ${playlist.name}: (${error.code}) ${error.detail}`
        )
      );
    }

    await sleep(500); // Avoid 429
  }

  res.status(200).send("OK");
}
