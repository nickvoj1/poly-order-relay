const express = require("express");
const { ClobClient } = require('@polymarket/clob-client');  // NOT 'polymarket-clob-client'

const app = express();
app.use(express.json());

const PRIVATE_KEY = process.env.POLYMARKET_PRIVATE_KEY;
const clobClient = new ClobClient({ 
  signerKey: PRIVATE_KEY, 
  chainId: 137  // Polygon
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.post("/trade", async (req, res) => {
  try {
    const params = req.body;  // ANY market/params
    
    const order = await clobClient.createOrder(params);
    
    res.json({ 
      success: true, 
      orderId: order.orderId,
      status: order.status,
      order 
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/order", async (req, res) => {
  // Legacy proxy (keep for compatibility)
  try {
    const order = await clobClient.createOrder(req.body);
    res.json({ success: true, order });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`PolyOrder Relay LIVE on port ${PORT}`);
});
