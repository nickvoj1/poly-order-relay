const express = require("express");
const cors = require("cors");
const { Wallet } = require("ethers");

const app = express();
app.use(cors());
app.use(express.json());

let wallet;
try {
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY missing");
  wallet = new Wallet(process.env.PRIVATE_KEY);
  console.log(`Wallet ready: ${wallet.address}`);
} catch (e) {
  console.error("Wallet init failed:", e.message);
}

app.get("/health", (req, res) => 
  res.json({ 
    status: "ok", 
    timestamp: Date.now(),
    wallet: wallet ? wallet.address : null 
  })
);

app.post("/order", async (req, res) => {
  try {
    if (!wallet) return res.status(500).json({ error: "Wallet not initialized" });

    const { tokenId, price, size, side } = req.body; // side: 0=BUY, 1=SELL
    if (!tokenId || !price || !size) throw new Error("Missing params");

    const orderSalt = BigInt(Date.now());
    const expiration = BigInt(Math.floor(Date.now() / 1000) + 86400); // 24h

    // Polymarket CLOB Order [web:18]
    const order = {
      salt: orderSalt.toString(),
      maker: wallet.address,
      signer: wallet.address,
      taker: "0x0000000000000000000000000000000000000000",
      tokenId,
      makerAmount: (BigInt(Math.floor(parseFloat(size) * parseFloat(price) * 1e6))).toString(),
      takerAmount: (BigInt(Math.floor(parseFloat(size) * 1e6))).toString(),
      expiration: expiration.toString(),
      nonce: "0",
      feeRateBps: "300"
    };

    const domain = {
      name: "ConditionalTokensOrderbook",
      version: "1",
      chainId: 137
    };

    const types = {
      Order: [
        { name: "salt", type: "uint256" },
        { name: "maker", type: "address" },
        { name: "signer", type: "address" },
        { name: "taker", type: "address" },
        { name: "tokenId", type: "bytes32" },
        { name: "makerAmount", type: "uint256" },
        { name: "takerAmount", type: "uint256" },
        { name: "expiration", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "feeRateBps", type: "uint256" }
      ]
    };

    const signature = await wallet.signTypedData(domain, types, order);[web:27][web:33]

    // Submit to CLOB [web:18]
    const clobRes = await fetch("https://clob.polymarket.com/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order, signature, orderType: "GTC" })
    });

    const result = await clobRes.json();

    if (result.success !== true) {
      throw new Error(result.errorMsg || `CLOB error: ${clobRes.status}`);
    }

    res.json({ success: true, orderId: result.orderId, status: "live" });
  } catch (e) {
    console.error("Order failed:", e);
    res.status(500).json({ error: e.message });
  }
});

// Railway bind [web:26]
const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`🚀 Poly Order Relay live on ${port}`);
});
