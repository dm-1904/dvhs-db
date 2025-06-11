// src/index.ts
import express from "express";
import cors from "cors";
import path from "path";
import blogRoutes from "./routes/blog.routes";
import mlsRoutes from "./routes/mls.routes";
import twilioRoutes from "./routes/twilio.routes";
import "./jobs/callScheduler";

const app = express();
app.use(cors());
app.use(express.json());

// app.use("/", blogApi); // → /api/posts/…
app.use("/api", blogRoutes);
app.use("/api", mlsRoutes);
app.use("/api", twilioRoutes);
app.use(
  "/assets",
  express.static(path.join(__dirname, "..", "assets"), {
    setHeaders(res, filePath) {
      if (filePath.endsWith(".mp3")) res.type("audio/mpeg");
    },
  })
);

/* rudimentary error handler */
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res.status(500).send("Server error");
});

app.listen(4000, () => console.log("API listening on :4000"));
