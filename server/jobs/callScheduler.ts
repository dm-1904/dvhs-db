import twilio from "twilio";
import cron from "node-cron";

const client = twilio(process.env.TWILIO_SID!, process.env.TWILIO_AUTH_TOKEN!);
const twilioNumber = process.env.TWILIO_NUMBER!;
const agentPhone = process.env.DAMON_PHONE!;

type TimeWindow = [number, number]; // [startMin, endMin] in minutes from midnight

// Define static windows in minutes past midnight
const callSchedule: Record<string, TimeWindow[]> = {
  1: [
    // Monday
    [600, 660], // 10:00 - 11:00
    [960, 1050], // 16:00 - 18:00
  ],
  2: [
    // Tuesday
    [600, 660], // 10:00 - 11:00
    [960, 1050], // 16:00 - 18:00
  ],
  3: [
    // Wednesday
    [510, 690], // 8:30 - 11:30
    [960, 1050], // 16:00 - 18:00
  ],
  4: [
    // Thursday
    [510, 690], // 8:30 - 11:30
    [960, 1050], // 16:00 - 18:00
  ],
};

// every minute, check for a window starting in 15 minutes
cron.schedule("* * * * *", async () => {
  const now = new Date();
  const in15 = new Date(now.getTime() + 15 * 60 * 1000);
  const day = in15.getDay();
  const currentMin = in15.getHours() * 60 + in15.getMinutes();

  const windowsToday = callSchedule[day] || [];
  const match = windowsToday.find(([startMin]) => currentMin === startMin);

  if (match) {
    try {
      await client.messages.create({
        from: twilioNumber,
        to: agentPhone,
        body: `Your calling window starts in 15 minutes. Reply YES to begin calling leads.`,
      });
      console.log(
        `✅ Notification sent for upcoming call window at ${formatTime(
          match[0]
        )}`
      );
    } catch (err) {
      console.error("Failed to send notification:", err);
    }
  }
});

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}
