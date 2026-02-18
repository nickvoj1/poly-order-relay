const express = require("express");
const { ClobClient, Side, OrderType } = require("@polymarket/clob-client");
const { Wallet } = require("ethers");

const app = express();
app.use(express.json());

app.post("/order", async (req, res) => {
  try {
    const { tokenId, side, price, size, orderType } = req.body;

    const signer = new Wallet(process.env.POLYMARKET_PRIVATE_KEY);
    const client = new ClobClient(
      "https://clob.polymarket.com",
      137,
      signer
    ); // basic auth via private key[web:18][web:32]

    const response = await client.createAndPostOrder({
      tokenID: tokenId,
      price,
      size,
      side: side === "BUY" ? Side.BUY : Side.SELL,
      orderType: OrderType[orderType || "GTC"],
    });[web:19][web:34]

    res.json({ success: true, response });
  } catch (e) {
    console.error("order error", e);
    res.status(500).json({ success: false, error: e.message || "unknown" });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(process.env.PORT || 3000, () =>
  console.log("poly-order-relay listening")
);
