# Before / after (frame time, ms; lower is better)

Apple M3, headed system Chrome (ANGLE/Metal, vsync off), 1440x900 @ DPR 2. Builds alternated launch by launch, 3 runs each, 5 s per run after a 4 s warm-up; value = median of the 3 runs' medians / p95s. Raw: raw/ab.log, raw/ab-*.json. Script: ab.sh + perf.mjs.

| view | quality | before med / p95 | after med / p95 | change (med) |
|---|---|---|---|---|
| plaza (start) | med | 9.2 / 10.1 | 8.9 / 10.0 | -3% (noise level) |
| book overview @ dusk | med | 11.8 / 13.5 | 10.9 / 11.9 | -8% |
| inside Tropical @ dusk | med | 12.8 / 13.7 | 7.2 / 8.8 | **-44%** |
| plaza (start) | low | 4.5 / 5.3 | 4.5 / 5.4 | 0 |
| book overview @ dusk | low | 5.1 / 6.0 | 5.1 / 6.0 | 0 |
| inside Tropical @ dusk | low | 6.3 / 7.1 | 3.6 / 4.7 | **-43%** |

Look: shots/before-*-med.jpg vs shots/after-*-med.jpg, viewed side by side (tropical, book): no visible difference.
Not measured: high quality, other devices / GPUs, walking hitches (standing poses only), CPU vs GPU split (GPU timer queries unreliable on ANGLE/Metal).
