// Direct endpoint for GPT Builder schema compatibility
app.post("/mcp/get_deals", async (req, res) => {
  try {
    // Forward internally to your existing /mcp logic
    req.body = { method: "get_deals", params: req.body || {} };
    const base = (process.env.AC_BASE_URL || "").replace(/\/$/, "");
    if (!base) throw new Error("AC_BASE_URL is not set");

    // Reuse your existing helper
    const data = await ac(`/api/3/deals?status=open`);
    res.json({ ok: true, data: (data.deals || []).slice(0, 50) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

