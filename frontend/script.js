/* =======================================================
   Valentine Proposal — Main Script
   ======================================================= */

// ── Configuration ───────────────────────────────────────
const API_BASE = "https://your-render-bot-url.onrender.com"; // Change to your deployed bot URL for production

// ── URL Parameters ──────────────────────────────────────
const params = new URLSearchParams(window.location.search);
const PROPOSAL_ID = params.get("id");

// ── State (populated from API) ──────────────────────────
let NAME = "My Love";
let PHOTO = "";
let EXPIRY = null;

// ── DOM Elements ────────────────────────────────────────
const expiredPage = document.getElementById("expired-page");
const proposalPage = document.getElementById("proposal-page");
const celebrationPage = document.getElementById("celebration-page");
const heading = document.getElementById("heading");
const noBtn = document.getElementById("no-btn");
const yesBtn = document.getElementById("yes-btn");
const photoSection = document.getElementById("photo-section");
const noPhotoSection = document.getElementById("no-photo-section");
const photoImg = document.getElementById("photo-img");
const musicToggle = document.getElementById("music-toggle");
const bgMusic = document.getElementById("bg-music");
const heartsBg = document.getElementById("hearts-bg");
const particlesEl = document.getElementById("particles");
const buttonsContainer = document.getElementById("buttons-container");

// ── Tooltip messages for the No button ──────────────────
const tooltips = [
  "Are you sure? 🥺",
  "Think again! 🦋",
  "You can't escape love ✨",
  "Wrong button cutie! →",
  "Nope, try again 🙈",
  "Love always finds a way 💜",
  "Not this one! 🌙",
  "Really?? 🫧",
  "The stars say yes 🌟",
  "Click the pretty one! 🫶",
];
let tooltipIndex = 0;

