import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Board as BoardModel } from "@/game/types";
import { isComplete } from "@/game/engine";

const ORB = [
  "var(--color-orb-0)",
  "var(--color-orb-1)",
  "var(--color-orb-2)",
  "var(--color-orb-3)",
  "var(--color-orb-4)",
  "var(--color-orb-5)",
  "var(--color-orb-6)",
  "var(--color-orb-7)",
  "var(--color-orb-8)",
];

export function slugFill(color: number) {
  const c = ORB[color] ?? ORB[0];
  return `linear-gradient(180deg, color-mix(in oklab, white 26%, ${c}), ${c} 38%, color-mix(in oklab, black 16%, ${c}))`;
}

export function Slug({
  color,
  cap,
  className,
}: {
  color: number;
  cap: "solo" | "top" | "mid" | "bot";
  className?: string;
}) {
  return (
    <span
      className={cn("slug", `slug-${cap}`, className)}
      style={{ background: slugFill(color) }}
    />
  );
}

type Pouring = { from: number; to: number; color: number; amt: number };

type Stream = {
  color: string;
  d: string;
  from: number;
  to: number;
  len: number;
};

type Props = {
  board: BoardModel;
  selected: number | null;
  shaking: number | null;
  completeFlash: number[];
  hintPair: [number, number] | null;
  pouring: Pouring | null;
  guideIndex?: number | null;
  sealed?: boolean;
  round?: string;
  onTap: (index: number) => void;
};

function bandsOf(tube: number[]): Array<{ color: number; size: number }> {
  const out: Array<{ color: number; size: number }> = [];
  for (const c of tube) {
    const last = out[out.length - 1];
    if (last && last.color === c) last.size += 1;
    else out.push({ color: c, size: 1 });
  }
  return out;
}

function LiquidBody({
  tube,
  height,
  pouring,
  pouringFrom,
  pouringTo,
  selected,
  veiled,
  hit,
}: {
  tube: number[];
  height: number;
  pouring: Pouring | null;
  pouringFrom: boolean;
  pouringTo: boolean;
  selected: boolean;
  veiled: boolean;
  hit: boolean;
}) {
  const unit = 100 / height;
  const list = bandsOf(tube);
  const drain = pouringFrom && pouring ? pouring.amt : 0;
  const fill = pouringTo && pouring ? pouring.amt : 0;
  const topColor = fill
    ? pouring!.color
    : list.length
      ? list[list.length - 1].color
      : 0;
  const surfaceNow = tube.length * unit;
  const surfaceNext = (tube.length - drain + fill) * unit;
  let acc = 0;
  return (
    <span className="liquid-col">
      {list.map((band, i) => {
        const bottom = acc;
        const h = band.size * unit;
        acc += h;
        const isTop = i === list.length - 1;
        return (
          <span
            key={`${band.color}-${i}`}
            className={cn(
              "liquid-band",
              isTop && drain > 0 && "liquid-drain",
              isTop && selected && drain === 0 && fill === 0 && "liquid-held",
            )}
            style={{
              bottom: `${bottom}%`,
              height: `${h}%`,
              background: veiled
                ? "linear-gradient(180deg, rgb(255 255 255 / 0.1), rgb(255 255 255 / 0.03))"
                : slugFill(band.color),
            }}
          />
        );
      })}
      {fill > 0 && pouring && (
        <span
          className="liquid-band liquid-fill"
          style={{
            bottom: `${tube.length * unit}%`,
            height: `${fill * unit}%`,
            background: slugFill(pouring.color),
          }}
        />
      )}
      <span data-lip className="lip-anchor" style={{ bottom: `${surfaceNow}%` }} />
      {(tube.length > 0 || fill > 0) && !veiled && (
        <span
          className={cn("meniscus", (hit || pouringTo) && "meniscus-hit", selected && drain === 0 && "meniscus-held")}
          style={{
            bottom: `${surfaceNext}%`,
            color: ORB[topColor],
          }}
        >
          <svg viewBox="0 0 80 16" preserveAspectRatio="none" aria-hidden="true">
            <path
              fill="currentColor"
              d="M0 10 C 18 2 22 15 40 9 C 58 3 62 15 80 10 L 80 16 L 0 16 Z"
            />
          </svg>
        </span>
      )}
    </span>
  );
}

function pt(el: Element, origin: DOMRect) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2 - origin.left, y: r.top + r.height / 2 - origin.top };
}

