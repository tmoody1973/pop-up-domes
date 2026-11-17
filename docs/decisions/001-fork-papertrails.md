# 001: Start from the Papertrails code instead of building from scratch

- **Decision:** Fork Papertrails, the open-source code behind the "Pop-up Atlas" demo, and add the Domes to it.
- **Why this came up:** The original prompt builds the whole toy from nothing. Then a link to the finished code turned up. Starting over would spend days re-earning a look that already exists, and the look is the hard part.
- **Options:**
  1. Fork Papertrails. Cost: we inherit 15,500 lines we didn't write, and two of its own guides (an architecture doc and the Blender scripts that made its 3D pieces) are missing from the repo.
  2. Build from scratch with the prompt alone. Cost: the agent has to rediscover the paper materials, spring-driven folds and sound, and may never match them.
  3. Borrow only the materials and fold engine. Cost: the pieces are wired together, so pulling some out means rewiring the rest.
- **What we chose and why:** Option 1. Joint call: Tarik shared the repo; Claude checked that its licence (MIT, a permissive licence that allows reuse if the copyright notice stays) permits it and that the part we need to replace connects through one narrow hand-off.
- **What we gave up:** Control over the foundation. Bugs and design choices in Papertrails become ours, and the missing guides have to be reverse-engineered.
- **How we'll know if this was right:** The first Domes render keeps the Papertrails look (the look judge can't tell it from the original screenshots) within the first two critic rounds.
- **What actually happened:**
