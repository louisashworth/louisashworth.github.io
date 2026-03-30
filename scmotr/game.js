const WORLD_WIDTH = 160;
const WORLD_HEIGHT = 90;
const SKYLINE_WIDTH = 640;

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const highScoreEl = document.getElementById("high-score");
const messageEl = document.getElementById("message");
const startInstructionEl = document.getElementById("start-instruction");
const finalScoreEl = document.getElementById("final-score");
const timeEffectEl = document.getElementById("time-effect");
const timeEffectCountdownEl = document.getElementById("time-effect-countdown");

const ASSETS = {
  sky: "./SVGs/sky.svg",
  cloud: "./SVGs/cloud.svg",
  skyline: "./SVGs/skyline.svg",
  promenade: "./SVGs/promenade.svg",
  time: "./SVGs/time.svg",
  title: "./SVGs/title.svg",
  playerIdle: "./SVGs/scm.svg",
  playerRun: "./SVGs/scm run.svg",
  agent1: "./SVGs/agent.svg",
  agent2: "./SVGs/agent 2.svg",
  agentFly1: "./SVGs/agent fly.svg",
  agentFly2: "./SVGs/agent 2 fly.svg",
};

const SPRITES = {
  playerIdle: { key: "playerIdle", sx: 1, sy: 73, sw: 19, sh: 11 },
  playerRun: { key: "playerRun", sx: 25, sy: 73, sw: 19, sh: 11 },
  agent1: { key: "agent1", sx: 53, sy: 64, sw: 10, sh: 20, placement: "ground" },
  agent2: { key: "agent2", sx: 68, sy: 64, sw: 10, sh: 20, placement: "ground" },
  agentFly1: { key: "agentFly1", sx: 120, sy: 48, sw: 19, sh: 11, placement: "native" },
  agentFly2: { key: "agentFly2", sx: 95, sy: 48, sw: 18, sh: 10, placement: "native" },
  cloud: { key: "cloud", sx: 24, sy: 17, sw: 43, sh: 15 },
  promenade: { key: "promenade", sx: 0, sy: 63, sw: 94, sh: 27 },
  time: { key: "time", sx: 43, sy: 47, sw: 9, sh: 11 },
  title: { key: "title", sx: 102, sy: 32, sw: 93, sh: 18 },
};

const images = {};
let loadedCount = 0;
const requiredCount = Object.keys(ASSETS).length;
const GROUND_AGENT_SPRITES = [SPRITES.agent1, SPRITES.agent2];
const FLY_AGENT_SPRITES = [SPRITES.agentFly1, SPRITES.agentFly2];
const GROUND_EPSILON = 1;

let gameOver = false;
let sessionHighScore = 0;
let score = 0;
let runTime = 0;
let lastScoreText = "";
let lastHighScoreText = "";
let lastTimeHudText = "";
let timeHudVisible = false;

let scrollSpeed = 58;
const speedRampPerSecond = 2.0;
const maxScrollSpeed = 196;
const minAnimRate = 9;
const maxAnimRate = 20;

let promenadeOffset = 0;
let promenadeCarry = 0;

let skylineOffset = 0;
let skylineCarry = 0;
const skylineSpeed = SKYLINE_WIDTH / 120; // full pass in two minutes

let cloudCarry = 0;
const cloudSpeed = skylineSpeed;
const clouds = [];

let obstacleCarry = 0;
let obstacles = [];
let spawnTimer = 0;
let awaitingStart = true;
let nextTimeSpawnScore = 500;
let timePickup = null;
let timePulseTimer = 0;
let timePickupAnim = null;
let slowEffectRemaining = 0;
const timeBeforeGapSeconds = 1.0;
const timeAfterGapSeconds = 2.0;

let animTimer = 0;
let useRunFrame = false;

const groundY = 83;
const player = {
  x: 28,
  feetY: groundY,
  verticalCarry: 0,
  velocityY: 0,
  jumpVelocity: -148,
  gravity: 320,
  onGround: true,
};
const PLAYER_AIR_TIME = (2 * Math.abs(player.jumpVelocity)) / player.gravity;
const PLAYER_JUMP_HEIGHT =
  (Math.abs(player.jumpVelocity) * Math.abs(player.jumpVelocity)) / (2 * player.gravity);

function isGroundedState() {
  return player.feetY >= groundY - GROUND_EPSILON && player.velocityY >= 0;
}

