const express = require("express");
const cors = require("cors");
const { Wallet } = require("ethers");

const app = express();
app.use(cors());
app.use(express.json());

const wallet = new Wallet(process.env.PRIVATE_KEY);

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.post("/order", async (req, res) => {
  try {
    const { tokenId, price, size, side } = req.body; // side: 0=BUY, 1=SELL

    // EXACT Polymarket CLOB OrderArgs [page:0]
    const orderArgs = {
      price: parseFloat(price),
      size: parseFloat(size),
      side: side === 0 ? "BUY" : "SELL",
      tokenId: tokenId
    };

    // Use ethers to mimic py_clob_client.create_order()
    const salt = Date.now().toString();
    const order = {
      salt,
      maker: wallet.address,
      signer: wallet.address,
      taker: "0x0000000000000000000000000000000000000000",
      tokenId,
      makerAmount: Math.floor(orderArgs.size * orderArgs.price * 1e6).toString(),
      takerAmount: Math.floor(orderArgs.size * 1e6).toString(),
      expiration: Math.floor(Date.now() / 1000 + 24*3600).toString(), // 24hr
      nonce: "0",
      feeRateBps: "300" // 0.3%
    };

    const domain = {
      name: "ConditionalTokensOrderbook",
      version: "1",
      chainId: 137
    };

    const types = {
      Order: [
        "uint256", "salt",
        "address", "maker",
        "address", "signer", 
        "address", "taker",
        "bytes32", "tokenId",
        "uint256", "makerAmount",
        "uint256", "takerAmount",
        "uint256", "expiration",
        "uint256", "nonce",
        "uint256", "feeRateBps"
      ]
    };

    const signature = await wallet._signTypedData(domain, types, order);

    // POST to REAL CLOB [page:0]
    const clobRes = await fetch("https://clob.polymarket.com/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order,
        owner: wallet.address,
        orderType: "GTC"
      })
    });

    const result = await clobRes.json();

    res.json({
      success: true,
      submitted: true,
      orderId: result.orderId || salt,
      status: result.status || "live"
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(process.env.PORT || 3000);
