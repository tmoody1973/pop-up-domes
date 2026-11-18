# 008: When a dome door is drawn off its path, the wall gap follows the drawing

- **Decision:** For the Show Dome door toward the lobby, the invisible wall the traveller bumps into now opens exactly where the door is drawn. The drawn door stays where it was, about 2.3 ft from where the path arrives.
- **Why this came up:** Each dome is 16 paper panels ("gores"). This door's path lands close to the seam between two panels. Cutting the door there would slice the seam and spoil the dome's shape check (issue #9). So the drawing code slid the door 2.3 ft toward the middle of its panel. The collision code, which decides where the traveller can walk, still opened its gap at the path. What you saw and what you could walk through no longer matched (issue #10).
- **Options:**
  1. Move the collision gap to the drawn door. Cost: the path now meets the door 2.3 ft off-centre. The traveller still clears it with 3.6 ft to spare.
  2. Move the drawn door back onto the path. Cost: the cut crosses the seam again, which brings back the shape problem the slide was added to fix.
  3. Make the door narrower so it fits beside the seam at the path. Cost: the door shrinks from 12 ft to about 7 ft, smaller than the real vestibules.
- **What we chose and why:** Option 1. Claude chose it inside the factory bug fix. It is the only option that keeps the dome shape and the door size. It also leaves one place in the code that decides where doors are: the drawing and the collision both ask the same function.
- **What we gave up:** The door is not perfectly centred on its path. Someone walking straight in will see the opening sit slightly to one side.
- **How we'll know if this was right:** `evidence/checks/door-alignment.mjs` passes: every drawn door is within 0.3 ft of its gap, and every path walks through. Then someone walks the traveller into the Show Dome from the lobby and the door does not look off.
- **What actually happened:**
