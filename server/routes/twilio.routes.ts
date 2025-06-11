import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import twilio from "twilio";

const prisma = new PrismaClient();
const router = Router();
const client = twilio(process.env.TWILIO_SID!, process.env.TWILIO_AUTH_TOKEN!);
const twilioNumber = process.env.TWILIO_NUMBER!;
const agentPhone = process.env.DAMON_PHONE!;
const BASE_URL = process.env.BASE_URL!;
const callWaiters = new Map<string, () => void>();

const prospectingMessages = [
  "Hi {{name}}, this is Damon Ryon (your local Real Estate expert). I saw your info come in and wanted to quickly connect. Are you still exploring homes in the area?",
  "Just tried giving you a quick call — no worries if now’s not a good time. Let me know if you're still looking for a home or just browsing!",
  "Still here to help when you’re ready, {{name}}. Happy to share listings or answer questions about nearby communities!",
  "I put together a few homes that match your area and budget. Want me to text them to you?",
  "No pressure — just making sure I didn’t miss the mark. Are you still interested in buying a home, or has something changed?",
  "A few properties you may like just hit the market. Want me to send over the details?",
  "Quick question: What’s your ideal price range or community? I can stop calling if you’re not actively looking.",
  "I totally understand life gets busy. If now’s not the right time, just let me know. Otherwise, I’ll try one more time later this week.",
  "You’ve been on my list a bit, and I don’t want to bother you. Would you prefer email, text, or not being contacted at all?",
  "I’ve reached out a few times without a response. I’ll mark your file as Unresponsive for now. If anything changes, I’d still be happy to help. Take care!",
];

// Upload CSV-parsed leades -> POST /api/leads/upload
router.post("/leads/upload", async (req, res, next) => {
  try {
    const leads = req.body as {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
    }[];
    const inserted = await prisma.lead.createMany({
      data: leads,
      skipDuplicates: true,
    });
    res.json({ inserted: inserted.count });
  } catch (err) {
    next(err);
  }
});