function padScore(value) {
  return String(value).padStart(4, "0");
}

function setHidden(element, hidden) {
  element.classList.toggle("hidden", hidden);
}

function updateHud() {
  const scoreText = padScore(score);
  const highScoreText = `HI ${padScore(sessionHighScore)}`;
  if (scoreText !== lastScoreText) {
    scoreEl.textContent = scoreText;
    lastScoreText = scoreText;
  }
  if (highScoreText !== lastHighScoreText) {
    highScoreEl.textContent = highScoreText;
    lastHighScoreText = highScoreText;
  }
}

function showMessage(text) {
  setHidden(messageEl, false);
  if (messageEl.textContent !== text) {
    messageEl.textContent = text;
  }
}

function hideMessage() {
  setHidden(messageEl, true);
}

function showFinalScore(value) {
  const finalScoreText = `FINAL SCORE ${padScore(value)}`;
  if (finalScoreEl.textContent !== finalScoreText) {
    finalScoreEl.textContent = finalScoreText;
  }
  setHidden(finalScoreEl, false);
}

function hideFinalScore() {
  setHidden(finalScoreEl, true);
}

function updateTimeHud() {
  const visible = slowEffectRemaining > 0;
  if (visible) {
    const nextText = `${slowEffectRemaining.toFixed(1)}s`;
    if (nextText !== lastTimeHudText) {
      timeEffectCountdownEl.textContent = nextText;
      lastTimeHudText = nextText;
    }
  }
  if (visible !== timeHudVisible) {
    setHidden(timeEffectEl, !visible);
    timeHudVisible = visible;
    if (!visible) {
      lastTimeHudText = "";
    }
  }
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, maxInclusive) {
  return Math.floor(rand(min, maxInclusive + 1));
}

function currentPlayerSprite() {
  if (!player.onGround) {
    return SPRITES.playerRun;
  }
  return useRunFrame ? SPRITES.playerRun : SPRITES.playerIdle;
}

function playerTopY() {
  return player.feetY - (currentPlayerSprite().sh - 1);
}

function resetClouds() {
  clouds.length = 0;
  let x = -40;
  while (x < WORLD_WIDTH + 240) {
    x += randInt(110, 240);
    clouds.push({
      x,
      y: randInt(-8, 6),
    });
  }
}

function resetRun() {
  gameOver = false;
  score = 0;
  runTime = 0;
  scrollSpeed = 58;

  promenadeOffset = 0;
  promenadeCarry = 0;
  skylineOffset = 0; // far-left skyline at start
  skylineCarry = 0;
  cloudCarry = 0;
  obstacleCarry = 0;
  obstacles = [];
  spawnTimer = rand(1.6, 2.4);
  nextTimeSpawnScore = 500;
  timePickup = null;
  timePulseTimer = 0;
  timePickupAnim = null;
  slowEffectRemaining = 0;
  animTimer = 0;
  useRunFrame = false;

  player.feetY = groundY;
  player.verticalCarry = 0;
  player.velocityY = 0;
  player.onGround = true;

  resetClouds();
  hideMessage();
  hideFinalScore();
  updateTimeHud();
  updateHud();
}

function handlePrimaryInput() {
  if (awaitingStart) {
    awaitingStart = false;
    setHidden(startInstructionEl, true);
    hideMessage();
    hideFinalScore();
    return;
  }

  if (gameOver) {
    resetRun();
    awaitingStart = true;
    setHidden(startInstructionEl, false);
    return;
  }

  if (isGroundedState()) {
    launchJump();
  }
}

function launchJump() {
  player.feetY = groundY;
  player.verticalCarry = 0;
  player.velocityY = player.jumpVelocity;
  player.onGround = false;
}

function spawnObstacle() {
  const firstX = WORLD_WIDTH + randInt(24, 84);
  const first = createAgentObstacle(firstX);
  obstacles.push(first);

  // Occasionally spawn a close two-agent cluster.
  if (slowEffectRemaining <= 0 && score > 200 && Math.random() < 0.32) {
    const pairGap = randInt(3, 6);
    const secondX = firstX + first.sprite.sw + pairGap;
    const firstIsFly = first.sprite.placement === "native";
    obstacles.push(createAgentObstacle(secondX, firstIsFly));
  }
}

