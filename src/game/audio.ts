let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfx: GainNode | null = null;
let music: GainNode | null = null;
let muted = false;
let bed: OscillatorNode[] = [];

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC({ latencyHint: "interactive" });
    master = ctx.createGain();
    sfx = ctx.createGain();
    music = ctx.createGain();
    sfx.connect(master);
    music.connect(master);
    master.connect(ctx.destination);
    master.gain.value = muted ? 0 : 0.85;
    music.gain.value = 0.045;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function unlockAudio() {
  const c = ensure();
  if (c && c.state === "suspended") void c.resume();
}

export function setMuted(v: boolean) {
  muted = v;
  if (master && ctx) {
    master.gain.setTargetAtTime(v ? 0 : 0.85, ctx.currentTime, 0.02);
  }
}

export function startBed() {
  const c = ensure();
  if (!c || !music || muted || bed.length) return;
  const make = (freq: number, type: OscillatorType) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.22, c.currentTime + 1.4);
    osc.connect(g);
    g.connect(music!);
    osc.start();
    bed.push(osc);
  };
  make(110, "sine");
  make(164.8, "triangle");
}

export function stopBed() {
  for (const osc of bed) {
    try {
      osc.stop();
      osc.disconnect();
    } catch {
      /* already stopped */
    }
  }
  bed = [];
}

function tone(freq: number, dur: number, type: OscillatorType, gain = 0.08, when = 0) {
  const c = ensure();
  if (!c || !sfx || muted) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  const jitter = 0.97 + Math.random() * 0.06;
  osc.frequency.setValueAtTime(freq * jitter, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(sfx);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
  osc.onended = () => {
    osc.disconnect();
    g.disconnect();
  };
}

function pourNoise(dur: number, gain = 0.045) {
  const c = ensure();
  if (!c || !sfx || muted) return;
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    last = last * 0.97 + (Math.random() * 2 - 1) * 0.045;
    data[i] = last;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 720;
  const g = c.createGain();
  const t0 = c.currentTime;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(lp);
  lp.connect(g);
  g.connect(sfx);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

export const sfxPlay = {
  tap() {
    tone(420, 0.06, "triangle", 0.04);
  },
  select() {
    tone(540, 0.07, "sine", 0.045);
    tone(810, 0.05, "triangle", 0.02, 0.02);
  },
  pour(color: number) {
    const f = 210 + color * 22;
    pourNoise(0.42, 0.05);
    tone(f, 0.34, "sine", 0.055);
    tone(f * 0.5, 0.3, "sine", 0.03, 0.02);
    tone(f * 1.9, 0.16, "triangle", 0.02, 0.18);
  },
  invalid() {
    tone(148, 0.14, "square", 0.035);
    tone(110, 0.1, "sine", 0.025, 0.03);
  },
  complete() {
    tone(523, 0.11, "sine", 0.055);
    tone(659, 0.13, "sine", 0.05, 0.07);
    tone(784, 0.16, "triangle", 0.045, 0.14);
    tone(1046, 0.2, "sine", 0.03, 0.22);
  },
  win() {
    tone(392, 0.16, "sine", 0.05);
    tone(523, 0.16, "sine", 0.06, 0.08);
    tone(659, 0.18, "sine", 0.055, 0.18);
    tone(784, 0.2, "sine", 0.05, 0.28);
    tone(1046, 0.32, "triangle", 0.045, 0.4);
  },
  coin() {
    tone(880, 0.08, "square", 0.028);
    tone(1320, 0.12, "sine", 0.038, 0.05);
  },
  click() {
    tone(640, 0.05, "triangle", 0.032);
  },
};

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") unlockAudio();
  });
}
