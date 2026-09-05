type CrazyAd = {
  requestAd: (
    kind: "rewarded" | "midgame",
    cbs: { adFinished?: () => void; adError?: () => void; adStarted?: () => void },
  ) => void;
};

type CrazyGame = {
  gameplayStart: () => void;
  gameplayStop: () => void;
};

type CrazySdk = {
  init?: () => Promise<void>;
  ad?: CrazyAd;
  game?: CrazyGame;
};

type GdSdk = {
  showAd: (type?: "interstitial" | "rewarded" | string) => Promise<void>;
  preloadAd?: (type: string) => Promise<void>;
};

type GdEvent = { name: string };

function crazy(): CrazySdk | undefined {
  return (window as unknown as { CrazyGames?: { SDK?: CrazySdk } }).CrazyGames?.SDK;
}

function gd(): GdSdk | undefined {
  return (window as unknown as { gdsdk?: GdSdk }).gdsdk;
}

function loadScript(id: string, src: string): Promise<void> {
  if (document.getElementById(id)) return Promise.resolve();
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.id = id;
    s.async = true;
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.head.appendChild(s);
  });
}

function hostIs(part: string) {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  const ref = document.referrer;
  return h.includes(part) || ref.includes(part);
}

function gdGameId(): string {
  const fromEnv = (import.meta.env.VITE_GD_GAME_ID as string | undefined)?.trim() ?? "";
  if (fromEnv) return fromEnv;
  try {
    return new URLSearchParams(window.location.search).get("gdGameId")?.trim() ?? "";
  } catch {
    return "";
  }
}

async function bootGd() {
  const gameId = gdGameId();
  if (!gameId) return;
  const w = window as unknown as {
    GD_OPTIONS?: { gameId: string; onEvent: (e: GdEvent) => void };
  };
  w.GD_OPTIONS = {
    gameId,
    onEvent: (event) => {
      if (event.name === "SDK_GAME_PAUSE") gameplayStop();
      if (event.name === "SDK_GAME_START") gameplayStart();
    },
  };
  await loadScript("sdk-gd", "https://html5.api.gamedistribution.com/main.min.js");
  try {
    await gd()?.preloadAd?.("rewarded");
  } catch {
    /* optional */
  }
}

export async function bootPortals() {
  if (typeof window === "undefined") return;
  try {
    if (hostIs("crazygames")) {
      await loadScript("sdk-cg", "https://sdk.crazygames.com/crazygames-sdk-v3.js");
      await crazy()?.init?.();
    } else if (hostIs("gamedistribution")) {
      await bootGd();
    }
  } catch {
    /* preview / blocked */
  }
}

export function hasRewardedSdk() {
  return Boolean(crazy()?.ad?.requestAd || gd()?.showAd);
}

export function gameplayStart() {
  try {
    crazy()?.game?.gameplayStart();
  } catch {
    /* sdk optional */
  }
}

export function gameplayStop() {
  try {
    crazy()?.game?.gameplayStop();
  } catch {
    /* sdk optional */
  }
}

export async function commercialBreak() {
  const ad = crazy()?.ad;
  if (ad?.requestAd) {
    gameplayStop();
    await new Promise<void>((resolve) => {
      ad.requestAd("midgame", {
        adFinished: () => resolve(),
        adError: () => resolve(),
      });
    });
    gameplayStart();
    return;
  }
  const g = gd();
  if (g?.showAd) {
    gameplayStop();
    try {
      await g.showAd();
    } catch {
      /* no fill */
    }
    gameplayStart();
  }
}

export async function rewardedBreak(): Promise<boolean> {
  const ad = crazy()?.ad;
  if (ad?.requestAd) {
    gameplayStop();
    const ok = await new Promise<boolean>((resolve) => {
      ad.requestAd("rewarded", {
        adFinished: () => resolve(true),
        adError: () => resolve(false),
      });
    });
    gameplayStart();
    return ok;
  }
  const g = gd();
  if (g?.showAd) {
    gameplayStop();
    try {
      await g.showAd("rewarded");
      gameplayStart();
      return true;
    } catch {
      gameplayStart();
      return false;
    }
  }
  return false;
}