function createAgentObstacle(x, forceFly = null) {
  const useFlySprite = forceFly === null ? score >= 600 && Math.random() < 0.35 : forceFly;
  const spritePool = useFlySprite ? FLY_AGENT_SPRITES : GROUND_AGENT_SPRITES;
  const sprite = spritePool[randInt(0, spritePool.length - 1)];
  const y = sprite.placement === "native" ? sprite.sy : groundY - (sprite.sh - 1);
  return {
    x,
    y,
    sprite,
    flipX: Math.random() < 0.45,
  };
}

function spawnTimePickup() {
  const apexFeetY = groundY - PLAYER_JUMP_HEIGHT;
  const apexTopY = Math.round(apexFeetY - (SPRITES.playerRun.sh - 1));
  timePickup = {
    x: WORLD_WIDTH + randInt(36, 90),
    y: Math.max(6, apexTopY),
  };
}

function triggerTimePickupPickup() {
  if (!timePickup) {
    return;
  }

  const pickupX = timePickup.x;
  timePickupAnim = {
    x: pickupX,
    y: timePickup.y,
    progress: 0,
    duration: 0.7,
  };
  timePickup = null;
  slowEffectRemaining = 7;
  enforceTimePickupAgentGaps(pickupX);
  updateTimeHud();
}

function enforceTimePickupAgentGaps(pickupX) {
  const beforeGapPx = Math.ceil(scrollSpeed * timeBeforeGapSeconds);
  const afterGapPx = Math.ceil(scrollSpeed * timeAfterGapSeconds);
  const minAgentSpacingPx = 14;

  let adjustedPickupX = pickupX;
  let nearestBefore = -Infinity;
  for (const obstacle of obstacles) {
    if (obstacle.x < adjustedPickupX && obstacle.x > nearestBefore) {
      nearestBefore = obstacle.x;
    }
  }
  if (nearestBefore !== -Infinity && adjustedPickupX - nearestBefore < beforeGapPx) {
    adjustedPickupX = nearestBefore + beforeGapPx;
  }

  const ordered = [...obstacles].sort((a, b) => a.x - b.x);

  let cursorX = adjustedPickupX + afterGapPx;
  for (const obstacle of ordered) {
    if (obstacle.x < adjustedPickupX) {
      continue;
    }
    if (obstacle.x < cursorX) {
      obstacle.x = cursorX;
    }
    cursorX = obstacle.x + obstacle.sprite.sw + minAgentSpacingPx;
  }

  return adjustedPickupX;
}

function overlaps(a, b) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

function drawSprite(sprite, dx, dy, flipX = false) {
  const image = images[sprite.key];
  if (!flipX) {
    ctx.drawImage(image, sprite.sx, sprite.sy, sprite.sw, sprite.sh, dx, dy, sprite.sw, sprite.sh);
    return;
  }

  ctx.save();
  ctx.translate(dx + sprite.sw, dy);
  ctx.scale(-1, 1);
  ctx.drawImage(image, sprite.sx, sprite.sy, sprite.sw, sprite.sh, 0, 0, sprite.sw, sprite.sh);
  ctx.restore();
}

function drawRepeatedSprite(sprite, offset, y) {
  const startX = -(((offset % sprite.sw) + sprite.sw) % sprite.sw);
  for (let x = startX; x < WORLD_WIDTH + sprite.sw; x += sprite.sw) {
    drawSprite(sprite, x, y);
  }
}

function getPlayerBox(playerSprite) {
  return {
    left: player.x + 2,
    right: player.x + playerSprite.sw - 3,
    top: playerTopY() + 1,
    bottom: player.feetY,
  };
}

function getObstacleBox(obstacle) {
  return {
    left: obstacle.x + 1,
    right: obstacle.x + obstacle.sprite.sw - 2,
    top: obstacle.y + 1,
    bottom: obstacle.y + obstacle.sprite.sh - 1,
  };
}

