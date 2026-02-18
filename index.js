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
    const { tokenID, price, size, side } = req.body;
    
    // CORRECT Polymarket EIP-712 structure
    const domain = {
      name: "Polymarket Orderbook",
      version: "1",
      chainId: 137,
      verifyingContract: "0x4DCb95b0D1b580b47E6b1E8fD8fE48D624A66F94"  // CHECKSUMMED
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
      tokenID,
      price: price.toString(),
      size: size.toString(),
      side: parseInt(side)
    };
    
    const signature = await wallet._signTypedData(domain, orderTypes, order);
    
    res.json({ 
      success: true, 
      wallet: wallet.address,
      order,
      signature 
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`PolyOrder Relay LIVE on port ${PORT}`);
});
