| feature (ablation) | start: ms saved med / p95 | book @ dusk | inside Tropical @ dusk |
|---|---|---|---|
| *baseline frame (mean of all "on" runs), ms med / p95* | 9.6 / 12.2 | 12.3 / 14.6 | 13.1 / 14.6 |
| key-light shadows (caster pass + PCSS receivers) | 1.8 / 2.5 | 3.6 / 3.6 | 7.4 / 7.5 |
| shadow-map re-render (stale map) | 0.1 / 0.2 | -0.5 / -0.4 | 6.1 / 2.4 |
| whole post stack (scene straight to canvas, no MSAA/HDR) | 3.4 / 2.9 | 5.4 / 5.8 | 3.2 / 3.8 |
| interior cards casting shadows | 0.1 / 0.0 | 0.0 / 0.1 | 5.2 / 5.3 |
| pixel ratio 1.25 -> 1 | 3.0 / 2.7 | 2.7 / 2.6 | 3.8 / 4.0 |
| MSAA 2x on the HDR scene target | 1.3 / 1.4 | 3.5 / 3.9 | 1.9 / 2.2 |
| dome shells (hidden) | 0.1 / 0.0 | 2.9 / 3.1 | 1.4 / 1.2 |
| interiors (hidden) | -0.1 / -0.1 | 0.1 / 0.3 | 2.7 / 2.5 |
| all half-res post passes | 1.3 / 1.1 | 0.8 / 1.1 | 1.0 / 0.9 |
| PCSS taps 8/12 -> 4/6 | 0.2 / 0.4 | 1.2 / 1.2 | 1.2 / 1.2 |
| HDR half-float -> 8-bit scene target | 0.9 / 0.5 | 0.3 / 0.5 | 1.1 / 0.8 |
| site pieces (hidden) | 1.1 / 1.1 | 0.3 / -0.8 | 0.3 / 0.6 |
| dome shells casting shadows | 0.1 / -0.0 | 0.4 / 0.7 | 1.0 / 0.7 |
| shadow map 2048 -> 1024 | 0.2 / 0.5 | 0.4 / 0.4 | 0.6 / 0.3 |
| DOF (tile + gather + fill) | 0.5 / -1.1 | 0.5 / 0.4 | 0.0 / 0.0 |
| room (hidden) | 0.1 / 0.3 | 0.5 / 0.4 | 0.1 / 0.1 |
| AO pass + composite AO taps | 0.5 / 0.9 | 0.2 / 0.3 | 0.2 / 0.4 |
| chroma | 0.4 / 2.9 | -0.2 / -0.6 | 0.1 / 0.1 |
| post prefilter pass | 0.3 / 0.2 | 0.1 / 0.3 | 0.2 / 0.1 |
| DOF fill pass | -0.1 / -0.4 | 0.2 / 0.2 | 0.2 / 0.0 |
| bloom passes + composite | 0.1 / -0.2 | 0.1 / 0.0 | 0.2 / 0.0 |
| composite cut-edge rim taps | 0.2 / 0.3 | 0.1 / 0.1 | 0.0 / 0.0 |
| grain | -0.5 / -0.4 | 0.1 / 0.2 | 0.0 / 0.1 |
| sharpen | 0.1 / 0.4 | 0.1 / 0.2 | 0.1 / -0.3 |
| life + animals (?life=0&animals=0, page reloads) | 0.1 / -0.0 | -0.2 / -0.7 | 0.1 / 0.1 |
| site pieces casting shadows | 0.1 / 0.0 | 0.1 / 0.2 | 0.0 / 0.1 |
| life + animals (hidden at runtime) | 0.0 / 0.1 | 0.0 / 0.5 | 0.0 / 0.1 |
| pixel ratio 1.25 -> 2 (negative = costs more) | -11.8 / -14.5 | -11.9 / -29.7 | -16.3 / -18.1 |
