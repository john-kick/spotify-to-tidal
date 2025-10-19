import SpotifyConnector from "@/connector/spotifyConnector";
import type {
  SpotifyAPIAlbumItem,
  SpotifyAPIAlbums,
  SpotifyAPICurrentUser,
  SpotifyAPIError,
  SpotifyAPIPlaylistItem,
  SpotifyAPIPlaylistItems,
  SpotifyAPIUserPlaylists,
  SpotifyAPIUserTracks,
  SpotifyPlaylist,
  SpotifyTrack,
} from "@/types/spotify";
import { generateRandomString } from "@/util";
import { response, type Request, type Response } from "express";

const AUTHORIZE_ENDPOINT = "https://accounts.spotify.com/authorize";
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const API_URL = "https://api.spotify.com/v1";
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const STATE_COOKIE_KEY = "spotify_auth_state";
export const TOKEN_COOKIE_KEY = "spotify_access_token";

const connector: SpotifyConnector = new SpotifyConnector();

export function status(req: Request, res: Response): void {
  const token = req.cookies[TOKEN_COOKIE_KEY];
  if (token) {
    res.status(200).json({ authorized: true });
  } else {
    res.status(200).json({ authorized: false });
  }
}

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
    state,
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
    redirect_uri: REDIRECT_URI,
  });

  const encodedClientCreds = Buffer.from(
    `${CLIENT_ID}:${CLIENT_SECRET}`
  ).toString("base64");

  const headers = {
    Authorization: `Basic ${encodedClientCreds}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers,
      body: body.toString(),
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
      maxAge: expires_in * 1000,
    });

    res.redirect("/auth");
  } catch (err) {
    res.status(500).json({ message: "Token request failed", error: err });
  }
}

async function getUserID(token: string): Promise<string> {
  const response = await connector.get("/me", token);

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
  const userTracks = await connector.getPaginated<SpotifyAPIUserTracks>(
    "/me/tracks",
    token
  );

  return userTracks.map((item) => ({
    id: item.track.id,
    title: item.track.name,
    isrc: item.track.external_ids.isrc,
    addedAt: new Date(item.added_at).getTime(),
  }));
}

export async function getSavedAlbums(
  token: string
): Promise<SpotifyAPIAlbumItem[]> {
  return await connector.getPaginated<SpotifyAPIAlbums>("/me/albums", token);
}

export async function getUserPlaylists(
  token: string,
  includeFollowedPlaylists: boolean
): Promise<SpotifyPlaylist[]> {
  let responsePlaylists = await connector.getPaginated<SpotifyAPIUserPlaylists>(
    "/me/playlists",
    token
  );

  if (!includeFollowedPlaylists) {
    const userID = await getUserID(token);
    responsePlaylists = responsePlaylists.filter(
      (playlist) => playlist.owner.id === userID
    );
  }

  // Convert the tracks object
  let playlists: SpotifyPlaylist[] = [];

  for (const playlist of responsePlaylists) {
    let tracks: SpotifyAPIPlaylistItem[] =
      await connector.getPaginated<SpotifyAPIPlaylistItems>(
        playlist.tracks.href,
        token
      );

    tracks = tracks.filter((item) => item.track !== null);

    playlists.push({
      name: playlist.name,
      description: playlist.description,
      images: playlist.images,
      public: playlist.public,
      tracks: tracks.map((item) => ({
        id: item.track.id,
        title: item.track.name,
        isrc: item.track.external_ids.isrc,
        addedAt: new Date(item.added_at).getTime(),
      })),
    });
  }

  return playlists.map((playlist) => ({
    name: playlist.name,
    description: playlist.description,
    images: playlist.images,
    public: playlist.public,
    tracks: playlist.tracks,
  }));
}
