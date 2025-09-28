import migrationRouter from "@/routes/migration.routes";
import spotifyRouter from "@/routes/spotify.routes";
import tidalRouter from "@/routes/tidal.routes";
import cookieParser from "cookie-parser";
import express from "express";
import path from "path";

const PORT = process.env.PORT || 3000;
const app = express();

app.use(cookieParser());
app.use(express.json());

app.use("/spotify", spotifyRouter);
app.use("/tidal", tidalRouter);
app.use("/migrate", migrationRouter);

app.use(express.static(path.join(__dirname, "../public")));

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
