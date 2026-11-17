# 002: Hand-place the Domes site, and let the random world continue around it (SUPERSEDED by 004)

- **Decision:** Inside Mitchell Park, every piece is placed from the real plans; outside the park, Papertrails' random world generator keeps running.
- **Why this came up:** Papertrails invents its world as you walk, using wave function collapse (a method that picks tiles one at a time so every edge matches its neighbour, like a self-solving jigsaw). The Domes are a real building with a known plan, so inventing their layout would get them wrong.
- **Options:**
  1. Hand-placed park inside, generated countryside outside. Cost: a seam where the two meet. A plain lawn ring is not enough, because the generator decides where roads and rivers cross each 8×8-tile block's edge before it fills the block in. So the park must line up with whole blocks, and the generator must be told "no roads or rivers into the park except the entry drive". (First draft assumed the lawn ring was enough; a review of the code caught it.)
  2. Hand-placed park only, with the page ending at the park edge. Cost: loses the "endless book" feeling that made the original charming.
  3. Keep the generator and nudge it toward domes. Cost: the layout would never match the plan, which defeats the point of the reference pack.
- **What we chose and why:** Option 1. Claude's call. The generator only talks to the rest of the code through a handful of calls, so a wrapper can answer "what's at this spot?" from the plan inside the park and pass every other question through unchanged.
- **What we gave up:** Simplicity. Two sources of tiles instead of one, and a known limit: the generator crashes past 96 tile types and already uses 95, so Domes tiles have to be kept on a separate list.
- **How we'll know if this was right:** Walking out of the park in any direction shows no broken paths or gaps at the boundary, and the dome positions measure within 5 ft (scaled) of the plan.
- **What actually happened:**