export function Board({
  board,
  selected,
  shaking,
  completeFlash,
  hintPair,
  pouring,
  guideIndex = null,
  sealed = false,
  round = "1",
  onTap,
}: Props) {
  const count = board.tubes.length;
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const tubeRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pressRef = useRef<number | null>(null);
  const [stream, setStream] = useState<Stream | null>(null);
  const [corksOn, setCorksOn] = useState(true);

  useEffect(() => {
    if (sealed) {
      setCorksOn(true);
      return;
    }
    setCorksOn(true);
    const id = window.setTimeout(() => setCorksOn(false), 420);
    return () => window.clearTimeout(id);
  }, [round, sealed]);

  useLayoutEffect(() => {
    if (!pouring) {
      setStream(null);
      return;
    }
    const wrap = wrapRef.current;
    const fromEl = tubeRefs.current[pouring.from];
    const toEl = tubeRefs.current[pouring.to];
    if (!wrap || !fromEl || !toEl) return;
    const origin = wrap.getBoundingClientRect();
    const lip = fromEl.querySelector("[data-lip]");
    const mouth = toEl.querySelector("[data-lip]");
    if (!lip || !mouth) return;
    const a = pt(lip, origin);
    const b = pt(mouth, origin);
    const mx = (a.x + b.x) / 2;
    const peak = Math.min(a.y, b.y) - 56;
    const d = `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${mx.toFixed(1)} ${peak.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    const len = Math.max(48, Math.hypot(b.x - a.x, b.y - a.y)) * 1.2;
    setStream({
      color: ORB[pouring.color] ?? ORB[0],
      d,
      from: pouring.from,
      to: pouring.to,
      len,
    });
  }, [pouring]);

  return (
    <div
      ref={wrapRef}
      className={cn("relative mx-auto w-full", completeFlash.length > 0 && "board-punch")}
    >
      <div className="flex w-full items-end justify-center gap-2 px-2 sm:gap-4">
        {board.tubes.map((tube, i) => {
          const done = isComplete(tube, board.height);
          const isSel = selected === i;
          const isHint = hintPair?.[0] === i || hintPair?.[1] === i;
          const doneColor = done ? tube[0] : null;
          const veiled = board.veiled.includes(i);
          const pouringFrom = pouring?.from === i;
          const pouringTo = pouring?.to === i;
          return (
            <button
              key={i}
              type="button"
              data-tube={i}
              ref={(el) => {
                tubeRefs.current[i] = el;
              }}
              aria-label={`Tube ${i + 1}`}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                pressRef.current = i;
                if (selected === null || selected !== i) onTap(i);
              }}
              onPointerUp={(e) => {
                const el = document.elementFromPoint(e.clientX, e.clientY);
                const host = el?.closest("[data-tube]") as HTMLElement | null;
                const dest = host ? Number(host.dataset.tube) : i;
                if (pressRef.current !== null && dest !== pressRef.current) onTap(dest);
                pressRef.current = null;
              }}
              className={cn(
                "relative flex min-h-11 flex-col items-center pt-2 outline-none [touch-action:none]",
                shaking === i && "tube-shake",
                guideIndex === i && "z-10",
                pouringFrom && "tube-pour-from",
                pouringTo && "tube-pour-to",
              )}
            >
              {guideIndex === i && <span className="guide-hand" />}
              <span
                className={cn(
                  "cork",
                  sealed ? "cork-on" : corksOn ? "cork-pop" : "cork-off",
                )}
                style={{ animationDelay: `${i * 45}ms` }}
              />
              <span
                data-vial
                className={cn(
                  "vial relative flex w-full flex-col items-stretch",
                  isSel && "vial-selected",
                  isHint && "vial-hint",
                  done && "vial-done",
                  veiled && "vial-veiled",
                  completeFlash.includes(i) && "tube-complete",
                  guideIndex === i && "vial-guide",
                  pouringTo && "vial-receive",
                )}
                style={{
                  width: `clamp(2.75rem, calc(min(38rem, 82vw) / ${count}), 4.4rem)`,
                  height: `calc(${board.height} * 1.9rem + 1.85rem)`,
                  ["--done" as string]:
                    doneColor !== null ? ORB[doneColor] : "transparent",
                }}
              >
                <span className="vial-hit" aria-hidden="true" />
                <span className="vial-rim" />
                <span className="vial-well">
                  <LiquidBody
                    tube={tube}
                    height={board.height}
                    pouring={pouring}
                    pouringFrom={pouringFrom}
                    pouringTo={pouringTo}
                    selected={isSel}
                    veiled={veiled}
                    hit={completeFlash.includes(i)}
                  />
                </span>
                {pouringTo && <span className="receive-ripple" aria-hidden="true" />}
                {completeFlash.includes(i) && (
                  <span className="splash" aria-hidden="true">
                    {Array.from({ length: 8 }, (_, s) => (
                      <i key={s} />
                    ))}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      {stream && (
        <svg className="pour-svg pointer-events-none absolute inset-0 z-30 h-full w-full overflow-visible">
          <path
            d={stream.d}
            fill="none"
            stroke={stream.color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="8"
            pathLength={1}
            className="pour-stroke"
            style={{ ["--plen" as string]: stream.len }}
          />
          <path
            d={stream.d}
            fill="none"
            stroke="rgb(255 255 255 / 0.35)"
            strokeLinecap="round"
            strokeWidth="3"
            pathLength={1}
            className="pour-stroke pour-stroke-shine"
          />
        </svg>
      )}
    </div>
  );
}
