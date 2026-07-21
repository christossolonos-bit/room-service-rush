let ctx, master;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.2;
  master.connect(ctx.destination);
  return ctx;
}

export function unlockAudio() {
  const c = ensure();
  if (c?.state === "suspended") c.resume();
}

function beep(freq, dur, type = "square", gain = 0.25, slide = 0) {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g);
  g.connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export const sfx = {
  pickup() { beep(520, 0.05, "square", 0.18); beep(780, 0.09, "triangle", 0.14); },
  jump() { beep(220, 0.08, "triangle", 0.15, 200); },
  win() { [330, 392, 523].forEach((f, i) => setTimeout(() => beep(f, 0.1, "square", 0.14), i * 90)); },
  hurt() { beep(160, 0.12, "sawtooth", 0.22, -80); },
  start() { beep(262, 0.08, "square", 0.15); setTimeout(() => beep(392, 0.12, "square", 0.16), 100); },
};
