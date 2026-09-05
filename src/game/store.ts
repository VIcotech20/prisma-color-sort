import { create } from "zustand";
import type { Screen, Session, SaveState } from "./types";
import {
  MAX_LIVES,
  MAX_LEVEL,
  addExtraTube,
  applyPour,
  dailySeed,
  findHint,
  isComplete,
  isSolved,
  makeBoard,
  pourAmount,
  todayKey,
} from "./engine";
import { loadSave, writeSave, tickLives } from "./save";
import { setMuted, sfxPlay, startBed, stopBed, unlockAudio } from "./audio";
import { track } from "./analytics";
import { commercialBreak, gameplayStart, gameplayStop, hasRewardedSdk, rewardedBreak } from "./ads";

type AdKind = "life" | "undo" | "hint" | "extra" | null;
export type Overlay = "none" | "win" | "pause" | "nolives" | "ad";

type GameStore = {
  ready: boolean;
  save: SaveState;
  screen: Screen;
  session: Session | null;
  overlay: Overlay;
  adKind: AdKind;
  shopMsg: "short" | "ok" | null;
  hintPair: [number, number] | null;
  pendingStars: number;
  pendingCoins: number;
  init: () => void;
  persist: () => void;
  setScreen: (s: Screen) => void;
  startLevel: (level: number, mode?: Session["mode"], spendLife?: boolean) => boolean;
  tapTube: (index: number) => void;
  undo: () => void;
  hint: () => void;
  extra: () => void;
  restart: () => void;
  watchAd: (kind: Exclude<AdKind, null>) => void;
  finishAd: () => void;
  buy: (sku: "undo" | "hint" | "extra" | "life") => void;
  claimWin: (go: "home" | "next") => void;
  setOverlay: (o: Overlay) => void;
  toggleMute: () => void;
  toggleShake: () => void;
  setLang: (lang: SaveState["lang"]) => void;
  markTutorial: () => void;
};

function reduceMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function haptic(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
}

const POUR_MS = 620;

export const PRICES = { undo: 40, hint: 60, extra: 90, life: 30 } as const;

function freshSession(level: number, mode: Session["mode"]): Session {
  const seedLevel = mode === "daily" ? (dailySeed() % 80) + 12 : level;
  return {
    mode,
    level,
    board: makeBoard(seedLevel, mode),
    history: [],
    selected: null,
    shaking: null,
    completeFlash: [],
    hintsUsed: 0,
    extraUsed: false,
    undosUsed: 0,
    combo: 0,
    locked: false,
    pouring: null,
  };
}

export function starsFor(session: Session): number {
  if (session.hintsUsed === 0 && !session.extraUsed && session.undosUsed <= 2) return 3;
  if (session.hintsUsed <= 1 && session.undosUsed <= 5) return 2;
  return 1;
}

export function coinsFor(session: Session, stars: number): number {
  const base = session.mode === "daily" ? 80 : 12 + Math.min(session.level, 40);
  const streak = 1 + Math.min(session.combo, 10) * 0.05;
  return Math.round(base * stars * streak);
}

