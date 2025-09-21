import type {
  SpotifyTrack,
  SpotifyError as SpotifyAPIError,
  SpotifyPlaylist,
  SpotifyAPIUserPlaylistsObject,
  SpotifyAPIPlaylistItemsObject,
  SpotifyPlaylistTrack
} from "@/types/spotify";
import { generateRandomString } from "@/util";
import { type Request, type Response } from "express";

const AUTHORIZE_ENDPOINT = "https://accounts.spotify.com/authorize";
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const API_URL = "https://api.spotify.com/v1";
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const STATE_COOKIE_KEY = "spotify_auth_state";
export const TOKEN_COOKIE_KEY = "spotify_access_token";

export function authorize(_req: Request, res: Response): void {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    res.status(500).send("Configuration incomplete");
  }

  const state = generateRandomString();
  res.cookie(STATE_COOKIE_KEY, state);

  const queryParams = {
    response_type: "code",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: "user-read-private user-read-email user-library-read",
    redirect_uri: REDIRECT_URI,
    state
  };

  const queryString = Object.entries(queryParams)
    .map(([key, value]) => key + "=" + value)
    .join("&");

  res.redirect(`${AUTHORIZE_ENDPOINT}?${queryString}`);
}

export async function callback(req: Request, res: Response) {
  const { code, error, state } = req.query;

  // Check parameters
  if (error) {
    return res
      .status(400)
      .json({ message: `Authorization failed. Reason: ${error}` });
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

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: code as string,
    redirect_uri: REDIRECT_URI
  });

  const encodedClientCreds = Buffer.from(
    `${CLIENT_ID}:${CLIENT_SECRET}`
  ).toString("base64");

  const headers = {
    Authorization: `Basic ${encodedClientCreds}`,
    "Content-Type": "application/x-www-form-urlencoded"
  };

  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers,
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
    res.status(500).json({ message: "Token request failed", error: err });
  }
}

export async function getLikedSongs(token: string): Promise<SpotifyTrack[]> {
  const limit = 50; // Spotify max limit per request
  let offset = 0;
  let allTracks: SpotifyTrack[] = [];
  let hasNext = true;

  console.log("Fetching liked songs from Spotify...");

  while (hasNext) {
    console.log(`Page ${offset / limit + 1}...`);
    const queryString = `limit=${limit}&offset=${offset}`;
    const response = await fetch(`${API_URL}/me/tracks?${queryString}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error("Failed to fetch liked songs: " + errorBody);
    }

    const data = await response.json();
    const items = data.items || [];

    // Map to SpotifySong interface
    const tracks: SpotifyTrack[] = items.map((item: any) => ({
      id: item.track.id,
      title: item.track.name,
      artist: item.track.artists.map((a: any) => a.name).join(", "),
      isrc: item.track.external_ids.isrc
    }));

    allTracks = allTracks.concat(tracks);

    hasNext = !!data.next;
    offset += limit;
  }

  return allTracks;
}

async function getUserID(token: string): Promise<string> {
  const response = await fetch(`${API_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const result = await response.json();

  if (result.error) {
    const { error } = result.error as SpotifyAPIError;
    throw new Error(
      `HTTP error ${error.status} while getting user ID: ${error.message}`
    );
  }

  return result.id;
}

export async function getUserPlaylists(
  token: string
): Promise<[SpotifyPlaylist[], SpotifyAPIError[]]> {
  console.log("Getting playlists of current user from Spotify...");
  let playlists: SpotifyPlaylist[] = [];
  const errors: SpotifyAPIError[] = [];
  let next = `${API_URL}/me/playlists`;
  let playlistCounter = 0;

  while (next) {
    console.log(`Playlist chunk ${++playlistCounter}...`);
    const response = await fetch(next, {
      headers: { Authorization: `Bearer ${token}` }
    });

    let chunk = await response.json();

    if (chunk.error) {
      const error = chunk as SpotifyAPIError;
      errors.push(error);
      continue;
    }

    const chunkObject = chunk as SpotifyAPIUserPlaylistsObject;

    // Map response object to playlist list
    const playlistObjects: SpotifyPlaylist[] = await Promise.all(
      chunkObject.items.map(async (item): Promise<SpotifyPlaylist> => {
        let allTracks: SpotifyPlaylistTrack[] = [];
        let next: string | null = item.tracks.href;
        let trackCounter = 0;

        while (next) {
          console.log(`    Track chunk ${++trackCounter}...`);
          const playlistTracksResponse = await fetch(next, {
            headers: { Authorization: `Bearer ${token}` }
          });

          const result = await playlistTracksResponse.json();

          if (result.error) {
            const error = result.error as SpotifyAPIError;
            errors.push(error);
            continue;
          }

          const tracks = result as SpotifyAPIPlaylistItemsObject;
          allTracks = allTracks.concat(
            tracks.items.map((item) => {
              return {
                isrc: item.track.external_ids.isrc,
                addedAt: item.added_at
              };
            })
          );
          next = tracks.next;
        }

        return {
          description: item.description,
          images: item.images,
          name: item.name,
          tracks: allTracks,
          public: item.public
        } as SpotifyPlaylist;
      })
    );
    playlists = playlists.concat(playlistObjects);

    next = chunk.next;
  }

  return [playlists, errors];
}
