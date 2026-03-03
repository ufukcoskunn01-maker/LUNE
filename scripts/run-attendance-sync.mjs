function getArg(flag, fallback) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

const appBaseUrl = (getArg("--base-url", process.env.APP_BASE_URL || "http://localhost:3000") || "").replace(/\/$/, "");
const projectCode = getArg("--project", "A27");
const lookbackDays = Number(getArg("--lookback-days", "90"));
const startDate = getArg("--start-date", "");
const endDate = getArg("--end-date", "");
const cronSecret = process.env.CRON_SECRET;

if (!appBaseUrl) {
  console.error("Missing app base URL");
  process.exit(1);
}

const headers = { "Content-Type": "application/json" };
if (cronSecret) headers.authorization = `Bearer ${cronSecret}`;

const payload = { projectCode };
if (Number.isFinite(lookbackDays) && lookbackDays > 0) payload.lookbackDays = lookbackDays;
if (startDate) payload.startDate = startDate;
if (endDate) payload.endDate = endDate;

fetch(`${appBaseUrl}/api/jobs/daily-personal-reports-sync`, {
  method: "POST",
  headers,
  body: JSON.stringify(payload),
})
  .then(async (response) => {
    const text = await response.text();
    let parsed = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // keep raw text
    }
    console.log(JSON.stringify({ status: response.status, ok: response.ok, result: parsed }, null, 2));
    if (!response.ok) process.exitCode = 1;
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
