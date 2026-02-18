const express = require("express");
const { ClobClient } = require('polymarket-clob-client');

const app = express();
app.use(express.json());

const PRIVATE_KEY = process.env.POLYMARKET_PRIVATE_KEY;
const clobClient = new ClobClient({ 
  signerKey: PRIVATE_KEY, 
  chainId: 137 // Polygon
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.post("/trade", async (req, res) => {
  try {
    const { market, amount, side } = req.body;
    
    const order = await clobClient.createOrder({
      tokenID: market,  // "trump-2028", etc
      price: side === 'buy' ? '1' : '0',
      size: amount.toString(),
      side: side === 'buy' ? 0 : 1
    });
    
    res.json({ success: true, order });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(process.env.PORT || 8080, () => {
  console.log("PolyOrder Relay + Signing LIVE");
});
