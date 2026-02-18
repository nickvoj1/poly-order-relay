#!/usr/bin/env node
/**
 * poly-order-relay/index.js
 * CommonJS app with ESM-safe dynamic import for @polymarket/clob-client
 */

const express = require("express");
const { Wallet } = require("ethers");

const app = express();
const PORT = process.env.PORT || 3000;
const CLOB_HOST = "https://clob.polymarket.com";
const CHAIN_ID = 137;

const RELAY_SECRET = process.env.RELAY_SECRET || "";
const PRIVATE_KEY = process.env.POLYMARKET_PRIVATE_KEY || "";
const PROXY_WALLET_ADDRESS = process.env.PROXY_WALLET_ADDRESS || "";
const POLYMARKET_API_KEY = process.env.POLYMARKET_API_KEY || "";
const POLYMARKET_API_SECRET = process.env.POLYMARKET_API_SECRET || "";
const POLYMARKET_PASSPHRASE = process.env.POLYMARKET_PASSPHRASE || "";

app.use(express.json({ limit: "1mb" }));

// Protect all routes except /health
app.use((req, res, next) => {
  if (req.path === "/health") return next();
  if (RELAY_SECRET && req.headers["x-relay-secret"] !== RELAY_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

let clobModPromise = null;
async function getClobModule() {
  if (!clobModPromise) clobModPromise = import("@polymarket/clob-client");
  return clobModPromise;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeTokenIdForClient(tokenId) {
  const raw = String(tokenId || "").trim();
  if (!raw) return raw;
  // clob-client expects decimal tokenID string
  if (raw.startsWith("0x")) return BigInt(raw).toString(10);
  return raw;
}

function normalizeOrderType(orderType, OrderType) {
  const t = String(orderType || "FAK").toUpperCase();
  if (t === "FOK") return OrderType.FOK;
  return OrderType.FAK;
}

function roundToTick(price, tick) {
  const p = Number(price);
  const t = Number(tick) || 0.01;
  if (!Number.isFinite(p)) return 0.5;
  const rounded = Math.round(p / t) * t;
  return Math.max(t, Math.min(1 - t, Number(rounded.toFixed(6))));
}

let cachedClient = null;
let cachedClientKey = null;

async function getAuthedClient() {
  const mod = await getClobModule();
  const ClobClient = mod.ClobClient || mod.default?.ClobClient;
  if (!ClobClient) throw new Error("clob-client export ClobClient missing");
  if (!PRIVATE_KEY) throw new Error("POLYMARKET_PRIVATE_KEY not set");

  const wallet = new Wallet(PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`);
  const funder = PROXY_WALLET_ADDRESS || wallet.address;
  const sigType = PROXY_WALLET_ADDRESS ? 2 : 0;

  const key = JSON.stringify({
    pk: PRIVATE_KEY.slice(0, 8),
    funder,
    hasCreds: !!(POLYMARKET_API_KEY && POLYMARKET_API_SECRET && POLYMARKET_PASSPHRASE),
  });

  if (cachedClient && cachedClientKey === key) return cachedClient;

  if (POLYMARKET_API_KEY && POLYMARKET_API_SECRET && POLYMARKET_PASSPHRASE) {
    cachedClient = new ClobClient(
      CLOB_HOST,
      CHAIN_ID,
      wallet,
      { key: POLYMARKET_API_KEY, secret: POLYMARKET_API_SECRET, passphrase: POLYMARKET_PASSPHRASE },
      sigType,
      funder
    );
    cachedClientKey = key;
    return cachedClient;
  }

  const initClient = new ClobClient(CLOB_HOST, CHAIN_ID, wallet, undefined, sigType, funder);
  let creds;
  try {
    creds = await initClient.deriveApiKey();
  } catch {
    creds = await initClient.createOrDeriveApiKey();
  }

  cachedClient = new ClobClient(
    CLOB_HOST,
    CHAIN_ID,
    wallet,
    { key: creds.apiKey, secret: creds.secret, passphrase: creds.passphrase },
    sigType,
    funder
  );
  cachedClientKey = key;
  return cachedClient;
}

async function executeTradeCore({ tokenId, side, amount, size, price, orderType }) {
  const mod = await getClobModule();
  const Side = mod.Side || mod.default?.Side;
  const OrderType = mod.OrderType || mod.default?.OrderType;
  if (!Side || !OrderType) throw new Error("clob-client enum exports missing");

  if (!tokenId || !side || (!amount && !size)) {
    return { status: 400, body: { success: false, submitted: false, error: "Missing: tokenId, side, amount/size" } };
  }

  const client = await getAuthedClient();
  const tokenID = normalizeTokenIdForClient(tokenId);
  const qty = Math.max(5, Number(amount || size));
  if (!Number.isFinite(qty) || qty <= 0) {
    return { status: 400, body: { success: false, submitted: false, error: "Invalid size/amount" } };
  }

  let tickSize = 0.01;
  try {
    const book = await client.getOrderBook(tokenID);
    tickSize = Number(book?.market?.minimum_tick_size || 0.01);
  } catch {}

  let tradePrice = Number(price);
  if (!Number.isFinite(tradePrice) || tradePrice <= 0 || tradePrice >= 1) {
    try {
      const mid = await client.getMidpoint(tokenID);
      tradePrice = Number(mid);
    } catch {
      tradePrice = 0.5;
    }
  }
  const finalPrice = roundToTick(tradePrice, tickSize);

  const tradeSide = String(side).toUpperCase() === "BUY" ? Side.BUY : Side.SELL;
  const oType = normalizeOrderType(orderType, OrderType);

  let lastError = "unknown";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await client.createAndPostMarketOrder(
        { tokenID, size: Number(qty.toFixed(2)), price: finalPrice, side: tradeSide },
        undefined,
        oType
      );

      if (result?.success) {
        return {
          status: 200,
          body: {
            success: true,
            submitted: true,
            orderID: result.orderID || result.order_id || null,
            data: result,
            finalPrice,
            tickSize: String(tickSize),
            attempt,
          },
        };
      }

      lastError = result?.error || result?.errorMsg || "Order rejected";
    } catch (e) {
      lastError = e?.message || String(e);
    }
    if (attempt < 3) await sleep(400);
  }

  return {
    status: 400,
    body: {
      success: false,
      submitted: false,
      error: lastError,
      finalPrice,
      tickSize: String(tickSize),
    },
  };
}

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    ts: Date.now(),
    hasWallet: !!PRIVATE_KEY,
    hasProxy: !!PROXY_WALLET_ADDRESS,
    hasL2Creds: !!(POLYMARKET_API_KEY && POLYMARKET_API_SECRET && POLYMARKET_PASSPHRASE),
  });
});

// Preferred route
app.post("/trade", async (req, res) => {
  try {
    const out = await executeTradeCore(req.body || {});
    return res.status(out.status).json(out.body);
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

// Legacy route:
// 1) {order, headers} => forward pre-signed order to CLOB
// 2) {tokenId, side, size, price} => execute like /trade
app.post("/order", async (req, res) => {
  try {
    const { order, headers } = req.body || {};
    if (order && headers) {
      const resp = await fetch(`${CLOB_HOST}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(order),
      });
      const text = await resp.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
      return res.status(resp.status).json({
        success: resp.ok,
        status: resp.status,
        data,
        orderID: data?.orderID || null,
      });
    }

    const out = await executeTradeCore(req.body || {});
    return res.status(out.status).json(out.body);
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

app.post("/proxy", async (req, res) => {
  try {
    const { url, method = "POST", headers = {}, body } = req.body || {};
    if (!url) return res.status(400).json({ error: "Missing 'url'" });

    const resp = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
    });

    const text = await resp.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    return res.status(resp.status).json({ success: resp.ok, status: resp.status, data });
  } catch (e) {
    return res.status(502).json({ error: e?.message || String(e) });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Relay up on 0.0.0.0:${PORT}`);
});
