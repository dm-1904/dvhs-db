import { Router } from "express";
// import fetch from "node-fetch";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { LeadUpload } from "../../../common/schemas/leadUploadSchema";

const router = Router();
// import express from "express";

dotenv.config();

console.log("Starting MLS proxy server…");

// const app = express();
const prisma = new PrismaClient();
// const router = Router();

const PORT = process.env.PORT;
const API_URL = process.env.SPARK_API_URL;
const API_ACCESS_TOKEN = process.env.SPARK_API_ACCESS_TOKEN;

async function sparkGet(path: string) {
  const fetch = globalThis.fetch;

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
  Media?: { Uri640?: string }[];
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
router.get("/listings", async (req, res) => {
  try {
    const {
      city,
      state,
      top = 100,
      priceMin,
      priceMax,
      bedsMin,
      bathsMin,
      sqftMin,
      den,
      propertyTypes,
      sort = "desc",
    } = req.query;

    if (!city || !state) {
      return res.status(400).json({ error: "City and state are required." });
    }

    const filters: string[] = [
      `City eq '${city}'`,
      `StateOrProvince eq '${state}'`,
      `PropertyClass ne 'Rental'`,
    ];
    if (priceMin) filters.push(`ListPrice ge ${priceMin}`);
    if (priceMax) filters.push(`ListPrice le ${priceMax}`);
    if (bedsMin) filters.push(`BedsTotal ge ${bedsMin}`);
    if (bathsMin) filters.push(`BathsTotal ge ${bathsMin}`);
    if (sqftMin) filters.push(`LivingArea ge ${sqftMin}`);
    if (den === "true") filters.push(`RoomType/any(r: r eq 'Den')`);
    if (propertyTypes) {
      const types = (propertyTypes as string).split(",");
      filters.push(
        `PropertySubType in (${types.map((t) => `'${t}'`).join(",")})`
      );
    }

    const query = `/listings?_filter=${filters.join(
      " and "
    )}&_select=ListingKey,StandardFields&_limit=${top}&_orderby=ListPrice ${sort}`;

    const sparkData = await sparkGet(query);
    const listings: any[] = sparkData?.D?.Results || sparkData?.D || [];

    const results = await Promise.all(
      listings.map(async (l) => {
        const listingId = l.ListingKey || l.Id;
        if (!listingId) return null;
        let thumbnail = "";

        try {
          const mediaRes = await sparkGet(
            `/listings/${listingId}/media?$top=1`
          );
          const first = mediaRes?.D?.Results?.[0];
          thumbnail = first?.Uri640 || first?.Uri || "";
        } catch (err) {
          console.warn(`Failed to fetch media for ${listingId}`, err);
        }

        const f = l.StandardFields;
        return {
          Id: listingId,
          ListPrice: f?.ListPrice,
          BedsTotal: f?.BedsTotal,
          BathsTotal: f?.BathroomsTotalInteger,
          LivingArea: f?.LivingArea,
          MlsStatus: f?.MlsStatus,
          UnparsedAddress: f?.UnparsedAddress,
          thumbnail,
        };
      })
    );

    res.json({ results });
  } catch (err) {
    console.error("Spark listings error:", err);
    res.status(500).json({ error: "Failed to fetch listings" });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /api/listings/:Id/photo  – first photo (640 px)                */
/* ------------------------------------------------------------------ */
router.get("/listings/:Id/photo", async (req, res) => {
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
router.get("/lead", async (req, res) => {
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
// app.listen(PORT, () =>
//   console.log(`MLS proxy is running on http://localhost:${PORT}`)
// );

export default router;
