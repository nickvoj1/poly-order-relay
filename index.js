const express = require("express");
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));

const app = express();
app.use(express.json());

app.post("/order", async (req, res) => {
  try {
    // Expect the client (Lovable or another server) to send a ready-to-submit order object
    // that Polymarket's CLOB accepts directly.[web:15][web:30]
    const orderPayload = req.body;

    const response = await fetch("https://clob.polymarket.com/order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(orderPayload)
    });

    const json = await response.json();
    res.status(response.status).json(json);
  } catch (e) {
    console.error("order error", e);
    res.status(500).json({ success: false, error: e.message || "unknown" });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(process.env.PORT || 3000, () =>
  console.log("poly-order-relay listening")
);
