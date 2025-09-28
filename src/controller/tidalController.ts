import type { SpotifyPlaylist } from "@/types/spotify";
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
import { forEachChild } from "typescript";
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

export async function addTrackToLikedTracks(req: Request, res: Response) {
  try {
    const { isrc } = req.body;
    const token = req.cookies[TOKEN_COOKIE_KEY];
    const userID = await getUserID(token);

    if (!userID) {
      res.status(400).send("Could not get user ID");
      return;
    }

    const tracksResponse = await fetch(
      `${API_URL}/tracks?filter[isrc]=${isrc}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (!tracksResponse.ok) {
      handleErrorResult(tracksResponse, res);
      return;
    }

    const trackResult: TidalAPITracks = await tracksResponse.json();

    const trackData = trackResult.data;
    if (!trackData || trackData.length === 0) {
      return res.status(404).send("Track not found");
    }

    const songID = trackData[0].id as string;
    const body = { data: [{ id: songID, type: "tracks" }] };

    const response = await fetch(
      `${API_URL}/userCollections/${userID}/relationships/tracks?countryCode=${COUNTRY_CODE}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          accept: "application/vnd.tidal.v1+json",
          "Content-Type": "application/vnd.tidal.v1+json"
        },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      handleErrorResult(response, res);
      return;
    }

    const data: TidalAPIPostUserTrackRelResponse = await response.json();
    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
}

export async function getLikedPlaylist(req: Request, res: Response) {
  try {
    const token = req.cookies[TOKEN_COOKIE_KEY];
    const userID = await getUserID(token);

    if (!userID) {
      res.status(400).send("Could not get user ID");
      return;
    }

    let nextLink = `${API_URL}/userCollections/${userID}/relationships/tracks`;
    let allTracks: any[] = [];
    let counter = 0;

    while (nextLink) {
      console.log(`Page ${++counter} (link ${nextLink}) ...`);
      const response = await fetch(nextLink, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        handleErrorResult(response, res);
        return;
      }
      const { data, links }: TidalAPIGetUserTrackRelResponse =
        await response.json();

      allTracks = allTracks.concat(data);
      nextLink = links.next ? API_URL + links.next : "";
      await sleep(500); // Sleep to avoid 429
    }
    res.status(200).json(allTracks);
  } catch (err) {
    console.log(err);
    res.status(500).json(err);
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

export async function findTrack(req: Request, res: Response) {
  try {
    const { isrc } = req.query;
    if (!isrc) {
      return res.status(400).json({ message: "ISRC must be given" });
    }

    const token = req.cookies[TOKEN_COOKIE_KEY];
    const response = await fetch(`${API_URL}/tracks?filter[isrc]=${isrc}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      handleErrorResult(response, res);
      return;
    }

    const result: TidalAPITracks = await response.json();
    if (result.data.length === 0) {
      res.status(404).send(`Song with ISRC ${isrc} not found`);
      return;
    }

    res.status(200).json(result.data[0]);
  } catch (err) {
    res.status(500).send(err);
  }
}

export async function getTracksFromISRC(
  isrcs: string[],
  token: string
): Promise<{ success: boolean; result: TidalAPIError | string[] }> {
  let allTracks: TidalAPITrackData[] = [];
  console.log(`Get ${isrcs.length} tracks from Tidal...`);

  let chunkCounter = 0;
  for (let i = 0; i < isrcs.length; i += 20) {
    console.log(`Chunk ${++chunkCounter}...`);
    const chunk = isrcs.slice(i, i + 20);

    const queryString = chunk
      .map((val) => `filter[isrc]=${val.toUpperCase()}`)
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

    allTracks = allTracks.concat(result.data);
    await sleep(500); // Sleep to avoid 429
  }

  // Check if all tracks were found
  isrcs.forEach((isrc) => {
    if (!allTracks.map((track) => track.attributes.isrc).includes(isrc)) {
      console.warn(`Track with ISRC ${isrc} was not found!`);
    }
  });

  return { success: true, result: allTracks.map((track) => track.id) };
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

    const { success, result } = await getTracksFromISRC(
      spotifyPlaylist.tracks.map((track) => track.isrc),
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
