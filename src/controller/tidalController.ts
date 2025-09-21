import type { SpotifyPlaylist } from "@/types/spotify";
import { generateRandomString, generateS256challenge } from "@/util";
import { sleep } from "bun";
import type { Request, Response } from "express";

export type TidalAPIError = {
  errors: [
    {
      detail: string;
      code: number;
    }
  ];
};

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

    const songResponse = await fetch(`${API_URL}/tracks?filter[isrc]=${isrc}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const songResult = await songResponse.json();

    if (!songResponse.ok) {
      return res.status(songResponse.status).send(songResponse.statusText);
    }

    const songData = songResult.data;
    if (!songData || songData.length === 0) {
      return res.status(404).send("Track not found");
    }

    const songID = songData[0].id as string;
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

    const data = await response.json();
    if (data.errors) {
      return res.status(400).json(data.errors);
    }
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

    let nextLink = `${API_URL}/userCollections/${userID}/relationships/tracks`;
    let allTracks: unknown[] = [];
    let counter = 0;

    while (nextLink) {
      console.log(`Page ${++counter} (link ${nextLink}) ...`);
      const response = await fetch(nextLink, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await sleep(500); // Sleep to avoid 429
      const { data, links } = await response.json();

      allTracks = allTracks.concat(data);
      nextLink = links?.next ? API_URL + links.next : "";
    }
    res.status(200).json(allTracks);
  } catch (err) {
    console.log(err);
    res.status(500).json(err);
  }
}

async function getUserID(token: string): Promise<number> {
  const response = await fetch(`${API_URL}/users/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const result = await response.json();
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
    const result = await response.json();

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json(err);
  }
}

export async function getTracksFromISRC(
  isrc: string[],
  token: string
): Promise<string[]> {
  let allTrackIDs: string[] = [];
  console.log(`Get ${isrc.length} tracks from Tidal...`);

  let chunkCounter = 0;
  for (let i = 0; i < isrc.length; i += 20) {
    console.log(`Chunk ${++chunkCounter}...`);
    const chunk = isrc.slice(i, i + 20);

    const queryString = chunk
      .map((val) => `filter[isrc]=${val.toUpperCase()}`)
      .join("&");
    const response = await fetch(`${API_URL}/tracks?${queryString}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const result = await response.json();
    allTrackIDs = allTrackIDs.concat(
      (result.data || []).map((track: { id: string }) => track.id)
    );
    await sleep(500); // Sleep to avoid 429
  }

  return allTrackIDs;
}

export async function addTracksToLikedSongs(
  trackIDs: string[],
  token: string
): Promise<void> {
  console.log(`Adding ${trackIDs.length} tracks to liked songs...`);
  const userID = await getUserID(token);

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
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      }
    );

    const { errors }: { errors?: TidalAPIError } = await response.json();
    if (errors) {
      errors.errors.forEach((error) =>
        console.error(`HTTP error ${error.code}: ${error.detail}`)
      );
      continue;
    }

    console.log("OK");
    await sleep(200);
  }
}

export async function createPlaylistsFromSpotifyPlaylists(
  spotifyPlaylists: SpotifyPlaylist[],
  token: string
): Promise<unknown[]> {
  const results: unknown[] = [];
  for (const spotifyPlaylist of spotifyPlaylists) {
    const playlistID = await createPlaylist(spotifyPlaylist, token);
    if (!playlistID) {
      results.push({ error: "Failed to create playlist" });
      continue;
    }

    const trackIDs = await getTracksFromISRC(
      spotifyPlaylist.tracks.map((track) => track.isrc),
      token
    );

    console.log(`Searching IDs of ${trackIDs.length} tracks...`);
    const playlistData = trackIDs.map((trackID) => ({
      id: trackID,
      type: "tracks"
    }));

    const body = { data: playlistData };

    console.log(`Filling playlist with ${playlistData.length} tracks...`);
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

    const { data, errors }: { data: unknown; errors?: TidalAPIError } =
      await response.json();
    if (errors) {
      errors.errors.forEach((error) =>
        console.error(`HTTP error ${error.code}: ${error.detail}`)
      );
      results.push({ error: errors });
    } else {
      results.push(data);
    }
    console.log("DONE");
    await sleep(200);
  }

  return results;
}

export async function createPlaylist(
  playlist: SpotifyPlaylist,
  token: string
): Promise<string | null> {
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

  const { data, errors }: { data?: { id: string }; errors?: TidalAPIError } =
    await response.json();
  if (errors) {
    errors.errors.forEach((error) =>
      console.error(`HTTP error ${error.code}: ${error.detail}`)
    );
    return null;
  }
  if (!data?.id) {
    console.error("No playlist ID returned");
    return null;
  }
  console.log(`Playlist created with ID ${data.id}`);
  return data.id;
}
