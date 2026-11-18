# 006: Measure first, then fix the one thing that actually cost the most

- **Decision:** Before touching any visual effect, time every feature by switching it off and on, then fix only what the numbers point at. The biggest cost turned out to be a bookkeeping stall, not an effect.
- **Why this came up:** Tarik reported the toy felt sluggish. The tempting fix was to turn off the expensive-looking effects (blur, glow, shadows), which would make it look worse, possibly for nothing.
- **Options:**
  1. Cut effects by guesswork. Cost: a flatter look, and maybe no speed-up if the guess is wrong.
  2. Measure each feature's cost, fix the top items with cheaper equivalents that look the same. Cost: about two hours of timed runs on a busy laptop.
  3. Leave it and rely on auto quality to step slow devices down. Cost: every device pays the hidden stall, and auto quality turned out to be only half working.
- **What we chose and why:** Option 2. Tarik asked for "proper" optimization; Claude ran it. Inside a dome, a frame cost 12.8 ms; the cause was the interior cards' draw list being rebuilt and re-sent to the graphics chip twice per frame (a list of which paper cards to draw; three.js redoes it when per-card sorting or culling is on). Turning both off for those opaque cards dropped it to 7.2 ms (44% faster) with no visible change. Two smaller fixes rode along: a cheaper soft-shadow filter on the default quality, and auto quality now really drops shadows and effects on a slow device (before, it only lowered the resolution).
- **What we gave up:** Interior cards are no longer skipped one by one when off-screen; the whole open room is drawn. That is cheaper here, but could cost more if a room grew to thousands of cards. The dome shells keep a smaller version of the same stall (~0.5 ms), because see-through cards must be sorted.
- **How we'll know if this was right:** Walking inside the Tropical Dome on Tarik's machine feels as smooth as walking the plaza; on the deployed site, a slow laptop visibly drops to the simpler look instead of stuttering.
- **What actually happened:**
