const SIZE = 4;
const BPM = 120;
const BEAT_MS = (60_000 / BPM);
const RHYTHM_PATTERN = [3, 3, 7];
const RHYTHM_CYCLE_BEATS = RHYTHM_PATTERN.reduce((sum, n) => sum + n, 0);
const RHYTHM_CYCLE_MS = RHYTHM_CYCLE_BEATS * BEAT_MS;
const STORAGE_KEY = "color-merge-high-score";
const SCOREBOARD_KEY = "color-merge-scoreboard";
const SCOREBOARD_SIZE = 10;

const boardElement = document.getElementById("board");
const scorePopupsElement = document.getElementById("score-popups");
const scoreElement = document.getElementById("score");
const highScoreElement = document.getElementById("high-score");
const rhythmMultiplierElement = document.getElementById("rhythm-multiplier");
const rhythmLabelElement = document.getElementById("rhythm-label");
const rhythmLaneElement = document.getElementById("rhythm-lane");
const rhythmCursorElement = document.getElementById("rhythm-cursor");
const hpGaugeFillElement = document.getElementById("hp-gauge-fill");
const hpValueElement = document.getElementById("hp-value");
const highScoreListElement = document.getElementById("high-score-list");
const gameOverElement = document.getElementById("game-over");
const gameOverTextElement = document.getElementById("game-over-text");
const restartButton = document.getElementById("restart-btn");
const retryButton = document.getElementById("retry-btn");

let board = [];
let score = 0;
let highScore = Number(localStorage.getItem(STORAGE_KEY) || 0);
let scoreBoard = loadScoreBoard();
let isGameOver = false;
let nextTileId = 1;
let health = 100;
let rhythmMultiplier = 1;
let rhythmCombo = 0;
let rhythmBeatIndex = 0;
let rhythmBaseTime = 0;
let rhythmLabelTimeout = 0;
let rhythmRaf = 0;

const touch = {
  x: 0,
  y: 0,
  active: false,
};

const sound = createSoundEngine();

highScoreElement.textContent = String(highScore);
createBoardSkeleton();
renderScoreBoard();
initGame();

restartButton.addEventListener("click", () => {
  sound.unlock();
  sound.playUiTap();
  initGame();
});
retryButton.addEventListener("click", () => {
  sound.unlock();
  sound.playUiTap();
  initGame();
});
window.addEventListener("keydown", handleKeydown);
boardElement.addEventListener("touchstart", onTouchStart, { passive: true });
boardElement.addEventListener("touchend", onTouchEnd, { passive: true });

function createBoardSkeleton() {
  for (let i = 0; i < SIZE * SIZE; i += 1) {
    const cell = document.createElement("div");
    cell.className = "cell";
    boardElement.appendChild(cell);
  }
}

function initGame() {
  board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  score = 0;
  isGameOver = false;
  updateScore(0);
  gameOverTextElement.textContent = "ゲームオーバー";
  gameOverElement.classList.add("hidden");
  spawnRandomTile();
  spawnRandomTile();
  renderBoard();
  initRhythmState();
}

function createTile(level) {
  const tile = { id: nextTileId, level };
  nextTileId += 1;
  return tile;
}

function handleKeydown(event) {
  if (isGameOver) return;

  sound.unlock();

  const map = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    w: "up",
    a: "left",
    s: "down",
    d: "right",
    W: "up",
    A: "left",
    S: "down",
    D: "right",
  };

  const dir = map[event.key];
  if (!dir) return;

  event.preventDefault();
  takeTurn(dir);
}

function onTouchStart(event) {
  const [point] = event.changedTouches;
  if (!point) return;
  sound.unlock();
  touch.active = true;
  touch.x = point.clientX;
  touch.y = point.clientY;
}

function onTouchEnd(event) {
  if (!touch.active || isGameOver) return;
  const [point] = event.changedTouches;
  if (!point) return;

  const dx = point.clientX - touch.x;
  const dy = point.clientY - touch.y;
  touch.active = false;

  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (Math.max(absX, absY) < 30) return;

  if (absX > absY) {
    takeTurn(dx > 0 ? "right" : "left");
    return;
  }
  takeTurn(dy > 0 ? "down" : "up");
}