function update(dt) {
  if (awaitingStart) {
    return;
  }

  if (gameOver) {
    return;
  }

  if (slowEffectRemaining > 0) {
    slowEffectRemaining = Math.max(0, slowEffectRemaining - dt);
  }
  updateTimeHud();
  const speedMultiplier = slowEffectRemaining > 0 ? 0.5 : 1;
  const gameplayDt = dt * speedMultiplier;

  runTime += dt;
  score = Math.floor(runTime * 10);
  if (score > sessionHighScore) {
    sessionHighScore = score;
  }
  updateHud();

  if (!timePickup && !timePickupAnim && score >= nextTimeSpawnScore) {
    spawnTimePickup();
    timePickup.x = enforceTimePickupAgentGaps(timePickup.x);
    nextTimeSpawnScore += 1000;
  }

  scrollSpeed = Math.min(maxScrollSpeed, scrollSpeed + speedRampPerSecond * gameplayDt);
  const speedFactor = (scrollSpeed - 58) / (maxScrollSpeed - 58);
  const animRate = minAnimRate + (maxAnimRate - minAnimRate) * speedFactor;
  const animInterval = 1 / animRate;

  // Alternate between scm.svg and scm run.svg faster as game speed increases.
  animTimer += gameplayDt;
  while (animTimer >= animInterval) {
    animTimer -= animInterval;
    useRunFrame = !useRunFrame;
  }

  const baseStep = scrollSpeed * gameplayDt;

  promenadeCarry += baseStep;
  const promenadeStep = Math.floor(promenadeCarry);
  promenadeCarry -= promenadeStep;
  promenadeOffset += promenadeStep;

  skylineCarry += skylineSpeed * gameplayDt;
  const skylineStep = Math.floor(skylineCarry);
  skylineCarry -= skylineStep;
  skylineOffset = (skylineOffset + skylineStep) % SKYLINE_WIDTH;

  cloudCarry += cloudSpeed * gameplayDt;
  const cloudStep = Math.floor(cloudCarry);
  cloudCarry -= cloudStep;
  for (const cloud of clouds) {
    cloud.x -= cloudStep;
  }

  let maxCloudX = -Infinity;
  for (const cloud of clouds) {
    if (cloud.x > maxCloudX) {
      maxCloudX = cloud.x;
    }
  }
  for (const cloud of clouds) {
    if (cloud.x + SPRITES.cloud.sw < 0) {
      cloud.x = maxCloudX + randInt(110, 240);
      cloud.y = randInt(-8, 6);
      maxCloudX = cloud.x;
    }
  }

  spawnTimer -= gameplayDt;
  if (spawnTimer <= 0) {
    if (slowEffectRemaining > 0) {
      // Suspend agent spawning entirely while the time effect is active.
      spawnTimer = rand(Math.max(0.25, slowEffectRemaining), slowEffectRemaining + 0.4);
    } else {
      spawnObstacle();
      if (timePickup) {
        enforceTimePickupAgentGaps(timePickup.x);
      }
      const minGap = Math.max(PLAYER_AIR_TIME + 0.35, 1.35 - speedFactor * 0.2);
      const maxGap = 2.45 - speedFactor * 0.5;
      spawnTimer = rand(minGap, maxGap);
    }
  }

  player.velocityY += player.gravity * gameplayDt;
  player.verticalCarry += player.velocityY * gameplayDt;
  const verticalStep =
    player.verticalCarry > 0 ? Math.floor(player.verticalCarry) : Math.ceil(player.verticalCarry);
  player.verticalCarry -= verticalStep;
  player.feetY += verticalStep;

  if (isGroundedState()) {
    player.feetY = groundY;
    player.verticalCarry = 0;
    player.velocityY = 0;
    player.onGround = true;
  }

  obstacleCarry += baseStep;
  const obstacleStep = Math.floor(obstacleCarry);
  obstacleCarry -= obstacleStep;

  if (timePickup) {
    timePickup.x -= obstacleStep;
    timePulseTimer += dt;
    if (timePickup.x + SPRITES.time.sw < 0) {
      timePickup = null;
    }
  }

  if (timePickupAnim) {
    timePickupAnim.progress = Math.min(1, timePickupAnim.progress + dt / timePickupAnim.duration);
    if (timePickupAnim.progress >= 1) {
      timePickupAnim = null;
    }
  }

  if (timePickup) {
    const playerSprite = currentPlayerSprite();
    const playerBox = getPlayerBox(playerSprite);
    const timeBox = {
      left: timePickup.x,
      right: timePickup.x + SPRITES.time.sw - 1,
      top: timePickup.y,
      bottom: timePickup.y + SPRITES.time.sh - 1,
    };
    if (overlaps(playerBox, timeBox)) {
      triggerTimePickupPickup();
    }
  }

  const nextObstacles = [];
  const playerSprite = currentPlayerSprite();
  const playerBox = getPlayerBox(playerSprite);
  let collidedAt = -1;
  for (let i = 0; i < obstacles.length; i += 1) {
    const obstacle = obstacles[i];
    obstacle.x -= obstacleStep;
    if (obstacle.x + obstacle.sprite.sw < 0) {
      continue;
    }
    nextObstacles.push(obstacle);

    const obstacleBox = getObstacleBox(obstacle);
    if (overlaps(playerBox, obstacleBox)) {
      gameOver = true;
      showMessage("Game over - press Space or click to restart");
      showFinalScore(score);
      collidedAt = i;
      break;
    }
  }
  if (collidedAt >= 0) {
    for (let i = collidedAt + 1; i < obstacles.length; i += 1) {
      const obstacle = obstacles[i];
      if (obstacle.x + obstacle.sprite.sw >= 0) {
        nextObstacles.push(obstacle);
      }
    }
  }
  obstacles = nextObstacles;
}

