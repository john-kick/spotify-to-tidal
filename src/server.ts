import cookieParser from "cookie-parser";
import express, { type Request, type Response } from "express";
import {
  authorize as spotifyAuth,
  callback as spotifyCallback
} from "./spotify";
import { authorize as tidalAuth, callback as tidalCallback } from "./tidal";
import path, { dirname } from "path";

const PORT = process.env.PORT || 3000;
const app = express();

app.use(cookieParser());
app.use(express.json());

app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req: Request, res: Response) => {
  res.status(200).send("Dashboard");
});

app.get("/spotify/auth", spotifyAuth);
app.get("/spotify/callback", spotifyCallback);

app.get("/tidal/auth", tidalAuth);
app.get("/tidal/callback", tidalCallback);

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