function takeTurn(direction) {
  const { nextBoard, moved, gainedScore, motionMap, mergedIds, mergedLevels, mergeEvents } = move(board, direction);
  if (!moved) return;

  const rhythmJudge = evaluateRhythmTiming(performance.now());

  board = nextBoard;
  const turnGain = Math.floor(gainedScore * rhythmMultiplier);
  updateScore(turnGain);
  if (mergeEvents.length > 0) {
    const scaledEvents = mergeEvents.map((event) => ({ ...event, points: Math.floor(event.points * rhythmMultiplier) }));
    showMergeScorePopups(scaledEvents);
  }

  applyRhythmResult(rhythmJudge);

  const spawnedTile = spawnRandomTile();
  renderBoard({ motionMap, mergedIds, spawnedId: spawnedTile?.id });

  sound.playMove();
  if (spawnedTile) sound.playSpawn(spawnedTile.level);

  if (mergedLevels.length > 0) {
    mergedLevels
      .slice()
      .sort((a, b) => a - b)
      .forEach((level, index) => {
        const tileValue = 2 ** level;
        sound.playMergeSound(tileValue, index + 1);
      });
  }

  if (isBoardLocked(board)) {
    finishGame("ゲームオーバー");
    return;
  }

}

function initRhythmState() {
  health = 100;
  rhythmMultiplier = 1;
  rhythmCombo = 0;
  rhythmBeatIndex = 0;
  rhythmBaseTime = performance.now();

  if (rhythmLabelTimeout) {
    clearTimeout(rhythmLabelTimeout);
    rhythmLabelTimeout = 0;
  }

  if (rhythmRaf) cancelAnimationFrame(rhythmRaf);
  updateRhythmUi("READY");
  rhythmRaf = requestAnimationFrame(tickRhythmLane);
}

function evaluateRhythmTiming(now) {
  const expected = rhythmBaseTime + (rhythmBeatIndex * BEAT_MS);
  const delta = now - expected;
  const absDelta = Math.abs(delta);

  let grade = "BAD";
  let healthDelta = -14;

  if (absDelta <= 70) {
    grade = "GREAT";
    healthDelta = 10;
  } else if (absDelta <= 140) {
    grade = "GOOD";
    healthDelta = 4;
  } else if (absDelta <= 220) {
    grade = "BAD";
    healthDelta = -8;
  }

  rhythmBeatIndex += 1;
  return { grade, delta, healthDelta };
}

function applyRhythmResult(result) {
  health = clamp(health + result.healthDelta, 0, 100);

  if (result.grade === "GREAT") {
    rhythmCombo += 1;
  } else if (result.grade === "GOOD") {
    rhythmCombo = Math.max(rhythmCombo - 1, 0);
  } else {
    rhythmCombo = 0;
  }

  const comboBoost = Math.min(rhythmCombo * 0.06, 2.2);
  const gradeBoost = result.grade === "GREAT" ? 0.25 : result.grade === "GOOD" ? 0.1 : -0.18;
  rhythmMultiplier = clamp(1 + comboBoost + gradeBoost, 1, 3.5);

  updateRhythmUi(result.grade);

  if (health <= 0) {
    finishGame("リズム失敗でダウン");
  }
}

