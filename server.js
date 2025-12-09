import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const { AC_BASE_URL, AC_API_KEY, MCP_AUTH_TOKEN } = process.env;

// Basic auth for GPT → adapter
app.use((req, res, next) => {
  const auth = req.headers.authorization || "";
  if (!MCP_AUTH_TOKEN || auth !== `Bearer ${MCP_AUTH_TOKEN}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

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

app.post("/mcp", async (req, res) => {
  try {
    const { method, params = {} } = req.body || {};

    if (method === "get_deals") {
      const { status = "open", limit = 50 } = params;
      const data = await ac(`/api/3/deals?status=${encodeURIComponent(status)}`);
      return res.json({ ok: true, data: (data.deals || []).slice(0, limit) });
    }

    if (method === "get_deal_details") {
      const { deal_id } = params;
      if (!deal_id) throw new Error("deal_id required");
      const data = await ac(`/api/3/deals/${encodeURIComponent(deal_id)}`);
      return res.json({ ok: true, data: data.deal || data });
    }

    if (method === "search_contacts") {
      const { email, name, limit = 25 } = params;
      const q = email ? `email=${encodeURIComponent(email)}`
                      : name ? `query=${encodeURIComponent(name)}`
                             : "";
      const data = await ac(`/api/3/contacts${q ? "?" + q : ""}`);
      return res.json({ ok: true, data: (data.contacts || []).slice(0, limit) });
    }

    if (method === "report_open_deals_by_agent") {
      const data = await ac(`/api/3/deals?status=open`);
      const deals = data.deals || [];
      const byOwner = {};
      for (const d of deals) {
        const owner = d.owner || d.owner_id || "unassigned";
        byOwner[owner] = byOwner[owner] || { count: 0, deals: [] };
        byOwner[owner].count++;
        byOwner[owner].deals.push({ id: d.id, title: d.title, stage: d.stage, value: d.value });
      }
      return res.json({ ok: true, data: byOwner });
    }

    if (method === "list_overdue_by_stage") {
      const { pipeline, threshold_days = 3 } = params;
      const data = await ac(`/api/3/deals?status=open${pipeline ? `&pipeline=${encodeURIComponent(pipeline)}` : ""}`);
      const now = Date.now();
      const ms = threshold_days * 24 * 60 * 60 * 1000;
      const overdue = (data.deals || []).filter(d => {
        const t = Date.parse(d.updated_at || d.cdate || d.created_at || "");
        return t && now - t > ms;
      });
      const byStage = {};
      for (const d of overdue) {
        const stage = d.stage || "unknown";
        byStage[stage] = byStage[stage] || [];
        byStage[stage].push({ id: d.id, title: d.title, owner: d.owner || d.owner_id });
      }
      return res.json({ ok: true, data: byStage });
    }

    return res.status(400).json({ ok: false, error: "Unknown method" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

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
// --- Temporary OpenAPI bridge for GPT Builder ---
app.get('/openapi.json', (req, res) => {
  res.json({
    openapi: '3.1.0',
    info: {
      title: 'ActiveCampaign MCP Adapter',
      version: '1.0.0',
      description: 'Temporary OpenAPI schema for GPT Builder compatibility'
    },
    paths: {
      '/get_deals': {
        post: {
          summary: 'Fetch recent deals from ActiveCampaign',
          responses: { 200: { description: 'Successful response' } }
        }
      },
      '/search_contacts': {
        post: {
          summary: 'Search contacts in ActiveCampaign',
          responses: { 200: { description: 'Successful response' } }
        }
      }
    }
  });
});

app.listen(port, () => console.log(`MCP adapter on :${port}`));
