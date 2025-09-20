import { generateRandomString } from "@/util";
import { type Request, type Response } from "express";

export interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  isrc: string;
}

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
