const express = require("express");
const fetch = require("node-fetch");
const { HttpsProxyAgent } = require("https-proxy-agent");

const app = express();
app.use(express.json());

const proxyAgent = new HttpsProxyAgent("http://35.229.117.3:3128");

app.post("/order", async (req, res) => {
  try {
    const payload = req.body;
    
    const response = await fetch("https://clob.polymarket.com/order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      agent: proxyAgent,
      body: JSON.stringify(payload)
    });
    
    const json = await response.json();
    res.status(response.status).json(json);
  } catch (e) {
    console.error("order error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/health", (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.listen(process.env.PORT || 3000, () => {
  console.log("poly-order-relay listening");
});
