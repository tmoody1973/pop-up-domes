// Self-check: node src/render/autoquality.check.mjs
import assert from 'node:assert/strict';
import { createAutoQuality } from './autoquality.js';

function run(frameMs, seconds) {
  let clock = 0; const changes = [];
  const q = createAutoQuality({ start: 'med', setQuality: (l) => changes.push(l), onChange: () => {}, now: () => clock });
  for (let t = 0; t < seconds * 1000; t += frameMs) { clock = t + 1; q.sample(); }
  return { level: q.level, changes };
}
assert.deepEqual(run(1000 / 20, 8), { level: 'low', changes: ['low'] }, '20 fps device steps down to low once');
assert.deepEqual(run(1000 / 60, 8), { level: 'med', changes: [] }, '60 fps device stays on med');
assert.deepEqual(run(1000 / 20, 2.5), { level: 'med', changes: [] }, 'no decision during the 3 s warm-up');
console.log('autoquality: 3/3 checks pass');
