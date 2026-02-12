:root {
  --bg: #f4f2ee;
  --panel: #ffffff;
  --ink: #222222;
  --muted: #6e6a65;
  --board: #c7bfb6;
  --empty: rgba(255, 255, 255, 0.32);
  --tile-size: min(18vw, 90px);
  --gap: min(2vw, 10px);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at 20% 20%, #ffffff, var(--bg));
  color: var(--ink);
  font-family: "Inter", "Noto Sans JP", system-ui, -apple-system, sans-serif;
}

.game-wrapper {
  width: min(92vw, 460px);
  display: grid;
  gap: 14px;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

h1 {
  font-size: clamp(1.4rem, 4vw, 2rem);
  margin: 0;
}

.subtitle,
.controls {
  margin: 0;
  color: var(--muted);
  font-size: 0.92rem;
}

.restart-btn {
  border: none;
  border-radius: 10px;
  background: #635b52;
  color: #fff;
  padding: 10px 14px;
  font-weight: 700;
  cursor: pointer;
}

.scoreboard {
  display: flex;
  gap: 10px;
}

.score-box {
  flex: 1;
  background: var(--panel);
  border-radius: 10px;
  padding: 10px;
  display: grid;
  text-align: center;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
}

.timer-box strong {
  color: #2a6666;
  transition: color 120ms ease, text-shadow 120ms ease, transform 120ms ease;
}

.timer-box strong.bonus-mid {
  color: #d0841e;
  text-shadow: 0 0 10px rgba(237, 150, 42, 0.28);
}

.timer-box strong.bonus-high {
  color: #de4e95;
  text-shadow: 0 0 12px rgba(225, 70, 136, 0.38);
  transform: scale(1.05);
}

.timer-box strong.bonus-max {
  color: #8e41ff;
  text-shadow: 0 0 14px rgba(143, 66, 255, 0.5);
  transform: scale(1.08);
}

.score-box span {
  color: var(--muted);
  font-size: 0.8rem;
}

.score-box strong {
  font-size: 1.2rem;
}

.turn-gauge {
  width: 100%;
  height: 10px;
  border-radius: 999px;
  background: #d9d4cd;
  overflow: hidden;
}

.turn-gauge-fill {
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, #3ec7cb, #3ba357 85%);
  transform-origin: left center;
  transition: transform 90ms linear, background-color 90ms linear;
}

.board-wrap {
  position: relative;
}

.board {
  position: relative;
  background: var(--board);
  border-radius: 14px;
  padding: var(--gap);
  display: grid;
  grid-template-columns: repeat(4, var(--tile-size));
  grid-template-rows: repeat(4, var(--tile-size));
  gap: var(--gap);
  touch-action: none;
}

.cell {
  border-radius: 10px;
  background: var(--empty);
}

.tile-layer {
  position: absolute;
  inset: var(--gap);
  display: grid;
  grid-template-columns: repeat(4, var(--tile-size));
  grid-template-rows: repeat(4, var(--tile-size));
  gap: var(--gap);
  pointer-events: none;
}

.tile {
  --from-x: 0px;
  --from-y: 0px;
  position: relative;
  overflow: hidden;
  isolation: isolate;
  width: var(--tile-size);
  height: var(--tile-size);
  border-radius: 14px;
  display: grid;
  place-items: center;
  color: #ffffff;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-shadow: 0 1px 3px rgba(8, 20, 33, 0.4);
  box-shadow: 0 8px 16px rgba(10, 36, 64, 0.26), inset 0 -6px 12px rgba(255, 255, 255, 0.14);
  transform: translate(0, 0) scale(1);
  will-change: transform, filter;
}

.tile::before {
  content: "";
  position: absolute;
  inset: 6% 10% 44% 10%;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.65), rgba(255, 255, 255, 0));
  opacity: 0.75;
  pointer-events: none;
}

.tile::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  border: 1px solid rgba(255, 255, 255, 0.22);
  pointer-events: none;
}

.tile-moving {
  transform: translate(var(--from-x), var(--from-y)) scale(0.985);
  filter: saturate(1.08) brightness(1.04);
}

.tile-moving-active {
  transition: transform 260ms cubic-bezier(0.17, 0.84, 0.22, 1.04), filter 260ms ease;
  transform: translate(0, 0) scale(1);
  filter: saturate(1) brightness(1);
}

.tile-spawned {
  animation: droplet-pop 230ms cubic-bezier(0.16, 0.86, 0.34, 1.2);
}

.tile-merged {
  animation: syrup-merge 360ms cubic-bezier(0.18, 0.89, 0.22, 1.15);
}

@keyframes droplet-pop {
  0% { opacity: 0; transform: translateY(5px) scale(0.72, 1.24); filter: saturate(1.25) brightness(1.14); }
  55% { opacity: 1; transform: translateY(-2px) scale(1.06, 0.95); }
  100% { transform: translateY(0) scale(1, 1); filter: saturate(1) brightness(1); }
}

@keyframes syrup-merge {
  0% { transform: scale(1.22, 0.78); filter: brightness(1.24) saturate(1.35); box-shadow: 0 0 0 rgba(255, 255, 255, 0.55), 0 8px 16px rgba(10, 36, 64, 0.26); }
  28% { transform: scale(0.86, 1.2); }
  54% { transform: scale(1.09, 0.93); box-shadow: 0 0 24px rgba(255, 255, 255, 0.38), 0 8px 16px rgba(10, 36, 64, 0.26); }
  100% { transform: scale(1, 1); filter: brightness(1) saturate(1); box-shadow: 0 8px 16px rgba(10, 36, 64, 0.26), inset 0 -6px 12px rgba(255, 255, 255, 0.14); }
}

.ranking {
  background: var(--panel);
  border-radius: 10px;
  padding: 12px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
}

.ranking h2 {
  margin: 0 0 8px;
  font-size: 1rem;
}

.ranking ol {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 4px;
}

.ranking li {
  font-weight: 700;
  color: #4d4740;
}

.game-over {
  position: absolute;
  inset: 0;
  background: rgba(42, 36, 32, 0.78);
  display: grid;
  place-items: center;
  border-radius: 14px;
  gap: 10px;
  color: #fff;
  text-align: center;
}

.game-over p { margin: 0; font-size: 1.4rem; font-weight: 800; }
.hidden { display: none; }

@media (max-width: 420px) {
  .topbar { align-items: flex-start; flex-direction: column; }
  .restart-btn { width: 100%; }
  .scoreboard { flex-direction: column; }
}
