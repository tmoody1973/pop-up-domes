#!/usr/bin/env bash
# Probe for issue #9: the door-gore radius check cannot be re-run against this repo, and LOG.md still shows 4.21 %.
# Run from anywhere: bash evidence/checks/issue9-probe.sh [git-ref]   (exit 0 = fixed, 1 = bug present)
# With no ref it reads the working tree; with a ref (e.g. main) it reads that commit, so you can see the "before".
cd "$(dirname "$0")/../.." || exit 2
REF=$1
fail=0
bad() { echo "FAIL: $1"; fail=1; }
ok() { echo "ok:   $1"; }
has() { if [ -n "$REF" ]; then git cat-file -e "$REF:$1" 2>/dev/null; else [ -f "$1" ]; fi; }
src() { if [ -n "$REF" ]; then git show "$REF:$1"; else cat "$1"; fi; }

OLD=evidence/wave6/p-doors-headsitemap.mjs
if src "$OLD" | grep -q "/private/tmp" && ! src "$OLD" | grep -q "evidence/checks/door-gore-radius.mjs"; then
  bad "$OLD loads its code from /private/tmp (a session scratch copy) and points to no replacement"
else
  ok "$OLD points to the repo-local replacement"
fi

CHECK=evidence/checks/door-gore-radius.mjs
if ! has "$CHECK"; then
  bad "$CHECK is not in the repo"
elif src "$CHECK" | grep -qE "^const [A-Z_]+ = '/private/tmp|import\('/private/tmp"; then
  bad "$CHECK still loads its code from /private/tmp"
else
  ok "$CHECK exists and loads app/ from this repo"
fi

# LOG.md must record the post-f8ec9cb re-measure: one line naming 1.82 %, the 4.21 % it replaces, and f8ec9cb.
line=$(src LOG.md | grep -n "1\.82" | grep "4\.21" | grep "f8ec9cb" | tail -1)
if [ -n "$line" ]; then
  ok "LOG.md records the re-measure: ${line:0:120}"
else
  bad "LOG.md has no re-measure after f8ec9cb; its latest door-gore figure is still the stale 4.21 %"
fi

exit $fail
