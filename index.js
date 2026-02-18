const express = require("express");
const { ethers } = require("ethers");

const app = express();
app.use(express.json());

const PRIVATE_KEY = process.env.POLYMARKET_PRIVATE_KEY;
const wallet = new ethers.Wallet(PRIVATE_KEY);

app.get("/health", (req, res) => res.json({ ok: true }));

app.post("/trade", async (req, res) => {
  try {
    const params = req.body;
    
    // Manual Polymarket order signing
    const domain = {
      name: 'Polymarket Order',
      version: '1',
      chainId: 137,
      verifyingContract: '0x4dCb95b0D1b580b47E6b1E8fD8fE48D624A66F94'
    };
    
    const order = {
      tokenID: params.tokenID,
      price: params.price,
      size: params.size,
      side: params.side
    };
    
    const signature = await wallet._signTypedData(domain, order);
    
    res.json({ 
      success: true, 
      order,
      signature,
      wallet: wallet.address 
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`PolyOrder Relay LIVE on port ${PORT}`);
});
