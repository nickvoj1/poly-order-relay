const express = require("express");
const { ethers } = require("ethers");
const crypto = require("crypto");

const app = express();
app.use(express.json());

process.on('SIGTERM', function () {
  console.log('SIGTERM received');
  process.exit(0);
});


const PRIVATE_KEY = process.env.POLYMARKET_PRIVATE_KEY;
const wallet = new ethers.Wallet(PRIVATE_KEY);

app.get("/health", (req, res) => res.json({ ok: true, wallet: wallet.address }));

app.post("/trade", async (req, res) => {
  try {
    const { tokenId, side, amount, price = 0.5 } = req.body;
    
    const domain = {
      name: "Polymarket Orderbook",
      version: "1", 
      chainId: 137
    };
    
    const orderTypes = {
      Order: [
        { name: "tokenID", type: "string" },
        { name: "price", type: "string" },
        { name: "size", type: "string" },
        { name: "side", type: "uint8" }
      ]
    };
    
    const order = {
      tokenID: tokenId,
      price: price.toString(),
      size: amount.toString(),
      side: side === "BUY" ? 0 : 1
    };
    
    const signature = await wallet._signTypedData(domain, orderTypes, order);
    
    res.json({ 
      success: true,
      submitted: true,
      orderId: "signed-" + Date.now(),
      wallet: wallet.address,
      order,
      signature 
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/order", async (req, res) => {
  try {
    // Same logic as /trade
    const { tokenID, price, size, side } = req.body;
    const domain = { name: "Polymarket Orderbook", version: "1", chainId: 137 };
    const orderTypes = {
      Order: [
        { name: "tokenID", type: "string" },
        { name: "price", type: "string" },
        { name: "size", type: "string" },
        { name: "side", type: "uint8" }
      ]
    };
    const order = { tokenID, price: price.toString(), size: size.toString(), side: parseInt(side) };
    const signature = await wallet._signTypedData(domain, orderTypes, order);
    
    res.json({ success: true, wallet: wallet.address, order, signature });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`PolyOrder Relay LIVE on port ${PORT}`);
});
