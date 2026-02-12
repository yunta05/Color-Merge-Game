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
    sound.playMergeNotes(mergedLevels);
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
      playMergeNotes() {},
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
      compressor.threshold.value = -28;
      compressor.knee.value = 22;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.16;

      master = ctx.createGain();
      master.gain.value = 0.52;

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

  function tone({
    freq = 420,
    endFreq = 260,
    duration = 0.12,
    start = 0,
    gain = 0.07,
    type = "sine",
    q = 8,
    pan = 0,
    lowpassStart = 2200,
    lowpassEnd = 520,
  }) {
    const now = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const panner = ctx.createStereoPanner();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(lowpassStart, now);
    filter.frequency.exponentialRampToValueAtTime(lowpassEnd, now + duration);
    filter.Q.value = q;

    panner.pan.setValueAtTime(pan, now);

    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + duration * 0.16);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(amp);
    amp.connect(panner);
    panner.connect(master);

    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  function splash({ duration = 0.08, start = 0, gain = 0.02, freq = 760 }) {
    const now = ctx.currentTime + start;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i += 1) {
      const decay = 1 - i / length;
      data[i] = (Math.random() * 2 - 1) * decay * decay;
    }

    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();

    src.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(freq, now);
    filter.Q.value = 1.25;

    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter);
    filter.connect(amp);
    amp.connect(master);

    src.start(now);
  }


  function pianoFrequencyForLevel(level) {
    const scale = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25];
    const octave = Math.floor((Math.max(1, level) - 1) / scale.length);
    const base = scale[(Math.max(1, level) - 1) % scale.length];
    return base * (2 ** octave);
  }

  function semitone(baseFreq, offset) {
    return baseFreq * (2 ** (offset / 12));
  }

  function chordFrequenciesForLevel(level) {
    const base = pianoFrequencyForLevel(level);

    if (level <= 2) {
      return [base, semitone(base, 4), semitone(base, 7)];
    }
    if (level <= 4) {
      return [base, semitone(base, 4), semitone(base, 7), semitone(base, 11)];
    }
    if (level <= 6) {
      return [base, semitone(base, 3), semitone(base, 7), semitone(base, 10), semitone(base, 14)];
    }
    if (level <= 8) {
      return [base, semitone(base, 4), semitone(base, 7), semitone(base, 11), semitone(base, 14), semitone(base, 18)];
    }
    return [base, semitone(base, 4), semitone(base, 7), semitone(base, 11), semitone(base, 14), semitone(base, 18), semitone(base, 21)];
  }

  function playPianoNote(freq, { start = 0, gain = 0.12, duration = 0.42 } = {}) {
    const now = ctx.currentTime + start;
    const amp = ctx.createGain();
    const low = ctx.createOscillator();
    const mid = ctx.createOscillator();
    const high = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();

    low.type = "triangle";
    mid.type = "sine";
    high.type = "triangle";

    low.frequency.setValueAtTime(freq, now);
    mid.frequency.setValueAtTime(freq * 2, now);
    high.frequency.setValueAtTime(freq * 3, now);

    lp.type = "lowpass";
    lp.frequency.setValueAtTime(3200, now);
    lp.frequency.exponentialRampToValueAtTime(1700, now + 0.3);

    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.012);
    amp.gain.exponentialRampToValueAtTime(gain * 0.35, now + Math.min(0.1, duration * 0.28));
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    low.connect(lp);
    mid.connect(lp);
    high.connect(lp);
    lp.connect(amp);
    amp.connect(master);

    low.start(now);
    mid.start(now);
    high.start(now);
    low.stop(now + duration + 0.03);
    mid.stop(now + duration + 0.03);
    high.stop(now + duration + 0.03);
  }

  function playMove() {
    withAudio(() => {
      tone({
        freq: 1300,
        endFreq: 980,
        duration: 0.035,
        gain: 0.085,
        type: "square",
        q: 1.4,
        lowpassStart: 5200,
        lowpassEnd: 1800,
      });
    });
  }

  function playSpawn(level = 1) {
    withAudio(() => {
      const pitch = 590 + level * 28;
      tone({ freq: pitch, endFreq: pitch * 0.8, duration: 0.11, gain: 0.065, type: "sine", q: 5, pan: 0.06 });
      tone({ freq: pitch * 1.3, endFreq: pitch * 0.92, duration: 0.09, start: 0.01, gain: 0.03, type: "triangle", q: 4, pan: -0.06 });
    });
  }

  function playMergeNotes(levels = []) {
    withAudio(() => {
      const sorted = [...levels].sort((a, b) => a - b);
      let cursor = 0;

      sorted.forEach((level, mergeIndex) => {
        const chord = chordFrequenciesForLevel(level);
        const sparkle = Math.min(Math.max(level - 5, 0), 4);
        const baseGain = Math.min(0.1 + level * 0.01, 0.2);
        const noteDuration = Math.min(0.34 + level * 0.018, 0.58);

        chord.forEach((freq, chordIndex) => {
          const stagger = chordIndex * 0.016;
          const gainScale = 1 - Math.min(chordIndex * 0.1, 0.42);
          playPianoNote(freq, {
            start: cursor + stagger,
            gain: baseGain * gainScale,
            duration: noteDuration,
          });
        });

        for (let i = 0; i < sparkle; i += 1) {
          const high = semitone(chord[0], 12 + i * 3);
          playPianoNote(high, {
            start: cursor + 0.05 + i * 0.03,
            gain: 0.055,
            duration: 0.2,
          });
        }

        const splashGain = Math.min(0.014 + level * 0.0022, 0.04);
        splash({
          duration: Math.min(0.06 + level * 0.005, 0.12),
          start: cursor + 0.02,
          gain: splashGain,
          freq: 760 + Math.min(level * 35, 420),
        });

        cursor += 0.09 + Math.min(level * 0.005, 0.04) + mergeIndex * 0.004;
      });
    });
  }

  function playUiTap() {
    withAudio(() => {
      tone({ freq: 700, endFreq: 440, duration: 0.08, gain: 0.05, type: "sine", q: 3 });
    });
  }

  function playGameOver() {
    withAudio(() => {
      tone({ freq: 280, endFreq: 115, duration: 0.3, gain: 0.095, type: "sawtooth", q: 5, lowpassStart: 1700, lowpassEnd: 260 });
      splash({ duration: 0.14, start: 0.03, gain: 0.025, freq: 520 });
    });
  }

  return {
    unlock,
    playMove,
    playSpawn,
    playMergeNotes,
    playUiTap,
    playGameOver,
  };
}

window.addEventListener("resize", () => renderBoard());
