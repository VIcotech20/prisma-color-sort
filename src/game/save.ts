import type { Lang, SaveState } from "./types";
import { MAX_LIVES, LIFE_MS } from "./engine";

const KEY = "prisma.save.v1";
const SAVE_VERSION = 2;

const defaults: SaveState = {
  version: SAVE_VERSION,
  level: 1,
  maxUnlocked: 1,
  stars: {},
  coins: 120,
  lives: MAX_LIVES,
  lifeAt: Date.now(),
  undos: 6,
  hints: 3,
  extraTubes: 1,
  removeAds: false,
  mute: false,
  shake: true,
  lang: "es",
  seenTutorial: false,
  dailyDate: "",
  dailyDone: false,
  totalWins: 0,
};

function migrate(raw: Partial<SaveState>): SaveState {
  const merged: SaveState = { ...defaults, ...raw, version: SAVE_VERSION };
  if ((raw.version ?? 1) < 2) {
    merged.coins = Math.max(merged.coins, 120);
  }
  return merged;
}

export function loadSave(): SaveState {
  try {
    const txt = localStorage.getItem(KEY);
    if (!txt) return { ...defaults, lifeAt: Date.now() };
    const parsed = JSON.parse(txt) as Partial<SaveState>;
    return tickLives(migrate(parsed));
  } catch {
    return { ...defaults, lifeAt: Date.now() };
  }
}

export function writeSave(state: SaveState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode / quota */
  }
}

export function tickLives(state: SaveState, now = Date.now()): SaveState {
  if (state.lives >= MAX_LIVES) return { ...state, lives: MAX_LIVES, lifeAt: now };
  const elapsed = Math.max(0, now - state.lifeAt);
  const gained = Math.floor(elapsed / LIFE_MS);
  if (gained <= 0) return state;
  const lives = Math.min(MAX_LIVES, state.lives + gained);
  const lifeAt = lives >= MAX_LIVES ? now : state.lifeAt + gained * LIFE_MS;
  return { ...state, lives, lifeAt };
}

export function nextLifeMs(state: SaveState, now = Date.now()): number {
  if (state.lives >= MAX_LIVES) return 0;
  return Math.max(0, state.lifeAt + LIFE_MS - now);
}

export function formatMs(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function detectLang(): Lang {
  if (typeof navigator === "undefined") return "es";
  return navigator.language.toLowerCase().startsWith("en") ? "en" : "es";
}
