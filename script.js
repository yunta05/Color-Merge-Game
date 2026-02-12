const SIZE = 4;
const STORAGE_KEY = "color-merge-high-score";
const boardElement = document.getElementById("board");
const scoreElement = document.getElementById("score");
const highScoreElement = document.getElementById("high-score");
const gameOverElement = document.getElementById("game-over");
const restartButton = document.getElementById("restart-btn");
const retryButton = document.getElementById("retry-btn");

let board = [];
let score = 0;
let highScore = Number(localStorage.getItem(STORAGE_KEY) || 0);
let isGameOver = false;
let nextTileId = 1;

const touch = {
  x: 0,
  y: 0,
  active: false,
};

const sound = createSoundEngine();

highScoreElement.textContent = String(highScore);
createBoardSkeleton();
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
  gameOverElement.classList.add("hidden");
  spawnRandomTile();
  spawnRandomTile();
  renderBoard();
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
  const { nextBoard, moved, gainedScore, motionMap, mergedIds } = move(board, direction);
  if (!moved) return;

  board = nextBoard;
  updateScore(gainedScore);
  const spawnedTile = spawnRandomTile();
  renderBoard({ motionMap, mergedIds, spawnedId: spawnedTile?.id });

  sound.playMove();
  if (spawnedTile) {
    sound.playSpawn(spawnedTile.level);
  }
  if (mergedIds.size > 0) {
    sound.playMerge(Math.min(mergedIds.size, 3));
  }

  if (isBoardLocked(board)) {
    isGameOver = true;
    gameOverElement.classList.remove("hidden");
    sound.playGameOver();
  }
}

function move(source, direction) {
  const next = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  const motionMap = new Map();
  const mergedIds = new Set();
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
        mergedLine.push({ tile: mergedTile, from: current.pos, merged: true });
        mergedIds.add(mergedTile.id);
        gainedScore += scoreByLevel(mergedTile.level);
        i += 1;
      } else {
        mergedLine.push({ tile: current.tile, from: current.pos, merged: false });
      }
    }

    while (mergedLine.length < SIZE) {
      mergedLine.push({ tile: null, from: null, merged: false });
    }

    writeLine(next, direction, index, mergedLine, motionMap);
  }

  for (const motion of motionMap.values()) {
    if (motion.from.row !== motion.to.row || motion.from.col !== motion.to.col || mergedIds.has(motion.id)) {
      moved = true;
      break;
    }
  }

  return { nextBoard: next, moved, gainedScore, motionMap, mergedIds };
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
    case "left":
      return [index, pos];
    case "right":
      return [index, SIZE - 1 - pos];
    case "up":
      return [pos, index];
    case "down":
      return [SIZE - 1 - pos, index];
    default:
      return [index, pos];
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
      const neighbors = [
        [r + 1, c],
        [r - 1, c],
        [r, c + 1],
        [r, c - 1],
      ];
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

      if (mergedIds.has(tile.id)) {
        node.classList.add("tile-merged");
      }

      if (spawnedId && tile.id === spawnedId) {
        node.classList.add("tile-spawned");
      }

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

function createSoundEngine() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    return {
      unlock() {},
      playMove() {},
      playSpawn() {},
      playMerge() {},
      playUiTap() {},
      playGameOver() {},
    };
  }

  let ctx = null;
  let master = null;

  function ensureContext() {
    if (ctx) return true;
    try {
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = 0.2;
      master.connect(ctx.destination);
      return true;
    } catch (error) {
      return false;
    }
  }

  function unlock() {
    if (!ensureContext()) return;
    if (ctx.state === "suspended") {
      ctx.resume();
    }
  }

  function withAudio(callback) {
    if (!ensureContext()) return;

    const playNow = () => {
      if (!ctx || ctx.state !== "running") return;
      callback();
    };

    if (ctx.state === "running") {
      playNow();
      return;
    }

    ctx.resume().then(playNow).catch(() => {});
  }

  function blip({
    freq = 420,
    endFreq = 260,
    duration = 0.12,
    start = 0,
    gain = 0.07,
    type = "sine",
    q = 8,
  }) {
    const now = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(480, now + duration);
    filter.Q.value = q;

    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + duration * 0.18);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(amp);
    amp.connect(master);

    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  function noiseSplash({ duration = 0.08, start = 0, gain = 0.02 }) {
    const now = ctx.currentTime + start;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }

    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();

    src.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(820, now);
    filter.Q.value = 0.9;

    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter);
    filter.connect(amp);
    amp.connect(master);

    src.start(now);
  }

  function playMove() {
    withAudio(() => {
      blip({ freq: 560, endFreq: 330, duration: 0.11, gain: 0.05, type: "triangle", q: 3 });
      noiseSplash({ duration: 0.05, start: 0.01, gain: 0.015 });
    });
  }

  function playSpawn(level = 1) {
    withAudio(() => {
      const pitch = 520 + level * 22;
      blip({ freq: pitch, endFreq: pitch * 0.78, duration: 0.1, gain: 0.035, type: "sine", q: 4 });
    });
  }

  function playMerge(intensity = 1) {
    withAudio(() => {
      const base = 290 + intensity * 38;
      blip({ freq: base, endFreq: base * 0.55, duration: 0.17, gain: 0.085, type: "triangle", q: 10 });
      blip({ freq: base * 1.6, endFreq: base * 0.9, duration: 0.12, gain: 0.05, start: 0.018, type: "sine", q: 6 });
      noiseSplash({ duration: 0.1, start: 0.016, gain: 0.018 });
    });
  }

  function playUiTap() {
    withAudio(() => {
      blip({ freq: 620, endFreq: 400, duration: 0.08, gain: 0.03, type: "sine", q: 2 });
    });
  }

  function playGameOver() {
    withAudio(() => {
      blip({ freq: 260, endFreq: 120, duration: 0.26, gain: 0.06, type: "sawtooth", q: 4 });
    });
  }

  return {
    unlock,
    playMove,
    playSpawn,
    playMerge,
    playUiTap,
    playGameOver,
  };
}

window.addEventListener("resize", () => renderBoard());