// ── Initialization ──────────────────────────────────────
(async function init() {
  // 1. Fetch proposal data from API using UUID
  if (!PROPOSAL_ID) {
    expiredPage.classList.remove("hidden");
    document.querySelector(".expired-container h1").textContent = "Invalid link";
    document.querySelector(".expired-container p").textContent = "This link doesn't seem right...";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/proposal/${PROPOSAL_ID}`);
    if (!res.ok) throw new Error("Not found");
    const data = await res.json();
    NAME = data.name || "My Love";
    PHOTO = data.photo || "";
    EXPIRY = data.expiry || null;
  } catch (err) {
    expiredPage.classList.remove("hidden");
    document.querySelector(".expired-container h1").textContent = "Link not found 💔";
    document.querySelector(".expired-container p").textContent = "This love link doesn't exist or has been removed.";
    return;
  }

  // 2. Check expiry
  if (EXPIRY && Date.now() > EXPIRY) {
    expiredPage.classList.remove("hidden");
    return;
  }

  // 2. Show proposal page
  proposalPage.classList.remove("hidden");

  // 3. Photo or no-photo
  if (PHOTO) {
    photoSection.classList.remove("hidden");
    photoImg.src = decodeURIComponent(PHOTO);
    spawnPhotoHearts();
  } else {
    noPhotoSection.classList.remove("hidden");
  }

  // 4. Typewriter heading
  typeWriter(`Will you be my Valentine, ${NAME}? 💝`);

  // 5. Start background effects
  startFloatingHearts();
  startSparkles();

  // 6. Setup No button evasion
  setupNoButton();
})();

// ── Typewriter Effect ───────────────────────────────────
function typeWriter(text, speed = 70) {
  let i = 0;
  const cursor = document.createElement("span");
  cursor.className = "typewriter-cursor";
  cursor.innerHTML = "&nbsp;";
  heading.textContent = "";
  heading.appendChild(cursor);

  function type() {
    if (i < text.length) {
      heading.insertBefore(
        document.createTextNode(text.charAt(i)),
        cursor
      );
      i++;
      setTimeout(type, speed);
    } else {
      // Remove cursor after typing is done (delayed)
      setTimeout(() => cursor.remove(), 2000);
    }
  }
  type();
}

// ── Floating Elements Background ────────────────────────
function startFloatingHearts() {
  const cuteThings = ["✨", "🦋", "🌸", "💫", "⭐", "🪽", "🤍", "💜", "🫧", "🌙", "💗", "🌷"];
  const isMobile = window.innerWidth <= 768;
  const interval = isMobile ? 1000 : 600;
  const lifetime = isMobile ? 10000 : 14000;
  setInterval(() => {
    const el = document.createElement("div");
    el.className = "floating-heart";
    el.textContent = cuteThings[Math.floor(Math.random() * cuteThings.length)];
    el.style.left = Math.random() * 100 + "%";
    el.style.fontSize = (isMobile ? Math.random() * 10 + 10 : Math.random() * 16 + 12) + "px";
    el.style.animationDuration = Math.random() * 7 + 7 + "s";
    el.style.opacity = Math.random() * 0.3 + 0.15;
    heartsBg.appendChild(el);
    setTimeout(() => el.remove(), lifetime);
  }, interval);
}

// ── Sparkle Particles (multi-color + stars) ────────────
function startSparkles() {
  const sparkleTypes = ["pink", "purple", "gold", "blue"];
  const isMobile = window.innerWidth <= 768;
  const count = isMobile ? 12 : 25;
  const starCount = isMobile ? 5 : 12;
  for (let i = 0; i < count; i++) {
    const s = document.createElement("div");
    const type = sparkleTypes[Math.floor(Math.random() * sparkleTypes.length)];
    s.className = `sparkle ${type}`;
    s.style.left = Math.random() * 100 + "%";
    s.style.top = Math.random() * 100 + "%";
    s.style.animationDelay = Math.random() * 3 + "s";
    s.style.animationDuration = Math.random() * 2 + 2 + "s";
    particlesEl.appendChild(s);
  }
  // Add tiny star sparkles
  for (let i = 0; i < starCount; i++) {
    const star = document.createElement("div");
    star.className = "sparkle star";
    star.textContent = "✦";
    star.style.left = Math.random() * 100 + "%";
    star.style.top = Math.random() * 100 + "%";
    star.style.animationDelay = Math.random() * 4 + "s";
    star.style.color = ["#f9a8d4", "#c4b5fd", "#fde68a", "#93c5fd"][i % 4];
    particlesEl.appendChild(star);
  }
}

// ── Photo Orbiting Hearts ───────────────────────────────
function spawnPhotoHearts() {
  const container = document.getElementById("photo-hearts");
  const miniHearts = ["✨", "🦋", "💫", "🌸", "⭐", "💜"];
  for (let i = 0; i < 6; i++) {
    const h = document.createElement("span");
    h.className = "mini-heart";
    h.textContent = miniHearts[i % miniHearts.length];
    h.style.animationDelay = (i * 0.6) + "s";
    h.style.top = "50%";
    h.style.left = "50%";
    container.appendChild(h);
  }
}

// ── Music Toggle ────────────────────────────────────────
let musicPlaying = false;
musicToggle.addEventListener("click", () => {
  if (musicPlaying) {
    bgMusic.pause();
    musicToggle.classList.add("muted");
    musicToggle.textContent = "🔇";
  } else {
    bgMusic.volume = 0.4;
    bgMusic.play().catch(() => {});
    musicToggle.classList.remove("muted");
    musicToggle.textContent = "🎵";
  }
  musicPlaying = !musicPlaying;
});

// ══════════════════════════════════════════════════════════
//  NO BUTTON — EVASION LOGIC (desktop + mobile)
// ══════════════════════════════════════════════════════════
function setupNoButton() {
  let escapeCount = 0;
  const isMobile = window.innerWidth <= 768;

  // Helper: move button to random safe position
  function evade() {
    escapeCount++;
    // Cycle tooltip
    noBtn.setAttribute("data-tooltip", tooltips[escapeCount % tooltips.length]);
    noBtn.classList.add("show-tooltip");
    setTimeout(() => noBtn.classList.remove("show-tooltip"), 1200);

    // Randomly shrink / rotate / vanish
    const effect = Math.random();
    if (effect < 0.3) {
      noBtn.classList.add("shrink");
      setTimeout(() => noBtn.classList.remove("shrink"), 400);
    } else if (effect < 0.5) {
      noBtn.classList.add("vanish");
      setTimeout(() => noBtn.classList.remove("vanish"), 600);
    }

    // Move to random position within viewport (safe bounds)
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const btnW = noBtn.offsetWidth || 120;
    const btnH = noBtn.offsetHeight || 50;
    const pad = isMobile ? 10 : 20;
    const maxX = Math.max(pad, vw - btnW - pad);
    const maxY = Math.max(pad + 50, vh - btnH - pad); // 50px top offset for music btn
    const newX = Math.max(pad, Math.floor(Math.random() * maxX));
    const newY = Math.max(pad + 50, Math.floor(Math.random() * maxY));

    noBtn.style.position = "fixed";
    noBtn.style.left = newX + "px";
    noBtn.style.top = newY + "px";
    noBtn.style.zIndex = "999";
    noBtn.style.transition = "all 0.25s cubic-bezier(.4,0,.2,1)";
    noBtn.style.width = "auto";
    noBtn.style.maxWidth = "none";

    // Grow YES button slightly over time (cap lower on mobile)
    const maxScale = isMobile ? 1.4 : 1.8;
    const scale = Math.min(1 + escapeCount * 0.05, maxScale);
    yesBtn.style.transform = `scale(${scale})`;
  }

  // Desktop — mouse hover
  noBtn.addEventListener("mouseenter", (e) => {
    e.preventDefault();
    evade();
  });

  // Desktop — click fallback
  noBtn.addEventListener("click", (e) => {
    e.preventDefault();
    evade();
  });

  // Mobile — touch
  noBtn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    evade();
  }, { passive: false });

  // Initial tooltip
  noBtn.setAttribute("data-tooltip", tooltips[0]);
}

// ══════════════════════════════════════════════════════════
//  YES — CELEBRATION
// ══════════════════════════════════════════════════════════
function sayYes() {
  // Hide proposal, show celebration
  proposalPage.classList.add("hidden");
  celebrationPage.classList.remove("hidden");

  // Set celebration text
  const celebHeading = document.getElementById("celeb-heading");
  typeWriterElement(celebHeading, `Yay!! You made my day, ${NAME}! 🎉💖`);

  // Photo in celebration
  if (PHOTO) {
    const celebPhotoSection = document.getElementById("celeb-photo-section");
    const celebPhoto = document.getElementById("celeb-photo");
    celebPhotoSection.classList.remove("hidden");
    celebPhoto.src = decodeURIComponent(PHOTO);
  }

  // Launch confetti
  launchConfetti();

  // Heart burst from center
  heartBurst();

  // Play music
  if (!musicPlaying) {
    bgMusic.volume = 0.4;
    bgMusic.play().catch(() => {});
    musicPlaying = true;
  }
}

function typeWriterElement(el, text, speed = 60) {
  let i = 0;
  el.textContent = "";
  function type() {
    if (i < text.length) {
      el.textContent += text.charAt(i);
      i++;
      setTimeout(type, speed);
    }
  }
  type();
}

// ── Confetti ────────────────────────────────────────────
function launchConfetti() {
  const canvas = document.getElementById("confetti-canvas");
  const colors = [
    "#f9a8d4", "#c4b5fd", "#93c5fd", "#fde68a",
    "#fbcfe8", "#ddd6fe", "#bfdbfe", "#fef3c7",
    "#e9d5ff", "#a5b4fc", "#f0abfc", "#fda4af",
  ];
  const shapes = ["✦", "●", "✨", "♡", "★", "◆", "🦋"];

  function burst() {
    for (let i = 0; i < 80; i++) {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";
      piece.textContent = shapes[Math.floor(Math.random() * shapes.length)];
      piece.style.left = Math.random() * 100 + "%";
      piece.style.color = colors[Math.floor(Math.random() * colors.length)];
      piece.style.fontSize = Math.random() * 14 + 8 + "px";
      piece.style.animationDuration = Math.random() * 3 + 2 + "s";
      piece.style.animationDelay = Math.random() * 2 + "s";
      canvas.appendChild(piece);
      setTimeout(() => piece.remove(), 6000);
    }
  }

  burst();
  // Multiple bursts
  setTimeout(burst, 1500);
  setTimeout(burst, 3000);
  // Continuous gentle confetti
  setInterval(() => {
    for (let i = 0; i < 10; i++) {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";
      piece.textContent = shapes[Math.floor(Math.random() * shapes.length)];
      piece.style.left = Math.random() * 100 + "%";
      piece.style.color = colors[Math.floor(Math.random() * colors.length)];
      piece.style.fontSize = Math.random() * 10 + 6 + "px";
      piece.style.animationDuration = Math.random() * 4 + 3 + "s";
      canvas.appendChild(piece);
      setTimeout(() => piece.remove(), 7000);
    }
  }, 4000);
}

// ── Heart Burst from Center ─────────────────────────────
function heartBurst() {
  const container = document.getElementById("floating-hearts-celeb");
  const hearts = ["✨", "🦋", "💫", "🌸", "⭐", "💜", "🤍", "🫧", "🌙", "💗", "🌷", "🪽"];
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;

  for (let i = 0; i < 30; i++) {
    const h = document.createElement("div");
    h.className = "burst-heart";
    h.textContent = hearts[Math.floor(Math.random() * hearts.length)];
    h.style.left = cx + "px";
    h.style.top = cy + "px";

    const angle = (Math.PI * 2 * i) / 30;
    const dist = Math.random() * 300 + 150;
    h.style.setProperty("--tx", Math.cos(angle) * dist + "px");
    h.style.setProperty("--ty", Math.sin(angle) * dist + "px");
    h.style.animationDelay = Math.random() * 0.5 + "s";

    container.appendChild(h);
    setTimeout(() => h.remove(), 3000);
  }

  // Second wave
  setTimeout(() => {
    for (let i = 0; i < 20; i++) {
      const h = document.createElement("div");
      h.className = "burst-heart";
      h.textContent = hearts[Math.floor(Math.random() * hearts.length)];
      h.style.left = cx + "px";
      h.style.top = cy + "px";
      const angle = (Math.PI * 2 * i) / 20;
      const dist = Math.random() * 400 + 200;
      h.style.setProperty("--tx", Math.cos(angle) * dist + "px");
      h.style.setProperty("--ty", Math.sin(angle) * dist + "px");
      container.appendChild(h);
      setTimeout(() => h.remove(), 3000);
    }
  }, 800);
}

// ── Share Button ────────────────────────────────────────
function shareLink() {
  const url = window.location.href;
  if (navigator.share) {
    navigator.share({
      title: "Be My Valentine! 💝",
      text: `${NAME}, will you be my Valentine?`,
      url: url,
    }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      const btn = document.querySelector(".share-btn");
      btn.textContent = "Copied! ✅";
      setTimeout(() => (btn.textContent = "Share 💌"), 2000);
    });
  } else {
    prompt("Copy this link:", url);
  }
}
