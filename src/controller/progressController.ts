import ProgressHandler from "@/util/progressHandler";
import type { Request, Response } from "express";

const INTERVAL_TIME = 500; // ms

export function progress(req: Request, res: Response): void {
  // Set headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  let { uuid } = req.query;

  if (!uuid) {
    res.status(400).json({ message: "UUID is required" });
    return;
  }

  uuid = uuid.toString();
  const progressHandler = ProgressHandler.getInstance();
  const progress = progressHandler.getProgress(uuid);

  if (!progress) {
    res.status(404).json({ message: "Progress bar not found" });
    return;
  }

  const sendProgress = () => {
    if (progress.finished) {
      res.write(`data: ${JSON.stringify({ status: "done" })}\n\n`);
      clearInterval(intervalId);
      progressHandler.removeProgress(uuid);
      res.end();
      return;
    }

    const current = progress.getCurrent();
    res.write(`data: ${JSON.stringify(current)}\n\n`);
  };

  const intervalId = setInterval(sendProgress, INTERVAL_TIME);
}