function updateRhythmUi(grade) {
  rhythmMultiplierElement.textContent = `x${rhythmMultiplier.toFixed(2)}`;
  rhythmMultiplierElement.classList.remove("bonus-mid", "bonus-high", "bonus-max");
  if (rhythmMultiplier >= 2.8) {
    rhythmMultiplierElement.classList.add("bonus-max");
  } else if (rhythmMultiplier >= 2.1) {
    rhythmMultiplierElement.classList.add("bonus-high");
  } else if (rhythmMultiplier >= 1.5) {
    rhythmMultiplierElement.classList.add("bonus-mid");
  }

  hpGaugeFillElement.style.transform = `scaleX(${health / 100})`;
  hpGaugeFillElement.style.background = health > 60
    ? "linear-gradient(90deg, #42d77f, #59d9d7 85%)"
    : health > 30
      ? "linear-gradient(90deg, #ffd358, #ff9f40 85%)"
      : "linear-gradient(90deg, #ff7e73, #e04343 85%)";
  hpValueElement.textContent = String(Math.round(health));

  rhythmLabelElement.textContent = grade;
  rhythmLabelElement.classList.remove("judge-great", "judge-good", "judge-bad");
  if (grade === "GREAT") {
    rhythmLabelElement.classList.add("judge-great");
  } else if (grade === "GOOD") {
    rhythmLabelElement.classList.add("judge-good");
  } else if (grade === "BAD") {
    rhythmLabelElement.classList.add("judge-bad");
  }

  if (rhythmLabelTimeout) clearTimeout(rhythmLabelTimeout);
  rhythmLabelTimeout = setTimeout(() => {
    if (isGameOver) return;
    rhythmLabelElement.textContent = "KEEP";
    rhythmLabelElement.classList.remove("judge-great", "judge-good", "judge-bad");
  }, 260);
}

function tickRhythmLane() {
  if (isGameOver) return;

  const now = performance.now();
  const cyclePosition = ((now - rhythmBaseTime) % RHYTHM_CYCLE_MS + RHYTHM_CYCLE_MS) % RHYTHM_CYCLE_MS;
  const normalized = cyclePosition / RHYTHM_CYCLE_MS;
  const wave = Math.sin(normalized * Math.PI * 2);
  rhythmCursorElement.style.left = `${50 + wave * 46}%`;

  rhythmLaneElement.classList.remove("segment-a", "segment-b", "segment-c");
  const beatProgress = cyclePosition / BEAT_MS;
  if (beatProgress < RHYTHM_PATTERN[0]) {
    rhythmLaneElement.classList.add("segment-a");
  } else if (beatProgress < RHYTHM_PATTERN[0] + RHYTHM_PATTERN[1]) {
    rhythmLaneElement.classList.add("segment-b");
  } else {
    rhythmLaneElement.classList.add("segment-c");
  }

  rhythmRaf = requestAnimationFrame(tickRhythmLane);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function showMergeScorePopups(mergeEvents) {
  if (!scorePopupsElement || mergeEvents.length === 0) return;

  mergeEvents.forEach((event, index) => {
    const popup = document.createElement("div");
    popup.className = "score-popup";
    popup.textContent = `+${event.points}`;
    popup.style.gridRow = String(event.row + 1);
    popup.style.gridColumn = String(event.col + 1);
    popup.style.animationDelay = `${index * 45}ms`;

    if (event.points >= 512) {
      popup.classList.add("score-popup-epic");
    } else if (event.points >= 128) {
      popup.classList.add("score-popup-high");
    } else {
      popup.classList.add("score-popup-mid");
    }

    scorePopupsElement.appendChild(popup);

    requestAnimationFrame(() => {
      popup.classList.add("score-popup-active");
    });

    popup.addEventListener("animationend", () => {
      popup.remove();
    }, { once: true });
  });
}

function move(source, direction) {
  const next = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  const motionMap = new Map();
  const mergedIds = new Set();
  const mergedLevels = [];
  const mergeSeeds = [];
  let moved = false;
  let gainedScore = 0;

  for (let index = 0; index < SIZE; index += 1) {
    const line = readLine(source, direction, index).filter((entry) => entry.tile);
    const mergedLine = [];

    for (let i = 0; i < line.length; i += 1) {
      const current = line[i];
      const following = line[i + 1];

      if (following && current.tile.level === following.tile.level) {
        const mergedTile = createTile(current.tile.level + 1);
        mergedLine.push({ tile: mergedTile, from: current.pos });
        mergedIds.add(mergedTile.id);
        mergedLevels.push(mergedTile.level);
        const mergedPoints = scoreByLevel(mergedTile.level);
        gainedScore += mergedPoints;
        mergeSeeds.push({ id: mergedTile.id, points: mergedPoints });
        i += 1;
      } else {
        mergedLine.push({ tile: current.tile, from: current.pos });
      }
    }

    while (mergedLine.length < SIZE) {
      mergedLine.push({ tile: null, from: null });
    }

    writeLine(next, direction, index, mergedLine, motionMap);
  }

  for (const motion of motionMap.values()) {
    if (motion.from.row !== motion.to.row || motion.from.col !== motion.to.col || mergedIds.has(motion.id)) {
      moved = true;
      break;
    }
  }

  const mergeEvents = mergeSeeds
    .map((seed) => {
      const motion = motionMap.get(seed.id);
      if (!motion) return null;
      return { row: motion.to.row, col: motion.to.col, points: seed.points };
    })
    .filter(Boolean);

  return { nextBoard: next, moved, gainedScore, motionMap, mergedIds, mergedLevels, mergeEvents };
}

function readLine(source, direction, index) {
  const values = [];
  for (let pos = 0; pos < SIZE; pos += 1) {
    const [r, c] = positionFor(direction, index, pos);
    values.push({ tile: source[r][c], pos: { row: r, col: c } });
  }
  return values;
}

function writeLine(target, direction, index, line, motionMap) {
  for (let pos = 0; pos < SIZE; pos += 1) {
    const [r, c] = positionFor(direction, index, pos);
    const item = line[pos];
    target[r][c] = item.tile;

    if (item.tile && item.from) {
      motionMap.set(item.tile.id, {
        id: item.tile.id,
        from: item.from,
        to: { row: r, col: c },
      });
    }
  }
}

function positionFor(direction, index, pos) {
  switch (direction) {
    case "left": return [index, pos];
    case "right": return [index, SIZE - 1 - pos];
    case "up": return [pos, index];
    case "down": return [SIZE - 1 - pos, index];
    default: return [index, pos];
  }
}

function spawnRandomTile() {
  const empties = [];
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (!board[r][c]) empties.push([r, c]);
    }
  }

  if (!empties.length) return null;

  const [row, col] = empties[Math.floor(Math.random() * empties.length)];
  const tile = createTile(Math.random() < 0.9 ? 1 : 2);
  board[row][col] = tile;
  return tile;
}

