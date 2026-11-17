// Automatic quality step-down: after a warm-up, measure the median frame time; if the device can't hold ~35 fps,
// switch the renderer to the 'low' level once (pixel ratio 1, smaller shadows) and re-run resize so the post targets
// follow. An explicit ?quality=... always wins: this only runs when the user did not choose.
// Uses wall-clock time, not the loop's dt: the loop caps dt at 1/20 s, so on a slow device game time crawls.
// ponytail: one step down, no step back up; add hysteresis + step-up if devices that recover matter.

const WARMUP_MS = 3000; // skip shader compile / asset upload hitches
const WINDOW_MS = 2000;
const SLOW_MS = 1000 / 35;

export function createAutoQuality({ start, setQuality, onChange, now = () => performance.now() }) {
  let level = start;
  let t0 = 0; let last = 0; let windowStart = 0;
  const samples = [];
  return {
    get level() { return level; },
    /** Call once per rendered frame. */
    sample() {
      if (level === 'low') return;
      const t = now();
      if (!t0) { t0 = t; last = t; return; }
      const frameMs = t - last; last = t;
      if (t - t0 < WARMUP_MS) return;
      if (!windowStart) windowStart = t;
      samples.push(frameMs);
      if (t - windowStart < WINDOW_MS) return;
      const sorted = samples.slice().sort((a, b) => a - b);
      const median = sorted[sorted.length >> 1];
      samples.length = 0; windowStart = t; // next window
      if (median > SLOW_MS) {
        level = 'low';
        setQuality(level);
        onChange(level, median);
      }
    },
  };
}
