/* =====================================================================
   MINI GAME — Endless Runner (Chrome "no internet" dino style)
   Pure Canvas + vanilla JS, no external libraries, works on
   desktop (keyboard) and mobile (touch).

   Note: there is no official embeddable version of Google's own
   dino game (chrome://dino isn't reachable from a regular webpage,
   and Google doesn't publish a hosted iframe-able copy of it), so
   this is a self-built equivalent with the same feel.
===================================================================== */

/* =====================================================================
   ✏️ IMAGE CONFIGURATION — put your own PNGs here
   -----------------------------------------------------------------
   1) Add your PNG files anywhere inside your project folder, e.g. in
      a new "assets" folder next to index.html:
        assets/my-dino.png
        assets/cactus-1.png
        assets/cactus-2.png

   2) Point the constants below at those file paths. Paths are
      relative to index.html.

   3) Leave a value as "" (empty string) to use the built-in drawn
      fallback shape instead — so the game always works even before
      you add images.

   RUNNER_IMG_SRC    -> single image for the player character
   OBSTACLE_IMG_SRCS -> array of one or more obstacle images;
                        the game randomly picks one per obstacle
===================================================================== */
const RUNNER_IMG_SRC = "assets/dino.png";
const OBSTACLE_IMG_SRCS = ["assets/cactus.png"];

// Real pixel dimensions of the two images above, used to keep their
// aspect ratio correct in-game instead of stretching them. If you
// swap in your own images with different proportions, update these
// two ratios (width / height) to match.
const RUNNER_ASPECT = 1176 / 1337;   // ~0.88
const OBSTACLE_ASPECT = 729 / 1205;  // ~0.60

// The source PNGs have some transparent padding around the actual
// figure, which makes them look like they're floating above the
// ground line. This nudges the drawn image down a bit (visual only —
// it doesn't affect jump physics) so they sit on the line.
// Increase/decrease these to fine-tune if you swap in new images.
const RUNNER_Y_OFFSET = 18;
const OBSTACLE_Y_OFFSET = 22;

// Pre-measured "trim boxes" — where the actual non-transparent artwork
// sits inside each PNG's full canvas, as fractions (0..1) of that
// image's own width/height. These were measured directly from the
// dino.png / cactus.png pixel data, so collision only counts the
// visible drawing, not the transparent padding around it.
//
// NOTE: this is computed ahead of time (not in the browser) because
// when a page is opened directly as a local file (double-clicking
// index.html, file:// in the address bar) browsers block JavaScript
// from reading image pixel data for security reasons, which silently
// breaks any in-browser auto-trim attempt. Hard-coding the measured
// box here means accurate hitboxes work everywhere — double-clicked
// locally or hosted on GitHub Pages — no exceptions.
//
// If you swap in new images with very different proportions, you can
// re-measure these (crop tool / "trim" in any image editor against
// the transparent edges) and update the four numbers below.
const RUNNER_TRIM = { x: 0.2049, y: 0.1174, w: 0.4915, h: 0.6911 };
const OBSTACLE_TRIM = { x: 0.1674, y: 0.1112, w: 0.6680, h: 0.7685 };

/* =====================================================================
   SETUP
===================================================================== */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("gameOverlay");
const overlayText = document.getElementById("gameOverlayText");
const scoreEl = document.getElementById("gameScore");
const bestEl = document.getElementById("gameBest");

// Logical (design-resolution) game size — the canvas is scaled to
// this internally and stretched to fill the responsive CSS box via
// devicePixelRatio handling in resizeCanvas().
const WORLD_W = 800;
const WORLD_H = 320;
const GROUND_Y = WORLD_H - 40;

let dpr = Math.max(1, window.devicePixelRatio || 1);

function resizeCanvas() {
  dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  // Map drawing commands from WORLD coordinates to the actual pixel size.
  const scale = (rect.width / WORLD_W) * dpr;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}

window.addEventListener("resize", resizeCanvas);

/* =====================================================================
   LOAD IMAGES (optional — falls back to drawn shapes if unset/fails)
   -----------------------------------------------------------------
   PNG files usually have a chunk of fully-transparent padding around
   the actual drawn figure. If we used the raw image rectangle for
   collision, the player/obstacle would appear to lose "in mid-air" —
   touching invisible transparent pixels. To fix that, once an image
   finishes loading we scan its pixels and compute a tight bounding
   box around the non-transparent content ("alpha trim"). All
   collision checks then use that trimmed box, scaled to the entity's
   on-screen size, so hits only register against what's actually
   visible.
===================================================================== */
function loadImage(src) {
  if (!src) return null;
  const img = new Image();
  img.src = src;
  return img;
}

