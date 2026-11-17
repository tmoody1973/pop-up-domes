# 003: Two separate AI judges, one for the look and one for accuracy

- **Decision:** Each part of the build gets scored by two independent AI critics: one judges whether it looks like the Papertrails paper style, the other measures whether it matches the real Domes.
- **Why this came up:** The original prompt has one critic compare the build to the reference pictures until it can't tell them apart. That works when the references are all the same kind of picture. Ours are two kinds: paper-craft art and real photos. A paper model next to a photo will always be picked out, so a single critic would loop forever, or push the build toward photo-realism and lose the paper look.
- **Options:**
  1. Two judges: a look judge (blind side-by-side against the paper references) and a fidelity judge (measured checks against the plans and photos). Cost: twice the critic runs, so more time and usage.
  2. One judge comparing against new AI-generated "paper Domes" concept images only. Cost: if those images get the dome shape wrong, the build copies the mistake and nobody catches it.
  3. One judge with a mixed checklist. Cost: style and accuracy trade against each other inside one score, so you can't see which one slipped.
- **What we chose and why:** Option 1. Claude's call. Accuracy here can be measured (the dome outline against the profile table, positions against the plan), so it should be measured rather than eyeballed, while style can only be judged by eye. The look judge passes when, over 6 blind trials, it picks the reference 4 or fewer times. Each judge gets a round limit (5 rounds, or stop after 2 rounds with no gain) so the loop has a budget, and a part that hits the limit is reported as a logged FAIL, never quietly counted as done.
- **What we gave up:** Cost and speed. Also, "the look judge can't tell them apart" is still a judgement by an AI, not a person; it can be fooled.
- **How we'll know if this was right:** Both judges reach a pass on the dome component before its round limit, and a person who knows the Domes recognises them in the 30-second capture without being told.
- **What actually happened:**
