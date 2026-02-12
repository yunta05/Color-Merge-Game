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

const touch = {
  x: 0,
  y: 0,
  active: false,
};

highScoreElement.textContent = String(highScore);
createBoardSkeleton();
initGame();

restartButton.addEventListener("click", initGame);
retryButton.addEventListener("click", initGame);
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

function handleKeydown(event) {
  if (isGameOver) return;

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
  const { nextBoard, moved, gainedScore, mergedMask } = move(board, direction);
  if (!moved) return;

  board = nextBoard;
  updateScore(gainedScore);
  spawnRandomTile();
  renderBoard(mergedMask);

  if (isBoardLocked(board)) {
    isGameOver = true;
    gameOverElement.classList.remove("hidden");
  }
}

function move(source, direction) {
  const next = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  const mergedMask = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  let moved = false;
  let gainedScore = 0;

  const iterate = (index) => {
    const line = readLine(source, direction, index).filter(Boolean);
    const mergedLine = [];

    for (let i = 0; i < line.length; i += 1) {
      const current = line[i];
      const following = line[i + 1];

      if (following && current.level === following.level) {
        const mergedTile = { level: current.level + 1 };
        mergedLine.push({ tile: mergedTile, merged: true });
        gainedScore += scoreByLevel(mergedTile.level);
        i += 1;
      } else {
        mergedLine.push({ tile: { level: current.level }, merged: false });
      }
    }

    while (mergedLine.length < SIZE) {
      mergedLine.push({ tile: null, merged: false });
    }

    writeLine(next, mergedMask, direction, index, mergedLine);

    for (let pos = 0; pos < SIZE; pos += 1) {
      const [r, c] = positionFor(direction, index, pos);
      const original = source[r][c];
      const rewritten = next[r][c];
      if ((original && !rewritten) || (!original && rewritten) || (original && rewritten && original.level !== rewritten.level)) {
        moved = true;
      }
    }
  };

  for (let i = 0; i < SIZE; i += 1) {
    iterate(i);
  }

  return { nextBoard: next, moved, gainedScore, mergedMask };
}

function readLine(source, direction, index) {
  const values = [];
  for (let pos = 0; pos < SIZE; pos += 1) {
    const [r, c] = positionFor(direction, index, pos);
    values.push(source[r][c]);
  }
  return values;
}

function writeLine(target, mergedMask, direction, index, line) {
  for (let pos = 0; pos < SIZE; pos += 1) {
    const [r, c] = positionFor(direction, index, pos);
    const item = line[pos];
    target[r][c] = item.tile;
    mergedMask[r][c] = item.merged;
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

  if (!empties.length) return;

  const [row, col] = empties[Math.floor(Math.random() * empties.length)];
  board[row][col] = { level: Math.random() < 0.9 ? 1 : 2 };
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

function renderBoard(mergedMask = Array.from({ length: SIZE }, () => Array(SIZE).fill(false))) {
  const oldLayer = boardElement.querySelector(".tile-layer");
  if (oldLayer) oldLayer.remove();

  const tileLayer = document.createElement("div");
  tileLayer.className = "tile-layer";

  const tileSize = getTileStep();

  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const tile = board[r][c];
      if (!tile) continue;

      const node = document.createElement("div");
      node.className = "tile";
      node.textContent = String(tile.level);
      node.style.backgroundColor = colorForLevel(tile.level);
      node.style.transform = `translate(${c * tileSize}px, ${r * tileSize}px)`;
      node.dataset.merged = String(mergedMask[r][c]);
      tileLayer.appendChild(node);
    }
  }

  boardElement.appendChild(tileLayer);
}

function getTileStep() {
  const styles = getComputedStyle(boardElement);
  const gap = Number.parseFloat(styles.gap) || 0;
  const width = boardElement.clientWidth;
  const tile = (width - gap * (SIZE + 1)) / SIZE;
  return tile + gap;
}

window.addEventListener("resize", () => renderBoard());