// Mark a lead do not call -> POST /api/leads/:id/opt-out
router.post("/leads/:id/opt-out", async (req, res, next) => {
  try {
    await prisma.lead.update({
      where: { id: req.params.id },
      data: { doNotCall: true },
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// TwiLM: step 1 -play msg, wait 8 s, redirect
router.post("/twiml/lead", (req, res) => {
  const leadId = req.query.leadId as string;
  const twiml = new twilio.twiml.VoiceResponse();

  twiml.play(); ///////////////////////////// INCLUDE LOGIC TO PLAY A MESSAGE HERE
  twiml.pause({ length: 10 });
  twiml.redirect(`/api/twiml/forward?leadId=${leadId}`);
  res.type("text/xml").send(twiml.toString());
});

// TwiLM: step 2 - SMS + forward
router.post("/twiml/forward", async (req, res) => {
  const leadId = req.query.leadId as string;
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });

  if (!lead) return res.status(404).end("Lead not found");

  await prisma.call.create({
    data: {
      leadId,
      direction: "FORWARDED",
      status: "IN_PROGRESS",
      twilioSid: req.body.CallSid ?? "unknown",
    },
  });

  await client.messages.create({
    to: agentPhone,
    from: twilioNumber,
    body: `New lead: ${lead.firstName} ${lead.lastName} (${lead.email}, ${lead.phone}, ${lead.favoriteCity})`,
  });

  const twiml = new twilio.twiml.VoiceResponse();
  const dial = twiml.dial({ callerId: twilioNumber });
  dial.number(agentPhone);
  res.type("text/xml").send(twiml.toString());
});

// SMS webhook -> detect "Yes" to start queue
router.post("/sms", async (req, res) => {
  const body = (req.body.Body || "").trim().toLowerCase();
  if (body === "yes") await startCallQueue();
  res
    .type("text/xml")
    .send(`<Response><Message>Rgr. Prepare to engage.</Message></Response>`);
});

// Twilio status callback -> marks call as done
router.post("/twilio/status", async (req, res) => {
  const { CallSid, CallStatus, callId, AnsweredBy, CallDuration } = req.body;

  const durationSec = Number(CallDuration ?? 0);
  const status = CallStatus?.toLowerCase() ?? "unknown";

  // Mark call record status
  await prisma.call.updateMany({
    where: { id: callId },
    data: { status: CallStatus.toUpperCase(), durationSec },
  });

  const call = await prisma.call.findUnique({
    where: { id: callId },
    include: { lead: true },
  });

  if (!call) return res.status(404).end();

  // Skip logic if already contacted
  if (call.lead.pipelineStage === "Contacted") {
    return res.sendStatus(200);
  }

  // Handle voicemail detection from Twilio
  if (AnsweredBy === "machine") {
    console.log(`🛑 Voicemail detected for callId: ${callId}`);
    await client.calls(CallSid).update({ status: "completed" }); // Hang up the call
  }

  // if call lasted longer than 15 seconds, mark as contacted
  if (
    call.direction === "FORWARDED" &&
    status === "completed" &&
    durationSec > 15 &&
    call.lead.pipelineStage !== "Contacted"
  ) {
    await prisma.lead.update({
      where: { id: call.leadId },
      data: { pipelineStage: "Contacted" },
    });
    console.log(
      `✅ Marked Lead ${call.lead.firstName} ${call.lead.lastName} as Contacted (Call ID: ${callId})`
    );
  }

  // send prospecting text if call was not answered
  const isFailedOutbound =
    call.direction === "OUTBOUND" &&
    ["no-answer", "busy", "failed", "canceled"].includes(status);

  if (isFailedOutbound) {
    await sendProspectingText(call.lead);
  }

  // Resume the queue if this call was being awaited
  const resolve = callWaiters.get(callId);
  if (resolve) {
    resolve();
    callWaiters.delete(callId);
  }

  res.sendStatus(200);
});

// Helper: queue runner - one call at a time
async function startCallQueue() {
  const leads = await prisma.lead.findMany({
    where: {
      doNotCall: false,
      pipelineStage: {
        notIn: ["Contacted", "Attempted Unresponsive"],
      },
    },
    orderBy: { registered: "asc" },
  });
  for (const lead of leads) {
    // Create call record with placeholder SID
    const callRecord = await prisma.call.create({
      data: {
        twilioSid: "placeholder",
        leadId: lead.id,
        direction: "OUTBOUND",
        status: "PENDING",
      },
    });

    //Set up a Promise to wait until the call is done
    const callPromise = new Promise<void>((resolve) => {
      callWaiters.set(callRecord.id, resolve);
    });

    // Create Twilio call with machine detection and callback
    const twilioCall = await client.calls.create({
      to: lead.phone,
      from: twilioNumber,
      url: `${BASE_URL}/api/twiml/lead?leadId=${lead.id}&callId=${callRecord.id}`,
      machineDetection: "Enable",
      machineDetectionTimeout: 10,
      statusCallback: `${BASE_URL}/api/twilio/status`,
      statusCallbackEvent: ["completed", "failed", "no-answer"],
      statusCallbackMethod: "POST",
    });

    // Update the DB record with the actual Twilio Call SID
    await prisma.call.update({
      where: { id: callRecord.id },
      data: { twilioSid: twilioCall.sid },
    });

    console.log(
      `📞 Call initiated to ${lead.firstName} ${lead.lastName} (Call ID: ${callRecord.id})`
    );

    // Wait for the call to finish before proceeding to the next lead
    await callPromise;

    console.log(
      `✅ Call completed for ${lead.firstName} ${lead.lastName} (Call ID: ${callRecord.id})`
    );
  }
  console.log("All calls completed.");
}

async function sendProspectingText(lead: any) {
  if (lead.pipelineStage === "Contacted") {
    console.log(`🚫 Not texting contacted lead: ${lead.firstName}`);
    return;
  }

  const attempts = lead.attemptCount ?? 0;

  // Stop if already attempted 10 times
  if (attempts >= 10) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { pipelineStage: "Attempted Unresponsive" },
    });
    return;
  }

  const template =
    prospectingMessages[Math.min(attempts, prospectingMessages.length - 1)];
  const message = template.replace("{{name}}", lead.firstName || "there");

  await client.messages.create({
    to: lead.phone,
    from: twilioNumber,
    body: message,
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: { attemptCount: attempts + 1 },
  });

  console.log(
    `📩 Sent prospecting text to ${lead.firstName} ${lead.lastName} (${lead.phone})`
  );
}

//how do i make sure this is not hitting voicemail?
// how long should it right before ending the call?

export default router;
