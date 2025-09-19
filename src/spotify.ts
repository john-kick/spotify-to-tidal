import { type Request, type Response } from "express";
import { generateRandomString } from "./util";

const AUTHORIZE_ENDPOINT = "https://accounts.spotify.com/authorize";
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const REDIRECT_URI = "http://127.0.0.1:8080/spotify/callback";
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const STATE_COOKIE_KEY = "spotify_auth_state";
const TOKEN_COOKIE_KEY = "spotify_access_token";

export function authorize(_req: Request, res: Response): void {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    res.status(500).send("Missing client id or client secret");
  }

  const state = generateRandomString();
  res.cookie(STATE_COOKIE_KEY, state);

  const queryParams = {
    response_type: "code",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: "user-read-private user-read-email",
    redirect_uri: REDIRECT_URI,
    state,
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

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).send("Missing client id or client secret");
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

    res.redirect("/");
  } catch (err) {
    res.status(500).json({ message: "Token request failed", error: err });
  }
}
