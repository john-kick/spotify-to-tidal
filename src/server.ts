import migrationRouter from "@/routes/migration.routes";
import spotifyRouter from "@/routes/spotify.routes";
import tidalRouter from "@/routes/tidal.routes";
import cookieParser from "cookie-parser";
import express from "express";
import path from "path";
import { TOKEN_COOKIE_KEY as SPOTIFY_TOKEN_COOKIE_KEY } from "./controller/spotifyController";
import { TOKEN_COOKIE_KEY as TIDAL_TOKEN_COOKIE_KEY } from "./controller/tidalController";
import { progress } from "./controller/progressController";

const PORT = process.env.PORT || 3000;
const app = express();

app.use(cookieParser());
app.use(express.json());

app.use("/spotify", spotifyRouter);
app.use("/tidal", tidalRouter);
app.use("/migrate", migrationRouter);

app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) =>
  res.sendFile("public/views/index.html", { root: path.join(__dirname, "..") })
);
app.get("/auth", (req, res) =>
  res.sendFile("public/views/auth.html", { root: path.join(__dirname, "..") })
);
app.get("/logout", (req, res) => {
  res.clearCookie(SPOTIFY_TOKEN_COOKIE_KEY);
  res.clearCookie(TIDAL_TOKEN_COOKIE_KEY);
  res.redirect("/auth?logout=1");
});
app.get("/progress", progress);

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
