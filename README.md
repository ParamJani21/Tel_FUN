# 💝 Valentine Proposal Website Generator

A romantic, interactive website where someone asks another person to be their Valentine — with a mischievous twist: **the "No" button is impossible to click!** A Telegram bot generates personalized links.

---

## 📁 Project Structure

```
SECREAT/
├── frontend/            ← Static website (deploy to Vercel/Netlify/GitHub Pages)
│   ├── index.html
│   ├── style.css
│   └── script.js
│
├── bot/                 ← Telegram bot (deploy to Render/Railway)
│   ├── bot.js
│   ├── package.json
│   ├── .env.example
│   └── .gitignore
│
└── README.md
```

---

## 🌐 Frontend — How It Works

The website uses UUID-based links for privacy — no personal data in the URL:

| Parameter | Example                              | Purpose              |
|-----------|--------------------------------------|----------------------|
| `id`      | `?id=a1b2c3d4-e5f6-...`             | Unique proposal UUID |

The frontend fetches name, photo, and expiry from the bot's API using this UUID.

### Features
- **Typewriter heading** — "Will you be my Valentine, {Name}? 💝"
- **Animated background** — floating hearts, sparkle particles, gradient shift
- **NO button evasion** — runs away on hover, shrinks/vanishes on click, shifts on mobile touch, shows funny tooltips
- **YES celebration** — confetti burst, heart explosion, glowing screen, romantic message
- **Photo support** — displayed in a heart-shaped frame with orbiting hearts
- **No-photo fallback** — pulsing animated heart
- **Expiry check** — shows "This love link has expired 💔" if past timestamp
- **Music toggle** — optional background music
- **Share button** — native share API or clipboard copy
- **Fully responsive** — works on desktop and mobile

### Configuration
Edit the `API_BASE` variable in `frontend/script.js` to point to your deployed bot server URL.

### Test Locally
Start the bot server first (`cd bot && npm start`), then open:
```
http://localhost:5500/index.html?id=<uuid-from-bot>
```

---

## 🤖 Telegram Bot — Setup

### 1. Create a Bot
1. Open Telegram, search for **@BotFather**
2. Send `/newbot`, follow prompts
3. Copy the **bot token**

### 2. Configure
```bash
cd bot
cp .env.example .env
```
Edit `.env`:
```
BOT_TOKEN=123456:ABC-DEF...
FRONTEND_URL=https://your-valentine-site.vercel.app
PORT=3000
SERVER_URL=https://your-bot-server.onrender.com
```

### 3. Install & Run
```bash
cd bot
npm install
npm start
```

### Bot Commands
| Command   | Description                                  |
|-----------|----------------------------------------------|
| `/start`  | Welcome message with instructions            |
| `/create` | Start creating a new proposal (3-step flow)  |
| `/help`   | Show available commands                      |

### Bot Flow
1. `/create` → Bot asks for **name**
2. Bot asks for **photo** (send image or type "skip")
3. Bot asks for **expiry** (hours, or 0 for no expiry)
4. Bot generates and sends the **personalized link** 💌

---

## ⏳ How Expiry Works

1. When creating a link, the user specifies hours (e.g., `24`)
2. Bot calculates: `expiry = Date.now() + hours * 3600000`
3. Expiry stored in the database alongside name & photo
4. Frontend fetches data via API using the UUID from the URL
5. JavaScript checks: `if (Date.now() > expiry)` → show expired page
6. If `0` hours → no expiry → link lives forever

---

## 🚀 Deployment (100% Free)

### Frontend → Vercel (Recommended)

1. Push `frontend/` folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → Import project
3. Set **Root Directory** to `frontend`
4. Framework Preset: **Other**
5. Deploy! You'll get a URL like `https://valentine-xyz.vercel.app`

**Alternative: Netlify**
1. Drag & drop the `frontend/` folder at [app.netlify.com/drop](https://app.netlify.com/drop)
2. Get your URL instantly

**Alternative: GitHub Pages**
1. Push to GitHub
2. Settings → Pages → Source: `main` branch, `/frontend` folder
3. URL: `https://username.github.io/repo-name/`

### Bot → Render (Recommended)

1. Push `bot/` folder to a GitHub repo
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect GitHub repo
4. Settings:
   - **Root Directory:** `bot`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Add environment variables from `.env`
6. Deploy on free tier!

**Alternative: Railway**
1. [railway.app](https://railway.app) → New Project → GitHub
2. Same setup as Render

---

## 🎨 Customization Ideas

- Change colors in `style.css` (search for `#ff1493`, `#ff69b4`)
- Edit tooltip messages in `script.js` → `tooltips` array
- Replace background music URL in `index.html`
- Add more celebration effects in the `sayYes()` function
- Customize the expired page message

---

## 🛠️ Tech Stack

| Component | Technology        |
|-----------|-------------------|
| Frontend  | HTML, CSS, Vanilla JS |
| Bot       | Node.js, Telegraf |
| Database  | SQLite (better-sqlite3) |
| Hosting   | Vercel + Render (free) |

---

## 💡 Tips

- The **NO button** uses `mouseenter`, `click`, and `touchstart` events to evade all interaction attempts
- The **YES button grows bigger** each time the NO button is dodged
- The photo is downloaded and stored on the bot server — set `SERVER_URL` to the public URL of your bot deployment
- For production, consider using a cloud image host (Cloudinary free tier) instead of local uploads

---

Made with ❤️ for Valentine's Day
