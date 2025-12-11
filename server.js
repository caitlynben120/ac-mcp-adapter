import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const { AC_BASE_URL, AC_API_KEY, MCP_AUTH_TOKEN } = process.env;

// --- keep your existing code above unchanged --- //

// Helper to call ActiveCampaign
async function ac(path) {
  const base = (AC_BASE_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("AC_BASE_URL is not set");
  const url = `${base}${path}`;
  const rsp = await fetch(url, { headers: { "Api-Token": AC_API_KEY } });
  if (!rsp.ok) {
    const text = await rsp.text().catch(() => "");
    throw new Error(`AC error ${rsp.status}: ${text.slice(0, 200)}`);
  }
  return rsp.json();
}

// ✅ Add this route BELOW the helper, BEFORE app.get("/")
app.post("/mcp/get_deals", async (req, res) => {
  try {
    const data = await ac(`/api/3/deals?status=open`);
    res.json({ ok: true, data: (data.deals || []).slice(0, 50) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// keep everything else below
app.get("/", (_req, res) => {
  res.json({
    name: "ActiveCampaign MCP Adapter",
    tools: [
      "get_deals",
      "get_deal_details",
      "search_contacts",
      "report_open_deals_by_agent",
      "list_overdue_by_stage"
    ],
    readOnly: true
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`MCP adapter on :${port}`));