function isBoardLocked(state) {
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const tile = state[r][c];
      if (!tile) return false;
      const neighbors = [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]];
      for (const [nr, nc] of neighbors) {
        if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
        const neighbor = state[nr][nc];
        if (neighbor && neighbor.level === tile.level) return false;
      }
    }
  }
  return true;
}

function updateScore(delta) {
  score += delta;
  scoreElement.textContent = String(score);
  if (score > highScore) {
    highScore = score;
    localStorage.setItem(STORAGE_KEY, String(highScore));
    highScoreElement.textContent = String(highScore);
  }
}

function scoreByLevel(level) {
  return 2 ** level;
}

function colorForLevel(level) {
  const hue = (210 + level * 29) % 360;
  const saturation = 72;
  const lightness = Math.max(38, 72 - level * 4);
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function getTileStep() {
  const styles = getComputedStyle(boardElement);
  const gap = Number.parseFloat(styles.gap) || 0;
  const tile = boardElement.querySelector(".cell")?.clientWidth || 0;
  return tile + gap;
}

function renderBoard({ motionMap = new Map(), mergedIds = new Set(), spawnedId = null } = {}) {
  const oldLayer = boardElement.querySelector(".tile-layer");
  if (oldLayer) oldLayer.remove();

  const tileLayer = document.createElement("div");
  tileLayer.className = "tile-layer";

  const movingNodes = [];
  const step = getTileStep();

  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const tile = board[r][c];
      if (!tile) continue;

      const node = document.createElement("div");
      node.className = "tile";
      node.textContent = String(tile.level);
      node.style.backgroundColor = colorForLevel(tile.level);
      node.style.gridRow = String(r + 1);
      node.style.gridColumn = String(c + 1);

      const motion = motionMap.get(tile.id);
      if (motion) {
        const dx = (motion.from.col - motion.to.col) * step;
        const dy = (motion.from.row - motion.to.row) * step;
        if (dx !== 0 || dy !== 0) {
          node.classList.add("tile-moving");
          node.style.setProperty("--from-x", `${dx}px`);
          node.style.setProperty("--from-y", `${dy}px`);
          movingNodes.push(node);
        }
      }

      if (mergedIds.has(tile.id)) node.classList.add("tile-merged");
      if (spawnedId && tile.id === spawnedId) node.classList.add("tile-spawned");
      tileLayer.appendChild(node);
    }
  }

  boardElement.appendChild(tileLayer);

  if (movingNodes.length) {
    requestAnimationFrame(() => {
      movingNodes.forEach((node) => node.classList.add("tile-moving-active"));
    });
  }
}