const runnerImg = loadImage(RUNNER_IMG_SRC);
const obstacleImgs = OBSTACLE_IMG_SRCS.map(loadImage).filter(Boolean);

function imageIsReady(img) {
  return img && img.complete && img.naturalWidth > 0;
}

/* =====================================================================
   GAME STATE
===================================================================== */
const GROUND_LINE_Y = GROUND_Y;

const PLAYER_H = 128;
const player = {
  x: 60,
  y: GROUND_LINE_Y - PLAYER_H,
  w: PLAYER_H * RUNNER_ASPECT,
  h: PLAYER_H,
  vy: 0,
  isJumping: false,
};

const GRAVITY = 2100;       // px/s^2 (world units) — slightly lower = more hang time
const JUMP_VELOCITY = -900; // px/s — higher jump, easier to clear obstacles

let obstacles = [];
let speed = 360;            // world px/s, increases over time
let spawnTimer = 0;
let nextSpawnIn = 1.1;
let score = 0;
let best = Number(localStorage.getItem("runnerBestScore") || 0);
let elapsed = 0;
let running = false;
let gameOver = false;
let rafId = null;
let lastTime = 0;

bestEl.textContent = String(best);

/* =====================================================================
   RESET / START
===================================================================== */
function resetGame() {
  player.y = GROUND_LINE_Y - player.h;
  player.vy = 0;
  player.isJumping = false;
  obstacles = [];
  speed = 360;
  spawnTimer = 0;
  nextSpawnIn = 1.1;
  score = 0;
  elapsed = 0;
  gameOver = false;
  scoreEl.textContent = "0";
}

function startGame() {
  resetGame();
  running = true;
  overlay.classList.add("is-hidden");
  lastTime = performance.now();
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

function endGame() {
  running = false;
  gameOver = true;
  if (score > best) {
    best = score;
    localStorage.setItem("runnerBestScore", String(best));
    bestEl.textContent = String(best);
  }
  overlayText.textContent = `Game over — score ${score}. Tap to retry`;
  overlay.classList.remove("is-hidden");
}

/* =====================================================================
   INPUT — jump on Space/ArrowUp, or tap/click on the canvas/overlay.
   The same handler also (re)starts the game when idle or over.
===================================================================== */
function handleJumpOrStart() {
  if (!running) {
    startGame();
    return;
  }
  if (!player.isJumping) {
    player.vy = JUMP_VELOCITY;
    player.isJumping = true;
  }
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp") {
    e.preventDefault();
    handleJumpOrStart();
  }
});

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  handleJumpOrStart();
});

overlay.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  handleJumpOrStart();
});

/* =====================================================================
   OBSTACLE SPAWNING
===================================================================== */
function spawnObstacle() {
  const h = 92 + Math.random() * 44;
  const w = h * OBSTACLE_ASPECT;
  const img = obstacleImgs.length
    ? obstacleImgs[Math.floor(Math.random() * obstacleImgs.length)]
    : null;

  obstacles.push({
    x: WORLD_W + 20,
    y: GROUND_LINE_Y - h,
    w,
    h,
    img,
    passed: false,
  });
}

