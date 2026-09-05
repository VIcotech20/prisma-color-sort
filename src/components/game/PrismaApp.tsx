import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  Calendar,
  ChevronLeft,
  Coins,
  Heart,
  Lightbulb,
  Pause,
  Plus,
  RotateCcw,
  Settings,
  ShoppingBag,
  Star,
  Undo2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Board, Slug } from "@/components/game/Board";
import { Button } from "@/components/ui/button";
import { t } from "@/game/copy";
import { MAX_LEVEL, MAX_LIVES } from "@/game/engine";
import { formatMs, nextLifeMs } from "@/game/save";
import { PRICES, useGame } from "@/game/store";
import { bootPortals } from "@/game/ads";
import { unlockAudio } from "@/game/audio";
import { installPlausible, readPulse } from "@/game/analytics";
import { cn } from "@/lib/utils";

function Chip({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-sm tabular-nums text-fg">
      <span className="text-muted">{icon}</span>
      {children}
    </div>
  );
}

function OverlayCard({ children }: { children: ReactNode }) {
  return (
    <div className="scrim fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="overlay-card w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-panel">
        {children}
      </div>
    </div>
  );
}

function Home() {
  const save = useGame((s) => s.save);
  const startLevel = useGame((s) => s.startLevel);
  const setScreen = useGame((s) => s.setScreen);
  const c = t(save.lang);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const wait = nextLifeMs(save, now);
  const cleared = Math.max(0, save.maxUnlocked - 1);
  const starSum = Object.values(save.stars).reduce((a, n) => a + n, 0);
  const pct = Math.min(100, (cleared / MAX_LEVEL) * 100);

  return (
    <div className="home-stage">
      <video
        className="home-intro"
        autoPlay
        muted
        loop
        playsInline
        poster="/intro-poster.jpg?v=3"
        aria-hidden="true"
      >
        <source src="/intro.mp4?v=3" type="video/mp4" />
      </video>
      <header className="home-top flex items-center justify-between">
        <Chip icon={<Heart className="size-4" />}>
          {save.lives}/{MAX_LIVES}
          {save.lives < MAX_LIVES && (
            <span className="ml-1 text-xs text-muted">{formatMs(wait)}</span>
          )}
        </Chip>
        <Chip icon={<Coins className="size-4" />}>{save.coins}</Chip>
      </header>

      <div className="home-copy stagger-in">
        <p className="text-xs font-medium uppercase tracking-widest text-muted">color sort</p>
        <h1 className="mt-2 font-display text-5xl font-semibold tracking-display text-fg">{c.title}</h1>
        <p className="mt-2 text-muted">{c.tag}</p>
        <Button size="lg" className="home-play mt-8" onClick={() => startLevel(save.level)}>
          {c.play}
        </Button>
        <p className="mt-3 text-sm text-subtle">
          {c.level} {save.level} {c.of} {MAX_LEVEL}
        </p>
        <div className="progress-bar mt-2">
          <span style={{ width: `${pct}%` }} />
        </div>
        {starSum > 0 && (
          <p className="mt-2 text-xs tabular-nums text-subtle">
            {starSum} {c.stars}
          </p>
        )}
        <div className="home-nav mt-8 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => setScreen("daily")}>
            <Calendar className="size-4" />
            {c.daily}
          </Button>
          <Button variant="secondary" onClick={() => setScreen("shop")}>
            <ShoppingBag className="size-4" />
            {c.shop}
          </Button>
          <Button variant="secondary" onClick={() => setScreen("levels")}>
            <Star className="size-4" />
            {c.levels}
          </Button>
          <Button variant="secondary" onClick={() => setScreen("settings")}>
            <Settings className="size-4" />
            {c.settings}
          </Button>
        </div>
      </div>

      <div className="home-vials flex items-end justify-center gap-4" aria-hidden="true">
        {[0, 1, 2].map((cidx) => (
          <div key={cidx} className="flex flex-col items-center gap-2">
            <span className="h-2.5 w-6 rounded-full border border-border bg-elevated" />
            <div className="vial flex flex-col-reverse items-stretch rounded-3xl px-1.5 pb-2.5 pt-3 home-vial">
              {[0, 1, 2].map((n) => (
                <Slug
                  key={n}
                  color={cidx}
                  cap={n === 2 ? "top" : n === 0 ? "bot" : "mid"}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Play() {
  const save = useGame((s) => s.save);
  const session = useGame((s) => s.session);
  const hintPair = useGame((s) => s.hintPair);
  const tapTube = useGame((s) => s.tapTube);
  const undo = useGame((s) => s.undo);
  const hint = useGame((s) => s.hint);
  const extra = useGame((s) => s.extra);
  const setOverlay = useGame((s) => s.setOverlay);
  const setScreen = useGame((s) => s.setScreen);
  const markTutorial = useGame((s) => s.markTutorial);
  const c = t(save.lang);

  useEffect(() => {
    if (session && !save.seenTutorial && session.history.length > 0) markTutorial();
  }, [save.seenTutorial, session, markTutorial]);

  if (!session) return null;

  const guideIndex =
    !save.seenTutorial && session.level === 1 && session.mode === "campaign"
      ? session.history.length > 0
        ? null
        : session.selected === null
          ? 0
          : 2
      : null;

  return (
    <div className="play-stage">
      <header className="flex items-center justify-between gap-2 px-2">
        <Button variant="ghost" size="icon" aria-label={c.home} onClick={() => setScreen("home")}>
          <ChevronLeft className="size-5" />
        </Button>
        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-muted">
            {session.mode === "daily" ? c.daily : c.level}
          </p>
          <p className="font-display text-xl tabular-nums">
            {session.mode === "daily" ? c.dailyTitle : session.level}
          </p>
          {session.combo >= 2 && (
            <p className="text-xs text-ok">
              {c.combo} ×{session.combo}
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon" aria-label={c.pause} onClick={() => setOverlay("pause")}>
          <Pause className="size-5" />
        </Button>
      </header>

      {guideIndex !== null && (
        <p className="mx-4 mt-3 text-center text-sm text-muted">{c.how}</p>
      )}
      {session.board.veiled.length > 0 && save.seenTutorial && (
        <p className="mx-4 mt-2 text-center text-xs text-subtle">{c.veil}</p>
      )}

      <div className="flex min-h-0 flex-1 items-center">
        <Board
          board={session.board}
          selected={session.selected}
          shaking={session.shaking}
          completeFlash={session.completeFlash}
          hintPair={hintPair}
          pouring={session.pouring}
          guideIndex={guideIndex}
          sealed={session.locked}
          round={`${session.mode}-${session.level}`}
          onTap={tapTube}
        />
      </div>

      <div className="boost-dock">
        <Button variant="secondary" className="boost-item" onClick={undo} aria-label={c.undo}>
          <span className="flex items-center gap-1">
            <Undo2 className="size-4" />
            <span className="tabular-nums">{save.undos}</span>
          </span>
          <small>{c.undo}</small>
        </Button>
        <Button variant="secondary" className="boost-item" onClick={hint} aria-label={c.hint}>
          <span className="flex items-center gap-1">
            <Lightbulb className="size-4" />
            <span className="tabular-nums">{save.hints}</span>
          </span>
          <small>{c.hint}</small>
        </Button>
        <Button
          variant="secondary"
          className="boost-item"
          onClick={extra}
          disabled={session.extraUsed}
          aria-label={c.extra}
        >
          <span className="flex items-center gap-1">
            <Plus className="size-4" />
            <span className="tabular-nums">{save.extraTubes}</span>
          </span>
          <small>{c.extraShort}</small>
        </Button>
      </div>
    </div>
  );
}

function Levels() {
  const save = useGame((s) => s.save);
  const startLevel = useGame((s) => s.startLevel);
  const setScreen = useGame((s) => s.setScreen);
  const c = t(save.lang);
  const chapters = [
    { title: c.ch1, from: 1, to: 40 },
    { title: c.ch2, from: 41, to: 80 },
    { title: c.ch3, from: 81, to: 120 },
    { title: c.ch4, from: 121, to: 160 },
    { title: c.ch5, from: 161, to: 200 },
  ];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 pb-16 pt-4">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setScreen("home")} aria-label={c.home}>
          <ChevronLeft className="size-5" />
        </Button>
        <h1 className="font-display text-2xl">{c.levels}</h1>
      </header>
      <div className="mt-6 flex flex-col gap-7">
        {chapters.map((ch) => (
          <section key={ch.title}>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-lg">{ch.title}</h2>
              <p className="text-xs tabular-nums text-subtle">
                {ch.from}–{ch.to}
              </p>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: ch.to - ch.from + 1 }, (_, i) => {
                const n = ch.from + i;
                const locked = n > save.maxUnlocked;
                const stars = save.stars[String(n)] ?? 0;
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={locked}
                    onClick={() => startLevel(n)}
                    className={cn(
                      "flex h-14 flex-col items-center justify-center rounded-xl border text-sm tabular-nums",
                      locked
                        ? "border-border bg-surface text-subtle"
                        : "border-border-strong bg-elevated text-fg hover:border-accent",
                    )}
                  >
                    {n}
                    <span className="flex gap-0.5">
                      {[1, 2, 3].map((s) => (
                        <Star
                          key={s}
                          className={cn(
                            "size-2.5",
                            s <= stars ? "fill-accent text-accent" : "text-subtle",
                          )}
                        />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Shop() {
  const save = useGame((s) => s.save);
  const buy = useGame((s) => s.buy);
  const watchAd = useGame((s) => s.watchAd);
  const setScreen = useGame((s) => s.setScreen);
  const shopMsg = useGame((s) => s.shopMsg);
  const c = t(save.lang);

  const rows: Array<{ sku: keyof typeof PRICES; label: string; stock?: string }> = [
    { sku: "life", label: c.extraLife, stock: `${save.lives}/${MAX_LIVES}` },
    { sku: "undo", label: c.packUndo, stock: String(save.undos) },
    { sku: "hint", label: c.packHint, stock: String(save.hints) },
    { sku: "extra", label: c.packExtra, stock: String(save.extraTubes) },
  ];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 pb-16 pt-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setScreen("home")} aria-label={c.home}>
            <ChevronLeft className="size-5" />
          </Button>
          <h1 className="font-display text-2xl">{c.shop}</h1>
        </div>
        <Chip icon={<Coins className="size-4" />}>{save.coins}</Chip>
      </header>

      <p className="mt-3 text-sm text-muted">
        {shopMsg === "short" ? c.notEnough : shopMsg === "ok" ? c.bought : c.coins}
      </p>

      <ul className="mt-5 flex flex-col gap-3">
        {rows.map((row) => (
          <li
            key={row.sku}
            className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4"
          >
            <div>
              <p className="font-medium">{row.label}</p>
              <p className="text-xs tabular-nums text-muted">
                {PRICES[row.sku]} · {row.stock ?? ""}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => buy(row.sku)}
            >
              {PRICES[row.sku]}
            </Button>
          </li>
        ))}
      </ul>

      <Button variant="secondary" className="mt-6" onClick={() => watchAd("life")}>
        {c.watchAd} · {c.extraLife}
      </Button>
    </div>
  );
}

function Daily() {
  const save = useGame((s) => s.save);
  const startLevel = useGame((s) => s.startLevel);
  const setScreen = useGame((s) => s.setScreen);
  const c = t(save.lang);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 pb-16 pt-4">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setScreen("home")} aria-label={c.home}>
          <ChevronLeft className="size-5" />
        </Button>
        <h1 className="font-display text-2xl">{c.dailyTitle}</h1>
      </header>
      <div className="mt-16 text-center">
        <p className="text-muted">{save.dailyDone ? c.dailyDone : c.dailyLead}</p>
        <Button
          size="lg"
          className="mt-8 w-full"
          disabled={save.dailyDone}
          onClick={() => startLevel(1, "daily")}
        >
          {save.dailyDone ? c.dailyDone : c.dailyPlay}
        </Button>
      </div>
    </div>
  );
}

function SettingsScreen() {
  const save = useGame((s) => s.save);
  const toggleMute = useGame((s) => s.toggleMute);
  const toggleShake = useGame((s) => s.toggleShake);
  const setLang = useGame((s) => s.setLang);
  const setScreen = useGame((s) => s.setScreen);
  const c = t(save.lang);
  const pulse = readPulse();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 pb-16 pt-4">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setScreen("home")} aria-label={c.home}>
          <ChevronLeft className="size-5" />
        </Button>
        <h1 className="font-display text-2xl">{c.settings}</h1>
      </header>
      <div className="mt-8 flex flex-col gap-3">
        <Button variant="secondary" className="justify-between" onClick={toggleMute}>
          <span className="flex items-center gap-2">
            {save.mute ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            {c.muted}
          </span>
          <span className="text-muted">{save.mute ? "on" : "off"}</span>
        </Button>
        <Button variant="secondary" className="justify-between" onClick={toggleShake}>
          <span>{c.shake}</span>
          <span className="text-muted">{save.shake ? "on" : "off"}</span>
        </Button>
        <div className="flex gap-2">
          <Button
            variant={save.lang === "es" ? "primary" : "secondary"}
            className="flex-1"
            onClick={() => setLang("es")}
          >
            {c.spanish}
          </Button>
          <Button
            variant={save.lang === "en" ? "primary" : "secondary"}
            className="flex-1"
            onClick={() => setLang("en")}
          >
            {c.english}
          </Button>
        </div>
        <div className="mt-3 rounded-2xl border border-border bg-surface p-4 text-left">
          <p className="text-xs uppercase tracking-widest text-muted">{c.stats}</p>
          <p className="mt-2 text-sm text-muted">{c.statsHint}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm tabular-nums">
            <div>
              <dt className="text-subtle">{c.sessions}</dt>
              <dd className="font-display text-xl">{pulse.sessions}</dd>
            </div>
            <div>
              <dt className="text-subtle">{c.levels}</dt>
              <dd className="font-display text-xl">{pulse.starts}</dd>
            </div>
            <div>
              <dt className="text-subtle">{c.win}</dt>
              <dd className="font-display text-xl">{pulse.wins}</dd>
            </div>
            <div>
              <dt className="text-subtle">{c.watchAd}</dt>
              <dd className="font-display text-xl">{pulse.ads}</dd>
            </div>
          </dl>
        </div>
        <a href="/privacidad" className="mt-4 text-center text-xs text-subtle underline-offset-4 hover:underline">
          {c.privacy}
        </a>
      </div>
    </div>
  );
}

function Overlays() {
  const overlay = useGame((s) => s.overlay);
  const save = useGame((s) => s.save);
  const session = useGame((s) => s.session);
  const pendingStars = useGame((s) => s.pendingStars);
  const pendingCoins = useGame((s) => s.pendingCoins);
  const setOverlay = useGame((s) => s.setOverlay);
  const claimWin = useGame((s) => s.claimWin);
  const startLevel = useGame((s) => s.startLevel);
  const restart = useGame((s) => s.restart);
  const watchAd = useGame((s) => s.watchAd);
  const finishAd = useGame((s) => s.finishAd);
  const setScreen = useGame((s) => s.setScreen);
  const c = t(save.lang);
  const [adLeft, setAdLeft] = useState(3);

  useEffect(() => {
    if (overlay !== "ad") {
      setAdLeft(3);
      return;
    }
    setAdLeft(3);
    const id = window.setInterval(() => {
      setAdLeft((n) => {
        if (n <= 1) {
          window.clearInterval(id);
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [overlay]);

  if (overlay === "none") return null;

  if (overlay === "win") {
    const milestone =
      session?.mode === "daily" ||
      (session?.mode === "campaign" && [10, 25, 40].includes(session.level));
    return (
      <div className="scrim fixed inset-0 z-50 flex items-center justify-center p-4">
        {milestone && (
          <video
            key={`bg-${session?.level}`}
            className="win-reel-bg"
            autoPlay
            muted
            playsInline
            poster="/win-poster.jpg"
            aria-hidden="true"
          >
            <source src="/win.mp4" type="video/mp4" />
          </video>
        )}
        <div className="overlay-card w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-panel">
          <p className="text-xs uppercase tracking-widest text-muted">{c.win}</p>
          <div className={cn("win-reel-frame", milestone && "win-reel-frame-lg")}>
            <video
              key={`sting-${session?.mode}-${session?.level}`}
              autoPlay
              muted
              playsInline
              poster="/win-poster.jpg"
              aria-hidden="true"
            >
              <source src="/win.mp4" type="video/mp4" />
            </video>
          </div>
          <div className="win-burst mx-auto mt-5 flex w-fit justify-center gap-2">
            {[1, 2, 3].map((s) => (
              <Star
                key={s}
                className={cn(
                  "size-8",
                  s <= pendingStars ? "star-pop fill-accent text-accent" : "text-subtle",
                )}
                style={{ animationDelay: `${s * 90}ms` }}
              />
            ))}
          </div>
          <p className="mt-5 text-center font-display text-3xl tabular-nums">+{pendingCoins}</p>
          <p className="mt-1 text-center text-xs uppercase tracking-widest text-muted">{c.coins}</p>
          <div className="mt-6 flex flex-col gap-2">
            {session?.mode === "campaign" && session.level < MAX_LEVEL && (
              <Button size="lg" onClick={() => claimWin("next")}>
                {c.next}
              </Button>
            )}
            {session && (
              <Button
                variant="secondary"
                onClick={() => {
                  const lvl = session.level;
                  const mode = session.mode;
                  claimWin("home");
                  startLevel(lvl, mode, false);
                }}
              >
                {c.retry}
              </Button>
            )}
            <Button variant="ghost" onClick={() => claimWin("home")}>
              {c.home}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (overlay === "pause") {
    return (
      <OverlayCard>
        <p className="font-display text-2xl">{c.pause}</p>
        <div className="mt-6 flex flex-col gap-3">
          <Button onClick={() => setOverlay("none")}>{c.resume}</Button>
          <Button variant="secondary" onClick={restart}>
            <RotateCcw className="size-4" />
            {c.restart}
          </Button>
          <Button variant="ghost" onClick={() => setScreen("home")}>
            {c.home}
          </Button>
        </div>
      </OverlayCard>
    );
  }

  if (overlay === "nolives") {
    const wait = formatMs(nextLifeMs(save));
    return (
      <OverlayCard>
        <p className="font-display text-2xl">{c.noLives}</p>
        <p className="mt-2 text-sm text-muted">{c.watchAd} · {c.extraLife}</p>
        <p className="mt-1 text-xs tabular-nums text-subtle">
          {c.nextLife} {wait}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={() => watchAd("life")}>
            {c.watchAd}
          </Button>
          <Button variant="secondary" onClick={() => setScreen("shop")}>
            {c.shop}
          </Button>
          <Button variant="ghost" onClick={() => setScreen("home")}>
            {c.home}
          </Button>
        </div>
      </OverlayCard>
    );
  }

  if (overlay === "ad") {
    return (
      <OverlayCard>
        <p className="text-xs uppercase tracking-widest text-muted">{c.sponsored}</p>
        <p className="mt-3 text-sm text-muted">{c.adBody}</p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-elevated">
          <div
            className="h-full bg-accent transition-[width] duration-1000"
            style={{ width: `${((3 - adLeft) / 3) * 100}%` }}
          />
        </div>
        <Button className="mt-6 w-full" disabled={adLeft > 0} onClick={finishAd}>
          {adLeft > 0 ? `${c.claim} ${adLeft}` : c.claim}
        </Button>
      </OverlayCard>
    );
  }

  return null;
}

export function PrismaApp() {
  const ready = useGame((s) => s.ready);
  const screen = useGame((s) => s.screen);
  const init = useGame((s) => s.init);
  const persist = useGame((s) => s.persist);
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    init();
    installPlausible();
    void bootPortals();
    const onHide = () => {
      if (document.visibilityState === "hidden") persist();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", persist);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", persist);
    };
  }, [init, persist]);

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  if (!isClient && !ready) {
    return (
      <div className="prisma-shell flex items-center justify-center">
        <p className="font-display text-2xl tracking-display">PRISMA</p>
      </div>
    );
  }

  return (
    <div className="prisma-shell relative overflow-x-hidden">
      {screen === "home" && <Home />}
      {screen === "play" && <Play />}
      {screen === "levels" && <Levels />}
      {screen === "shop" && <Shop />}
      {screen === "daily" && <Daily />}
      {screen === "settings" && <SettingsScreen />}
      <Overlays />
    </div>
  );
}
