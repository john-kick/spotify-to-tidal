import type {
  SpotifyAPIAlbumItem,
  SpotifyAPIAlbums,
  SpotifyAPICurrentUser,
  SpotifyAPIError,
  SpotifyAPIPlaylistItems,
  SpotifyAPIUserPlaylists,
  SpotifyAPIUserTracksResponse,
  SpotifyPlaylist,
  SpotifyPlaylistTrack,
  SpotifyTrack
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
    return;
  }

  const state = generateRandomString();
  res.cookie(STATE_COOKIE_KEY, state);

  const queryParams = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope:
      "user-read-private user-read-email user-library-read playlist-read-private",
    redirect_uri: REDIRECT_URI,
    state
  }).toString();

  res.redirect(`${AUTHORIZE_ENDPOINT}?${queryParams}`);
}

export async function callback(req: Request, res: Response) {
  const { code, error, state } = req.query;

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

async function getUserID(token: string): Promise<string> {
  const response = await fetch(`${API_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    const errResult: SpotifyAPIError = await response.json();
    throw new Error(
      `HTTP error ${errResult.error.status} while getting user ID: ${errResult.error.message}`
    );
  }

  const result: SpotifyAPICurrentUser = await response.json();
  return result.id;
}

export async function getLikedSongs(token: string): Promise<SpotifyTrack[]> {
  const limit = 50;
  let offset = 0;
  let allTracks: SpotifyTrack[] = [];
  let hasNext = true;

  console.log("Fetching liked songs from Spotify...");

  while (hasNext) {
    console.log(`Page ${offset / limit + 1}...`);
    const queryString = `limit=${limit}&offset=${offset}`;
    const response = await fetch(`${API_URL}/me/tracks?${queryString}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      const errResult: SpotifyAPIError = await response.json();
      throw new Error(
        `Failed to fetch liked songs: (${errResult.error.status}) ${errResult.error.message}`
      );
    }

    const data: SpotifyAPIUserTracksResponse = await response.json();
    const items = data.items || [];

    const tracks: SpotifyTrack[] = items.map((item) => ({
      id: item.track.id,
      title: item.track.name,
      // artist: item.track.artists.map((a: any) => a.name).join(", "),
      isrc: item.track.external_ids.isrc,
      addedAt: new Date(item.added_at).getTime()
    }));

    allTracks = allTracks.concat(tracks);

    hasNext = !!data.next;
    offset += limit;
  }

  return allTracks;
}

export async function getSavedAlbums(
  token: string
): Promise<SpotifyAPIAlbumItem[]> {
  console.log("Getting liked albums of current user from Spotify...");
  let next: string | undefined = `${API_URL}/me/albums`;
  let albumsData: SpotifyAPIAlbumItem[] = [];
  let counter = 0;
  while (next) {
    console.log(`Album chunk ${++counter}`);
    const response = await fetch(next, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      const errResult: SpotifyAPIError = await response.json();
      throw new Error(
        `Could not get saved albums from Spotify: (${errResult.error.status}) ${errResult.error.message}`
      );
    }

    const result: SpotifyAPIAlbums = await response.json();
    albumsData = albumsData.concat(result.items);
    next = result.next ?? undefined;
  }

  return albumsData;
}

export async function getUserPlaylists(
  token: string
): Promise<[SpotifyPlaylist[], SpotifyAPIError[]]> {
  console.log("Getting playlists of current user from Spotify...");
  const userID = await getUserID(token);
  let playlists: SpotifyPlaylist[] = [];
  const errors: SpotifyAPIError[] = [];
  let next: string | undefined = `${API_URL}/me/playlists`;
  let playlistCounter = 0;

  while (next) {
    console.log(`Playlist chunk ${++playlistCounter}...`);
    const response: globalThis.Response = await fetch(next, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      const errResult: SpotifyAPIError = await response.json();
      errors.push(errResult);
      break;
    }

    const result: SpotifyAPIUserPlaylists = await response.json();

    for (const item of result.items) {
      if (item.owner.id !== userID) {
        console.log(`Skipping playlist ${item.name}`);
        continue;
      }
      console.log(`  Getting tracks from playlist ${item.name}...`);
      let allTracks: SpotifyPlaylistTrack[] = [];
      let trackNext: string | undefined = item.tracks.href;
      let trackCounter = 0;

      while (trackNext) {
        console.log(`    Track chunk ${++trackCounter}...`);
        const playlistTracksResponse = await fetch(trackNext, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!playlistTracksResponse.ok) {
          const errResult = await playlistTracksResponse.json();
          errors.push(errResult);
          break;
        }

        const playlistTracksResult: SpotifyAPIPlaylistItems =
          await playlistTracksResponse.json();

        allTracks = allTracks.concat(
          playlistTracksResult.items.map((trackItem) => ({
            isrc: trackItem.track.external_ids.isrc,
            addedAt: trackItem.added_at
          }))
        );
        trackNext = playlistTracksResult.next;
      }

      playlists.push({
        description: item.description,
        images: item.images,
        name: item.name,
        tracks: allTracks,
        public: item.public
      } as SpotifyPlaylist);
    }

    next = result.next;
  }

  return [playlists, errors];
}