/* =====================================================================
   COLLISION BOX HELPER
   -----------------------------------------------------------------
   Returns the rectangle that should actually be used for hit-testing
   a given entity (player or obstacle). If the entity's image has a
   computed alpha-trim box, that tight box (scaled to the entity's
   on-screen w/h, and shifted by the same Y offset used when drawing)
   is used — so only the visible pixels count. Otherwise we fall back
   to a modestly shrunken version of the full rectangle, for the
   built-in drawn fallback shapes or images that couldn't be scanned.
===================================================================== */
function getCollisionBox(entity, trim, yOffset) {
  if (trim) {
    return {
      x: entity.x + trim.x * entity.w,
      y: entity.y + yOffset + trim.y * entity.h,
      w: trim.w * entity.w,
      h: trim.h * entity.h,
    };
  }
  // Fallback (only used for the built-in drawn placeholder shapes):
  // shrink the full box a bit so it still feels fair.
  const padX = entity.w * 0.18;
  const padY = entity.h * 0.1;
  return {
    x: entity.x + padX,
    y: entity.y + padY,
    w: entity.w - padX * 2,
    h: entity.h - padY * 2,
  };
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/* =====================================================================
   UPDATE
===================================================================== */
function update(dt) {
  elapsed += dt;

  // Gradually ramp difficulty.
  speed = 360 + Math.min(280, elapsed * 14);

  // Player physics.
  player.vy += GRAVITY * dt;
  player.y += player.vy * dt;
  if (player.y > GROUND_LINE_Y - player.h) {
    player.y = GROUND_LINE_Y - player.h;
    player.vy = 0;
    player.isJumping = false;
  }

  // Spawn obstacles on a randomized timer.
  spawnTimer += dt;
  if (spawnTimer >= nextSpawnIn) {
    spawnTimer = 0;
    nextSpawnIn = 0.9 + Math.random() * 1.1;
    spawnObstacle();
  }

  const playerBox = getCollisionBox(player, imageIsReady(runnerImg) ? RUNNER_TRIM : null, RUNNER_Y_OFFSET);

  // Move obstacles, score, and collide.
  for (const ob of obstacles) {
    ob.x -= speed * dt;

    if (!ob.passed && ob.x + ob.w < player.x) {
      ob.passed = true;
      score += 1;
      scoreEl.textContent = String(score);
    }

    const obBox = getCollisionBox(ob, imageIsReady(ob.img) ? OBSTACLE_TRIM : null, OBSTACLE_Y_OFFSET);
    if (rectsOverlap(playerBox, obBox)) {
      endGame();
    }
  }
  obstacles = obstacles.filter((ob) => ob.x + ob.w > -10);
}

/* =====================================================================
   DRAW
===================================================================== */
function draw() {
  ctx.clearRect(0, 0, WORLD_W, WORLD_H);

  // Ground line.
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_LINE_Y);
  ctx.lineTo(WORLD_W, GROUND_LINE_Y);
  ctx.stroke();

  // Player.
  if (imageIsReady(runnerImg)) {
    ctx.drawImage(runnerImg, player.x, player.y + RUNNER_Y_OFFSET, player.w, player.h);
  } else {
    drawFallbackRunner(player);
  }

  // Obstacles.
  for (const ob of obstacles) {
    if (imageIsReady(ob.img)) {
      ctx.drawImage(ob.img, ob.x, ob.y + OBSTACLE_Y_OFFSET, ob.w, ob.h);
    } else {
      drawFallbackObstacle(ob);
    }
  }

  // Uncomment the block below to visually debug the collision boxes
  // (handy if a hit still feels off after swapping images):
  //
  // ctx.strokeStyle = "red";
  // const pb = getCollisionBox(player, imageIsReady(runnerImg) ? RUNNER_TRIM : null, RUNNER_Y_OFFSET);
  // ctx.strokeRect(pb.x, pb.y, pb.w, pb.h);
  // for (const ob of obstacles) {
  //   const b = getCollisionBox(ob, imageIsReady(ob.img) ? OBSTACLE_TRIM : null, OBSTACLE_Y_OFFSET);
  //   ctx.strokeRect(b.x, b.y, b.w, b.h);
  // }
}

/* Simple drawn dino-ish blob used until a custom PNG is provided. */
function drawFallbackRunner(p) {
  ctx.fillStyle = "#9fe7ff";
  // Body
  ctx.fillRect(p.x, p.y + 10, p.w * 0.8, p.h * 0.65);
  // Head
  ctx.fillRect(p.x + p.w * 0.55, p.y, p.w * 0.45, p.h * 0.45);
  // Eye
  ctx.fillStyle = "#0a0a12";
  ctx.fillRect(p.x + p.w * 0.82, p.y + p.h * 0.1, 4, 4);
  // Legs (simple alternating rectangles for a tiny run cue)
  ctx.fillStyle = "#9fe7ff";
  const legPhase = Math.floor(elapsed * 10) % 2;
  ctx.fillRect(p.x + 4, p.y + p.h - 8, 8, 8 + (legPhase === 0 ? 2 : 0));
  ctx.fillRect(p.x + p.w * 0.5, p.y + p.h - 8, 8, 8 + (legPhase === 1 ? 2 : 0));
}

/* Simple drawn cactus-ish shape used until custom PNGs are provided. */
function drawFallbackObstacle(ob) {
  ctx.fillStyle = "#7ee787";
  ctx.fillRect(ob.x + ob.w * 0.35, ob.y, ob.w * 0.3, ob.h);
  ctx.fillRect(ob.x, ob.y + ob.h * 0.35, ob.w * 0.3, ob.h * 0.3);
  ctx.fillRect(ob.x + ob.w * 0.7, ob.y + ob.h * 0.2, ob.w * 0.3, ob.h * 0.3);
}

/* =====================================================================
   MAIN LOOP
===================================================================== */
function loop(now) {
  const dt = Math.min(0.035, (now - lastTime) / 1000); // clamp big jank gaps
  lastTime = now;

  if (running) {
    update(dt);
  }
  draw();

  if (running) {
    rafId = requestAnimationFrame(loop);
  }
}

/* =====================================================================
   INIT
===================================================================== */
resizeCanvas();
resetGame();
draw();
overlayText.textContent = "Tap, click, or press Space to start";
