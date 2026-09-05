export type Pulse = {
  sessions: number;
  starts: number;
  wins: number;
  ads: number;
  buys: number;
  maxLevel: number;
};

const KEY = "prisma-pulse-v1";

const empty = (): Pulse => ({
  sessions: 0,
  starts: 0,
  wins: 0,
  ads: 0,
  buys: 0,
  maxLevel: 1,
});

export function readPulse(): Pulse {
  if (typeof window === "undefined") return empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    return { ...empty(), ...JSON.parse(raw) };
  } catch {
    return empty();
  }
}

function writePulse(p: Pulse) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* quota */
  }
}

function bump(patch: Partial<Pulse>) {
  const cur = readPulse();
  writePulse({
    sessions: cur.sessions + (patch.sessions ?? 0),
    starts: cur.starts + (patch.starts ?? 0),
    wins: cur.wins + (patch.wins ?? 0),
    ads: cur.ads + (patch.ads ?? 0),
    buys: cur.buys + (patch.buys ?? 0),
    maxLevel: Math.max(cur.maxLevel, patch.maxLevel ?? 0),
  });
}

declare global {
  interface Window {
    plausible?: (event: string, opts?: { props?: Record<string, string | number | boolean> }) => void;
  }
}

/** Local pulse + Plausible (when VITE_PLAUSIBLE_DOMAIN is set). */
export function track(name: string, props: Record<string, string | number | boolean> = {}) {
  if (typeof window === "undefined") return;
  if (name === "session_start") bump({ sessions: 1 });
  if (name === "level_start") bump({ starts: 1, maxLevel: Number(props.level) || 0 });
  if (name === "level_win") bump({ wins: 1, maxLevel: Number(props.level) || 0 });
  if (name === "ad_complete") bump({ ads: 1 });
  if (name === "shop_buy") bump({ buys: 1 });

  try {
    window.plausible?.(name, Object.keys(props).length ? { props } : undefined);
  } catch {
    /* ignore */
  }
}

export function installPlausible() {
  const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined;
  if (!domain || typeof document === "undefined") return;
  if (document.getElementById("prisma-plausible")) return;
  const s = document.createElement("script");
  s.id = "prisma-plausible";
  s.defer = true;
  s.dataset.domain = domain;
  s.src = "https://plausible.io/js/script.tagged-events.js";
  document.head.appendChild(s);
}