function render() {
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  ctx.drawImage(images.sky, 0, 0, WORLD_WIDTH, WORLD_HEIGHT, 0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  for (const cloud of clouds) {
    drawSprite(SPRITES.cloud, cloud.x, cloud.y);
  }

  const skylineX = -(((skylineOffset % SKYLINE_WIDTH) + SKYLINE_WIDTH) % SKYLINE_WIDTH);
  ctx.drawImage(images.skyline, skylineX, 0, SKYLINE_WIDTH, WORLD_HEIGHT);
  ctx.drawImage(images.skyline, skylineX + SKYLINE_WIDTH, 0, SKYLINE_WIDTH, WORLD_HEIGHT);

  drawRepeatedSprite(SPRITES.promenade, promenadeOffset, 63);

  if (timePickup) {
    const pulse = 0.875 + 0.125 * Math.sin(timePulseTimer * 5);
    ctx.save();
    ctx.globalAlpha = pulse;
    drawSprite(SPRITES.time, timePickup.x, timePickup.y);
    ctx.restore();
  }

  for (const obstacle of obstacles) {
    drawSprite(obstacle.sprite, obstacle.x, obstacle.y, obstacle.flipX);
  }

  drawSprite(currentPlayerSprite(), player.x, playerTopY());

  if (timePickupAnim) {
    const t = timePickupAnim.progress;
    const ease = 1 - (1 - t) * (1 - t);
    const width = SPRITES.time.sw + (WORLD_WIDTH - SPRITES.time.sw) * ease;
    const height = SPRITES.time.sh + (WORLD_HEIGHT - SPRITES.time.sh) * ease;
    const x = timePickupAnim.x + (0 - timePickupAnim.x) * ease;
    const y = timePickupAnim.y + (0 - timePickupAnim.y) * ease;

    ctx.save();
    ctx.globalAlpha = 1 - ease;
    ctx.drawImage(
      images.time,
      SPRITES.time.sx,
      SPRITES.time.sy,
      SPRITES.time.sw,
      SPRITES.time.sh,
      x,
      y,
      width,
      height,
    );
    ctx.restore();
  }

  if (awaitingStart) {
    const titleX = Math.floor((WORLD_WIDTH - SPRITES.title.sw) / 2);
    const titleY = 20;
    drawSprite(SPRITES.title, titleX, titleY);
  }
}

let lastTs = 0;
function frame(ts) {
  if (!lastTs) {
    lastTs = ts;
  }
  const dt = Math.min(0.033, (ts - lastTs) / 1000);
  lastTs = ts;

  update(dt);
  render();
  requestAnimationFrame(frame);
}

function startIfReady() {
  if (loadedCount !== requiredCount) {
    return;
  }
  canvas.width = WORLD_WIDTH;
  canvas.height = WORLD_HEIGHT;
  ctx.imageSmoothingEnabled = false;
  resetRun();
  awaitingStart = true;
  setHidden(startInstructionEl, false);
  requestAnimationFrame(frame);
}

for (const [key, path] of Object.entries(ASSETS)) {
  const image = new Image();
  image.onload = () => {
    loadedCount += 1;
    startIfReady();
  };
  image.src = path;
  images[key] = image;
}

function isJumpKey(event) {
  return event.code === "Space" || event.key === " " || event.key === "Spacebar";
}

document.addEventListener(
  "keydown",
  (event) => {
    if (isJumpKey(event)) {
      event.preventDefault();
      handlePrimaryInput();
    }
  },
  { capture: true },
);

window.addEventListener("pointerdown", () => {
  handlePrimaryInput();
});

window.addEventListener(
  "touchstart",
  (event) => {
    event.preventDefault();
    handlePrimaryInput();
  },
  { passive: false },
);
