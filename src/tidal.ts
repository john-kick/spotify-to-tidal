import type { Request, Response } from "express";
import { generateRandomString, generateS256challenge } from "./util";

const CLIENT_ID = process.env.TIDAL_CLIENT_ID;
const CLIENT_SECRET = process.env.TIDAL_CLIENT_SECRET;
const REDIRECT_URI = process.env.TIDAL_REDIRECT_URI;
const AUTHORIZATION_ENDPOINT = "https://login.tidal.com/authorize";
const TOKEN_ENDPOINT = "https://auth.tidal.com/v1/oauth2/token";
const STATE_COOKIE_KEY = "spotify_auth_state";
const TOKEN_COOKIE_KEY = "spotify_access_token";
const CODE_VERIFIER_KEY = "tidal_code_verifier";

export async function authorize(req: Request, res: Response) {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    return res.status(500).send("Configuration incomplete");
  }

  const scope = "collection.read collection.write playlist.read playlist.write";

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

  const encodedQuery = Object.entries(queryParams)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    )
    .join("&");

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

  // Get token
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

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
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
}
