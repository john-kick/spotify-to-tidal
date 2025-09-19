import { generateRandomString, generateS256challenge } from "@/util";
import { sleep } from "bun";
import type { Request, Response } from "express";

const CLIENT_ID = process.env.TIDAL_CLIENT_ID;
const CLIENT_SECRET = process.env.TIDAL_CLIENT_SECRET;
const REDIRECT_URI = process.env.TIDAL_REDIRECT_URI;
const AUTHORIZATION_ENDPOINT = "https://login.tidal.com/authorize";
const TOKEN_ENDPOINT = "https://auth.tidal.com/v1/oauth2/token";
const API_ENDPOINT = "https://openapi.tidal.com/v2";
const STATE_COOKIE_KEY = "tidal_auth_state";
const TOKEN_COOKIE_KEY = "tidal_access_token";
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
    scope: scope,
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

export async function getLikedPlaylist(req: Request, res: Response) {
  try {
    const token = req.cookies[TOKEN_COOKIE_KEY];
    const userID = await getUserID(token);

    let hasNext = false;
    let nextLink = `${API_ENDPOINT}/userCollections/${userID}/relationships/tracks`;
    let allTracks = [];
    let counter = 0;

    do {
      console.log(`Page ${++counter} (link ${nextLink}) ...`);
      const response = await fetch(
        nextLink,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      await sleep(500); // Sleep to avoid 429
      console.log(response);
      const { data, links } = await response.json();

      allTracks = allTracks.concat(data);
      hasNext = links.next !== undefined;
      nextLink = API_ENDPOINT + links.next;
    } while (hasNext);
    res.status(200).json(allTracks);
  } catch (err) {
    console.log(err);
    res.status(500).json(err);
  }
}

async function getUserID(token: string): Promise<number> {
  const response = await fetch(`${API_ENDPOINT}/users/me`, {
    headers: {"Authorization": `Bearer ${token}`}
  });
  const result = await response.json();
  return result.data.id;
}
