// src/index.ts
import express from "express";
import cors from "cors";
import blogApi from "./routes/blog.routes";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", blogApi); // → /api/posts/…

/* rudimentary error handler */
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res.status(500).send("Server error");
});

app.listen(4000, () => console.log("API listening on :4000"));
