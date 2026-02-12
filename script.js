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

  // 非対応ブラウザ向け no-op 実装
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

      // 出力を安定させるために軽くコンプを通す
      compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -26;
      compressor.knee.value = 22;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.18;

      master = ctx.createGain();
      master.gain.value = 0.55;

      master.connect(compressor);
      compressor.connect(ctx.destination);
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

  function semitone(baseFreq, offset) {
    return baseFreq * (2 ** (offset / 12));
  }

  // 高速アタック + 短めディケイの ADSR
  function playVoice(freq, {
    start = 0,
    gain = 0.12,
    attack = 0.008,
    decay = 0.13,
    sustain = 0.42,
    release = 0.2,
    type = "triangle",
    lowpass = 3800,
  } = {}) {
    const now = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    const lp = ctx.createBiquadFilter();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    lp.type = "lowpass";
    lp.frequency.setValueAtTime(lowpass, now);

    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), now + attack);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain * sustain), now + attack + decay);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay + release);

    osc.connect(lp);
    lp.connect(amp);
    amp.connect(master);

    osc.start(now);
    osc.stop(now + attack + decay + release + 0.03);
  }

  // マージ後タイル値を log2 で段階化して、メジャースケール内の三度堆積を構築
  function buildMergeChord(tileValue) {
    const step = Math.max(1, Math.round(Math.log2(tileValue))); // 2->1, 4->2, 8->3 ...
    const c4 = 261.63;

    // 要件: 2=C4, 4=C+E, 8=C+E+G
    if (tileValue <= 2) return [c4];
    if (tileValue <= 4) return [c4, semitone(c4, 4)];
    if (tileValue <= 8) return [c4, semitone(c4, 4), semitone(c4, 7)];

    // 16以上: メジャー系の三度堆積（C E G B D F# A ...）
    const majorStack = [0, 4, 7, 11, 14, 18, 21, 24];
    const count = Math.min(3 + Math.floor((step - 3) / 1), 6); // 同時発音を最大6音に抑制

    // 大きい値ほど少し上のオクターブへ移動
    const octaveLift = Math.min(Math.floor((step - 1) / 4), 2) * 12;

    const notes = [];
    for (let i = 0; i < count; i += 1) {
      const offset = majorStack[i] + octaveLift;
      notes.push(semitone(c4, offset));
    }

    return notes;
  }

  // 128以上で短い上昇アルペジオを追加
  function playAscendingArpeggio(chordFreqs, baseStart, gainBase) {
    const seq = [...chordFreqs].slice(0, 5);
    seq.forEach((freq, i) => {
      playVoice(freq * 2, {
        start: baseStart + i * 0.045,
        gain: gainBase * 0.55,
        attack: 0.004,
        decay: 0.08,
        sustain: 0.35,
        release: 0.11,
        type: "sine",
        lowpass: 5200,
      });
    });
  }

  // 要件関数: tileValue と chainCount に応じてマージ音を生成
  function playMergeSound(tileValue, chainCount = 1) {
    withAudio(() => {
      const safeValue = Math.max(2, tileValue);
      const step = Math.max(1, Math.round(Math.log2(safeValue)));
      const chord = buildMergeChord(safeValue);

      // 連鎖が増えるほど半音ずつ上昇（過度な上昇は抑制）
      const chainShift = Math.min(Math.max(chainCount - 1, 0), 6);

      // 値が上がるほど僅かに音量アップ
      const levelGain = Math.min(0.1 + step * 0.008, 0.2);

      chord.forEach((freq, i) => {
        const voicedFreq = freq * (2 ** (chainShift / 12));
        const spread = i * 0.014;
        const voicingGain = levelGain * (1 - Math.min(i * 0.12, 0.45));

        playVoice(voicedFreq, {
          start: spread,
          gain: voicingGain,
          attack: 0.006,
          decay: 0.12,
          sustain: 0.4,
          release: Math.min(0.16 + step * 0.01, 0.3),
          type: i % 3 === 0 ? "triangle" : "sine",
          lowpass: 3000 + Math.min(step * 180, 1400),
        });
      });

      if (safeValue >= 128) {
        playAscendingArpeggio(chord, 0.035, levelGain);
      }
    });
  }

  function playMove() {
    withAudio(() => {
      playVoice(1200, {
        gain: 0.075,
        attack: 0.002,
        decay: 0.03,
        sustain: 0.25,
        release: 0.045,
        type: "square",
        lowpass: 5200,
      });
    });
  }

  function playSpawn(level = 1) {
    withAudio(() => {
      const pitch = 590 + level * 24;
      playVoice(pitch, { gain: 0.07, attack: 0.005, decay: 0.08, sustain: 0.38, release: 0.12, type: "sine", lowpass: 4200 });
      playVoice(pitch * 1.25, { start: 0.01, gain: 0.035, attack: 0.004, decay: 0.07, sustain: 0.3, release: 0.1, type: "triangle", lowpass: 4600 });
    });
  }

  function playUiTap() {
    withAudio(() => {
      playVoice(760, {
        gain: 0.045,
        attack: 0.003,
        decay: 0.04,
        sustain: 0.3,
        release: 0.06,
        type: "sine",
      });
    });
  }

  function playGameOver() {
    withAudio(() => {
      playVoice(280, {
        gain: 0.095,
        attack: 0.007,
        decay: 0.18,
        sustain: 0.36,
        release: 0.2,
        type: "sawtooth",
        lowpass: 2200,
      });
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
