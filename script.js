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
  const { nextBoard, moved, gainedScore, motionMap, mergedIds, mergedLevels } = move(board, direction);
  if (!moved) return;

  board = nextBoard;
  updateScore(gainedScore);
  const spawnedTile = spawnRandomTile();
  renderBoard({ motionMap, mergedIds, spawnedId: spawnedTile?.id });

  sound.playMove();
  if (spawnedTile) {
    sound.playSpawn(spawnedTile.level);
  }
  if (mergedLevels.length > 0) {
    // 1ターン内の連鎖数を段階的に渡して達成感を増幅する
    mergedLevels
      .slice()
      .sort((a, b) => a - b)
      .forEach((level, index) => {
        const tileValue = 2 ** level;
        sound.playMergeSound(tileValue, index + 1);
      });
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
  const mergedLevels = [];
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
        mergedLevels.push(mergedTile.level);
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

  return { nextBoard: next, moved, gainedScore, motionMap, mergedIds, mergedLevels };
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
      playMergeSound() {},
      playUiTap() {},
      playGameOver() {},
    };
  }

  let ctx = null;
  let master = null;
  let compressor = null;

  function ensureContext() {
    if (ctx) return true;

    try {
      ctx = new AudioCtx();
      compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -22;
      compressor.knee.value = 12;
      compressor.ratio.value = 6;
      compressor.attack.value = 0.002;
      compressor.release.value = 0.08;

      master = ctx.createGain();
      master.gain.value = 0.5;

      master.connect(compressor);
      compressor.connect(ctx.destination);
      return true;
    } catch (error) {
      return false;
    }
  }

  function unlock() {
    if (!ensureContext()) return;
    if (ctx.state === "suspended") ctx.resume();
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

  // 全効果音の基本となる、硬質で短いクリック音
  function playClick({
    freq = 1800,
    endFreq = 700,
    gain = 0.07,
    start = 0,
    duration = 0.035,
    q = 2.2,
  } = {}) {
    const now = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(80, endFreq), now + duration);

    filter.type = "highpass";
    filter.frequency.setValueAtTime(600, now);
    filter.Q.value = q;

    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.0025);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(amp);
    amp.connect(master);

    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  function playMove() {
    withAudio(() => {
      playClick({ freq: 1700, endFreq: 760, gain: 0.055, duration: 0.03 });
    });
  }

  function playSpawn(level = 1) {
    withAudio(() => {
      const lift = Math.min(level * 45, 260);
      playClick({ freq: 1650 + lift, endFreq: 840 + lift * 0.3, gain: 0.06, duration: 0.032 });
    });
  }

  // 既存ゲームロジックから呼ばれる API を維持
  function playMergeSound(tileValue, chainCount = 1) {
    withAudio(() => {
      const step = Math.max(1, Math.round(Math.log2(Math.max(2, tileValue))));
      const chain = Math.max(1, chainCount);

      // 値と連鎖が上がるほど高く・少し強いクリックを重ねる
      const baseFreq = 1500 + Math.min(step * 70, 900) + Math.min(chain * 35, 220);
      const baseGain = Math.min(0.06 + step * 0.004 + chain * 0.003, 0.14);

      playClick({
        freq: baseFreq,
        endFreq: baseFreq * 0.46,
        gain: baseGain,
        duration: 0.033,
      });

      // 連鎖感のための追従クリック
      playClick({
        freq: baseFreq * 1.22,
        endFreq: baseFreq * 0.62,
        gain: baseGain * 0.75,
        start: 0.014,
        duration: 0.028,
      });

      // 大きな値は3発目を追加（派手さは残しつつ全体はクリック系）
      if (tileValue >= 128) {
        playClick({
          freq: baseFreq * 1.4,
          endFreq: baseFreq * 0.76,
          gain: baseGain * 0.62,
          start: 0.03,
          duration: 0.026,
        });
      }
    });
  }

  function playUiTap() {
    withAudio(() => {
      playClick({ freq: 1850, endFreq: 980, gain: 0.05, duration: 0.026 });
    });
  }

  function playGameOver() {
    withAudio(() => {
      playClick({ freq: 980, endFreq: 320, gain: 0.08, duration: 0.06, q: 1.2 });
      playClick({ freq: 760, endFreq: 250, gain: 0.05, duration: 0.05, start: 0.035, q: 1.1 });
    });
  }

  return {
    unlock,
    playMove,
    playSpawn,
    playMergeSound,
    playUiTap,
    playGameOver,
  };
}

window.addEventListener("resize", () => renderBoard());
