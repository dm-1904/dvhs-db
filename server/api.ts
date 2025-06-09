import dotenv from "dotenv";
import express from "express";
import fetch from "node-fetch";
import type { LeadUpload } from "../../common/schemas/leadUploadSchema.ts";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

console.log("Starting server…");

const app = express();

const PORT = process.env.PORT;
const API_URL = process.env.VITE_SPARK_API_URL;
const API_ACCESS_TOKEN = process.env.VITE_SPARK_API_ACCESS_TOKEN;

async function sparkGet(path: string) {
  const resp = await fetch(`${API_URL}${path}`, {
    headers: {
      Authorization: `OAuth ${API_ACCESS_TOKEN}`,
      Accept: "application/json",
    },
  });

  if (!resp.ok) {
    const txt = await resp.text();
    console.error(`Spark API error ${resp.status}: ${txt}`);
    throw Object.assign(new Error(txt), { status: resp.status });
  }

  return resp.json();
}

interface SparkListing {
  Id: string;
  StandardFields: {
    ListPrice: number;
    BedsTotal: number;
    BathsTotal: number;
    LivingArea: number;
    MlsStatus: string;
    UnparsedAddress: string;
  };
}

interface ListingSummary {
  Id: string;
  ListPrice: number;
  BedsTotal: number;
  BathsTotal: number;
  LivingArea: number;
  MlsStatus: string;
  UnparsedAddress: string;
}

/* ------------------------------------------------------------------ */
/*  GET /api/listings                                                  */
/* ------------------------------------------------------------------ */
app.get("/api/listings", async (req, res) => {
  try {
    const city = ((req.query.city as string) || "").replace(/'/g, "''");
    const state = ((req.query.state as string) || "AZ").toUpperCase();
    const top = Number(req.query.top) || 25;

    if (!city) {
      res.status(400).json({ error: "city query-param is required" });
      return;
    }

    /* ------------- build Spark query -------------------------------- */
    const filter = encodeURIComponent(
      `City eq '${city}' and StateOrProvince eq '${state}' and PropertyClass ne 'Rental'`
    );

    const SELECT =
      "ListingKey,ListPrice,BedsTotal,BathsTotal,LivingArea," +
      "MlsStatus,UnparsedAddress";

    const path = `/listings?_filter=${filter}&$select=${SELECT}&$top=${top}`;

    /* ------------- call Spark --------------------------------------- */
    const json = (await sparkGet(path)) as { D?: { Results?: SparkListing[] } };

    const results: ListingSummary[] = (json.D?.Results ?? []).map(
      (l: SparkListing) => {
        const s = l.StandardFields;
        return {
          Id: l.Id,
          ListPrice: s.ListPrice,
          BedsTotal: s.BedsTotal,
          BathsTotal: s.BathsTotal,
          LivingArea: s.LivingArea,
          MlsStatus: s.MlsStatus,
          UnparsedAddress: s.UnparsedAddress,
        };
      }
    );

    /* ------------- dev-only: show one full record ------------------- */
    // console.log("results", results.slice(0, 5));
    // localStorage.setItem("lastResults", JSON.stringify(results));

    res.json({ results });
  } catch (err) {
    const e = err as Error & { status?: number };
    res.status(e.status || 500).json({ error: e.message });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /api/listings/:Id/photo  – first photo (640 px)                */
/* ------------------------------------------------------------------ */
app.get("/api/listings/:Id/photo", async (req, res) => {
  try {
    const { Id } = req.params;
    const json = (await sparkGet(`/listings/${Id}/photos?$top=1`)) as {
      D?: { Results?: { Uri640?: string }[] };
    };
    const uri = json.D?.Results?.[0]?.Uri640 || "";
    res.json({ uri });
  } catch (err) {
    const e = err as Error & { status?: number };
    res.status(e.status || 500).json({ error: e.message });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /api/lead                                                    */
/* ------------------------------------------------------------------ */
app.get("/api/lead", async (req, res) => {
  const leads: LeadUpload[] = req.body;
  // Filter out leads missing required fields (example: firstName, lastName, email)
  const validLeads = leads.filter(
    (lead) => lead.firstName && lead.lastName && lead.email
  ) as any; // Cast to any or LeadCreateManyInput[] if types match

  if (validLeads.length === 0) {
    res.status(400).json({ error: "No valid leads with required fields." });
    return;
  }

  try {
    const result = await prisma.lead.createMany({
      data: validLeads,
      skipDuplicates: true,
    });

    res.status(201).json({
      message: `${result.count} leads created successfully.`,
      inserted: result.count,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create leads." });
  }
});

/* ------------------------------------------------------------------ */
/*  Boot                                                               */
/* ------------------------------------------------------------------ */
app.listen(PORT, () =>
  console.log(`MLS proxy is running on http://localhost:${PORT}`)
);