function finishGame(reason) {
  if (isGameOver) return;
  isGameOver = true;
  if (rhythmRaf) cancelAnimationFrame(rhythmRaf);
  if (rhythmLabelTimeout) clearTimeout(rhythmLabelTimeout);
  gameOverTextElement.textContent = reason;
  gameOverElement.classList.remove("hidden");
  registerScore(score);
  renderScoreBoard();
  sound.playGameOver();
}

function loadScoreBoard() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SCOREBOARD_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((n) => Number.isFinite(n)) : [];
  } catch {
    return [];
  }
}

function registerScore(value) {
  if (!Number.isFinite(value) || value <= 0) return;
  scoreBoard = [...scoreBoard, Math.floor(value)]
    .sort((a, b) => b - a)
    .slice(0, SCOREBOARD_SIZE);
  localStorage.setItem(SCOREBOARD_KEY, JSON.stringify(scoreBoard));
}

function renderScoreBoard() {
  highScoreListElement.innerHTML = "";
  highScoreListElement.classList.remove("is-empty");
  if (scoreBoard.length === 0) {
    const li = document.createElement("li");
    li.textContent = "まだ記録がありません";
    highScoreListElement.appendChild(li);
    highScoreListElement.classList.add("is-empty");
    return;
  }

  scoreBoard.forEach((value) => {
    const li = document.createElement("li");
    li.textContent = String(value);
    highScoreListElement.appendChild(li);
  });
}

function createSoundEngine() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;

  if (!AudioCtx) {
    return {
      unlock() {}, playMove() {}, playSpawn() {}, playMergeSound() {}, playUiTap() {}, playGameOver() {},
    };
  }

  let ctx = null;
  let master = null;

  function ensureContext() {
    if (ctx) return true;
    try {
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = 0.45;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function unlock() {
    if (!ensureContext()) return;
    if (ctx.state === "suspended") ctx.resume();
  }

  function withAudio(callback) {
    if (!ensureContext()) return;
    if (ctx.state === "running") {
      callback();
      return;
    }
    ctx.resume().then(() => callback()).catch(() => {});
  }

  function click(freq, gain, start = 0, duration = 0.03) {
    const now = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(120, freq * 0.5), now + duration);
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.002);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp);
    amp.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  return {
    unlock,
    playMove() { withAudio(() => click(1700, 0.06)); },
    playSpawn(level = 1) { withAudio(() => click(1750 + level * 30, 0.06)); },
    playMergeSound(tileValue, chainCount = 1) {
      withAudio(() => {
        const step = Math.max(1, Math.round(Math.log2(Math.max(2, tileValue))));
        const base = 1500 + step * 60 + chainCount * 40;
        click(base, Math.min(0.08 + step * 0.003, 0.15), 0, 0.034);
        click(base * 1.2, 0.055, 0.014, 0.028);
      });
    },
    playUiTap() { withAudio(() => click(1850, 0.05, 0, 0.025)); },
    playGameOver() { withAudio(() => click(900, 0.08, 0, 0.06)); },
  };
}

window.addEventListener("resize", () => renderBoard());
