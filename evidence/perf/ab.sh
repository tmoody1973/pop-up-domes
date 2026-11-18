#!/bin/sh
# Before/after A/B: alternate the two builds launch by launch (before = HEAD build on :5361, after = this branch on :5360).
cd "$(dirname "$0")"
for q in med low; do for v in start book tropical; do for i in 1 2 3; do
  uptime
  BASE=http://127.0.0.1:5361/ node perf.mjs base $v ab-before-$i $q
  BASE=http://127.0.0.1:5360/ node perf.mjs base $v ab-after-$i $q
done; done; done
