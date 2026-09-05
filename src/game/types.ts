export type Lang = "es" | "en";
export type Screen = "home" | "play" | "levels" | "shop" | "daily" | "settings";

export type Tube = number[];

export type LevelSpec = {
  colors: number;
  height: number;
  empty: number;
};

export type Board = {
  tubes: Tube[];
  height: number;
  veiled: number[];
};

export type SaveState = {
  version: number;
  level: number;
  maxUnlocked: number;
  stars: Record<string, number>;
  coins: number;
  lives: number;
  lifeAt: number;
  undos: number;
  hints: number;
  extraTubes: number;
  removeAds: boolean;
  mute: boolean;
  shake: boolean;
  lang: Lang;
  seenTutorial: boolean;
  dailyDate: string;
  dailyDone: boolean;
  totalWins: number;
};

export type Session = {
  mode: "campaign" | "daily";
  level: number;
  board: Board;
  history: Tube[][];
  selected: number | null;
  shaking: number | null;
  completeFlash: number[];
  hintsUsed: number;
  extraUsed: boolean;
  undosUsed: number;
  combo: number;
  locked: boolean;
  pouring: { from: number; to: number; color: number; amt: number } | null;
};
