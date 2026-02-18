const express = require("express");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

app.post("/order", async (req, res) => {
  try {
    const response = await fetch("https://clob.polymarket.com/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body)
    });
    
    const json = await response.json();
    res.status(response.status).json(json);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(process.env.PORT || 3000);