export const useGame = create<GameStore>((set, get) => ({
  ready: false,
  save: loadSave(),
  screen: "home",
  session: null,
  overlay: "none",
  adKind: null,
  shopMsg: null,
  hintPair: null,
  pendingStars: 0,
  pendingCoins: 0,

  init: () => {
    const save = tickLives(loadSave());
    const today = todayKey();
    if (save.dailyDate !== today) {
      save.dailyDate = today;
      save.dailyDone = false;
    }
    setMuted(save.mute);
    writeSave(save);
    track("session_start");
    set({
      save,
      ready: true,
      overlay: "none",
      screen: "home",
      session: null,
    });
  },

  persist: () => {
    const s = tickLives(get().save);
    writeSave(s);
    set({ save: s });
  },

  setScreen: (screen) => {
    if (screen !== "play") {
      gameplayStop();
      stopBed();
    }
    set({ screen, overlay: "none", shopMsg: null });
  },

  startLevel: (level, mode = "campaign", spendLife = true) => {
    unlockAudio();
    let save = tickLives(get().save);
    if (mode === "campaign" && level > save.maxUnlocked) return false;
    const replay = mode === "campaign" && (save.stars[String(level)] ?? 0) > 0;
    const intro = mode === "campaign" && level <= 10;
    if (spendLife && !replay && !intro) {
      if (save.lives <= 0) {
        track("out_of_lives", { level });
        set({ save, overlay: "nolives" });
        return false;
      }
      save = { ...save, lives: save.lives - 1, lifeAt: Date.now() };
      writeSave(save);
    }
    set({
      save,
      screen: "play",
      overlay: "none",
      hintPair: null,
      pendingStars: 0,
      pendingCoins: 0,
      session: freshSession(level, mode),
    });
    track("level_start", { level, mode, replay });
    startBed();
    gameplayStart();
    return true;
  },

  tapTube: (index) => {
    const { session } = get();
    if (!session || session.locked || session.pouring || get().overlay !== "none") return;
    const { selected } = session;
    let board = session.board;

    if (selected === null) {
      if (board.veiled.includes(index)) {
        board = { ...board, veiled: board.veiled.filter((i) => i !== index) };
      }
      if (board.tubes[index].length === 0) {
        sfxPlay.invalid();
        haptic(8);
        set({ session: { ...session, board, shaking: index } });
        window.setTimeout(() => {
          const cur = get().session;
          if (cur) set({ session: { ...cur, shaking: null } });
        }, 280);
        return;
      }
      sfxPlay.select();
      set({ session: { ...session, board, selected: index }, hintPair: null });
      return;
    }

    if (selected === index) {
      set({ session: { ...session, selected: null } });
      return;
    }

    const amt = pourAmount(board.tubes[selected], board.tubes[index], board.height);
    const next = applyPour(board, selected, index);
    if (!next || amt === 0) {
      sfxPlay.invalid();
      haptic(8);
      set({ session: { ...session, shaking: index, selected: null, combo: 0 } });
      window.setTimeout(() => {
        const cur = get().session;
        if (cur) set({ session: { ...cur, shaking: null } });
      }, 280);
      return;
    }

    const color = board.tubes[selected][board.tubes[selected].length - 1] ?? 0;
    const from = selected;
    const to = index;
    sfxPlay.pour(color);
    haptic(14);

    const finishPour = () => {
      const cur = get().session;
      if (!cur || !cur.pouring || cur.pouring.from !== from || cur.pouring.to !== to) return;
      const completeFlash: number[] = [];
      next.tubes.forEach((t, i) => {
        if (isComplete(t, next.height) && !isComplete(board.tubes[i], board.height)) {
          completeFlash.push(i);
        }
      });
      if (completeFlash.length) {
        sfxPlay.complete();
        haptic(24);
      }
      const locked = isSolved(next);
      const updated: Session = {
        ...cur,
        board: next,
        history: [...cur.history, board.tubes.map((t) => t.slice())],
        selected: null,
        completeFlash,
        combo: cur.combo + 1,
        locked,
        pouring: null,
      };
      set({ session: updated });
      if (locked) {
        sfxPlay.win();
        const stars = starsFor(updated);
        const coins = coinsFor(updated, stars);
        window.setTimeout(
          () => set({ overlay: "win", pendingStars: stars, pendingCoins: coins }),
          520,
        );
      }
    };

    if (reduceMotion()) {
      finishPour();
      return;
    }

    set({
      hintPair: null,
      session: {
        ...session,
        selected: null,
        pouring: { from, to, color, amt },
      },
    });
    window.setTimeout(finishPour, POUR_MS);
  },

  undo: () => {
    const { session, save } = get();
    if (!session || session.locked || session.pouring) return;
    if (session.history.length === 0) {
      sfxPlay.invalid();
      return;
    }
    if (save.undos <= 0) {
      get().watchAd("undo");
      return;
    }
    const tubes = session.history[session.history.length - 1];
    const nextSave = { ...save, undos: save.undos - 1 };
    writeSave(nextSave);
    sfxPlay.click();
    set({
      save: nextSave,
      hintPair: null,
      session: {
        ...session,
        board: { ...session.board, tubes: tubes.map((t) => t.slice()) },
        history: session.history.slice(0, -1),
        selected: null,
        undosUsed: session.undosUsed + 1,
      },
    });
  },

  hint: () => {
    const { session, save } = get();
    if (!session || session.locked || session.pouring) return;
    if (save.hints <= 0) {
      get().watchAd("hint");
      return;
    }
    const pair = findHint(session.board);
    if (!pair) {
      sfxPlay.invalid();
      return;
    }
    const nextSave = { ...save, hints: save.hints - 1 };
    writeSave(nextSave);
    sfxPlay.click();
    set({
      save: nextSave,
      hintPair: pair,
      session: { ...session, hintsUsed: session.hintsUsed + 1, selected: pair[0] },
    });
  },

  extra: () => {
    const { session, save } = get();
    if (!session || session.locked || session.pouring || session.extraUsed) return;
    if (save.extraTubes <= 0) {
      get().watchAd("extra");
      return;
    }
    const nextSave = { ...save, extraTubes: save.extraTubes - 1 };
    writeSave(nextSave);
    sfxPlay.complete();
    set({
      save: nextSave,
      session: {
        ...session,
        board: addExtraTube(session.board),
        extraUsed: true,
        selected: null,
      },
    });
  },

  restart: () => {
    const { session } = get();
    if (!session) return;
    get().startLevel(session.level, session.mode, false);
  },

  watchAd: (kind) => {
    unlockAudio();
    if (get().save.removeAds) {
      set({ adKind: kind });
      get().finishAd();
      return;
    }
    if (hasRewardedSdk()) {
      set({ adKind: kind });
      void rewardedBreak().then((ok) => {
        if (ok) get().finishAd();
        else set({ overlay: "none", adKind: null });
      });
      return;
    }
    set({ overlay: "ad", adKind: kind });
  },

  finishAd: () => {
    const { adKind, save } = get();
    const next = { ...save };
    if (adKind === "life") next.lives = Math.min(MAX_LIVES, next.lives + 1);
    if (adKind === "undo") next.undos += 3;
    if (adKind === "hint") next.hints += 2;
    if (adKind === "extra") next.extraTubes += 1;
    writeSave(next);
    sfxPlay.coin();
    track("ad_complete", { kind: adKind ?? "life" });
    set({ save: next, overlay: "none", adKind: null });
  },

  buy: (sku) => {
    const save = { ...get().save };
    const price = PRICES[sku];
    if (save.coins < price) {
      set({ shopMsg: "short" });
      sfxPlay.invalid();
      return;
    }
    save.coins -= price;
    if (sku === "undo") save.undos += 5;
    if (sku === "hint") save.hints += 3;
    if (sku === "extra") save.extraTubes += 1;
    if (sku === "life") save.lives = Math.min(MAX_LIVES, save.lives + 1);
    writeSave(save);
    sfxPlay.coin();
    track("shop_buy", { sku });
    set({ save, shopMsg: "ok" });
  },

  claimWin: (go) => {
    const { session, save, pendingStars, pendingCoins } = get();
    if (!session) return;
    const next: SaveState = {
      ...save,
      coins: save.coins + pendingCoins,
      totalWins: save.totalWins + 1,
    };
    if (session.mode === "campaign") {
      const prev = next.stars[String(session.level)] ?? 0;
      next.stars = { ...next.stars, [String(session.level)]: Math.max(prev, pendingStars) };
      next.maxUnlocked = Math.max(next.maxUnlocked, Math.min(MAX_LEVEL, session.level + 1));
      next.level = Math.max(next.level, Math.min(MAX_LEVEL, session.level + 1));
    } else {
      next.dailyDone = true;
      next.dailyDate = todayKey();
    }
    writeSave(next);
    track("level_win", {
      level: session.level,
      mode: session.mode,
      stars: pendingStars,
      coins: pendingCoins,
    });
    const lvl = session.level;
    const mode = session.mode;
    set({ save: next, overlay: "none", session: null, pendingStars: 0, pendingCoins: 0 });
    if (go === "next" && mode === "campaign") {
      const nxt = Math.min(MAX_LEVEL, lvl + 1);
      const playNext = () => get().startLevel(nxt, "campaign", false);
      if (lvl < 2) playNext();
      else void commercialBreak().finally(playNext);
    } else {
      set({ screen: "home" });
    }
  },

  setOverlay: (overlay) => set({ overlay }),

  toggleMute: () => {
    const save = { ...get().save, mute: !get().save.mute };
    setMuted(save.mute);
    writeSave(save);
    set({ save });
  },

  toggleShake: () => {
    const save = { ...get().save, shake: !get().save.shake };
    writeSave(save);
    set({ save });
  },

  setLang: (lang) => {
    const save = { ...get().save, lang };
    writeSave(save);
    set({ save });
  },

  markTutorial: () => {
    const save = { ...get().save, seenTutorial: true };
    writeSave(save);
    set({ save });
  },
}));
