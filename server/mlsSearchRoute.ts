// console.log("Loading mlsSearchRoute...");
// import express, { Request, Response } from "express";
// import fetch from "node-fetch";
// import crypto from "crypto";
// import dotenv from "dotenv";

// dotenv.config();

// const API_KEY = process.env.SPARK_API_KEY;
// const API_SECRET = process.env.SPARK_API_SECRET;
// const API_URL = process.env.SPARK_API_URL;

// if (!API_KEY || !API_SECRET) {
//   throw new Error("Missing required environment variables");
// }

// let cachedAuthToken: string | null = null;
// let tokenExpiresAt = 0;

// function md5(input: string) {
//   return crypto.createHash("md5").update(input).digest("hex");
// }

// async function getAuthToken(): Promise<string> {
//   const now = Date.now();
//   if (cachedAuthToken && now < tokenExpiresAt) return cachedAuthToken;

//   const apiSig = md5(`${API_SECRET}ApiKey${API_KEY}`);

//   // const url = `${API_URL}/session?ApiKey+${API_KEY}&ApiSig=${apiSig}`;
//   const url = `${
//     API_URL ?? "https://sparkapi.com/v1"
//   }/session?ApiKey=${API_KEY}&ApiSig=${apiSig}`;
//   const res = await fetch(url);
//   if (!res.ok) {
//     throw new Error(`Spark session failed: ${res.status}`);
//   }
//   interface SparkSessionResponse {
//     D?: {
//       AuthToken?: string;
//       [key: string]: unknown;
//     };
//     [key: string]: unknown;
//   }
//   const json = (await res.json()) as SparkSessionResponse;
//   const token = json?.D?.AuthToken as string | undefined;
//   if (!token) throw new Error("Spark session response missing AuthToken");

//   cachedAuthToken = token;
//   tokenExpiresAt = now + 23 * 60 * 60 * 1000;

//   return token;
// }

// function buildApiSig(servicePath: string, authToken: string) {
//   return md5(
//     `${API_SECRET}ApiKey${API_KEY}ServicePath${servicePath}AuthToken${authToken}`
//   );
// }

// const router = express.Router();

// router.get("/mls-search", async (req: Request, res: Response) => {
//   try {
//     const search = (req.query.query as string) ?? "";
//     const authToken = await getAuthToken();
//     const servicePath = "/listings";
//     const apiSig = buildApiSig(servicePath, authToken);
//     const select = [
//       "ListingKey",
//       "ListingPrice",
//       "UnparsedAddress",
//       "City",
//       "StateOrProvince",
//       "ListAgentFullName",
//       "Media",
//     ].join(",");
//     // const filter = encodeURIComponent(
//     //   `Contains(UnparsedAddress, '${search}' or Contains(City, '${search}`
//     // );
//     const filter = encodeURIComponent(
//       `Contains(UnparsedAddress,'${search}') or Contains(City,'${search}')`
//     );
//     const sparkUrl = `${API_URL}${servicePath}?ApiKey=${API_KEY}&AuthToken=${authToken}&ApiSig=${apiSig}&$select=${select}&$filter=${filter}&$top=30`;
//     const sparkRes = await fetch(sparkUrl);
//     if (!sparkRes.ok) {
//       const txt = await sparkRes.text();
//       console.error("Spark listings error:", sparkRes.status, txt);
//       res.status(sparkRes.status).send(txt);
//       return;
//     }
//     interface SparkListingsResponse {
//       D?: {
//         Results?: unknown[];
//         [key: string]: unknown;
//       };
//       [key: string]: unknown;
//     }
//     const payload = (await sparkRes.json()) as SparkListingsResponse;
//     const listings = payload?.D?.Results ?? [];

//     res.json(listings);
//   } catch (error: unknown) {
//     console.error("MLS search error:", error);
//     if (error instanceof Error) {
//       res.status(500).json({ error: error.message });
//     } else {
//       res.status(500).json({ error: "Internal Server Error" });
//     }
//   }
// });

// export default router;
