#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# fix-deepbook-published-at.sh
#
# WHY: moby_policy::agent_swap calls DeepBook's pool::swap_exact_quote_for_base.
# The `deepbook` git dependency (pinned in Move.toml) ships a Published.toml that
# records the testnet deploy as v19 (published-at 0x74cd56…). DeepBook has since
# DISABLED v19 on-chain and the live, ACTIVE testnet package is v20
# (0x22be4c…) — a deploy the team has not committed to the public deepbookv3 repo.
#
# Compiling and `sui move test` work without this (they bind to the type-origin
# 0xfb28c4…, identical across versions, and never run a live swap). But PUBLISHING
# links the dependency's published-at into the on-chain package; if left at v19,
# every agent_swap aborts in pool::load_inner (code 11, version disabled).
#
# This script re-points the resolved dependency's published-at to the active
# version. It is idempotent — safe to re-run. Run it once after a fresh
# dependency fetch and before `sui client publish`.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DISABLED="0x74cd5657843c627f3d80f713b71e9f895bbbeb470956d8a8e1185badf6cc77c8"
ACTIVE="0x22be4cade64bf2d02412c7e8d0e8beea2f78828b948118d46735315409371a3c"

# Move keeps fetched git deps under ~/.move/git/. Locate the deepbook dep's
# Published.toml regardless of the exact rev-hash directory name.
MOVE_HOME="${MOVE_HOME:-$HOME/.move}"
mapfile -t TARGETS < <(find "$MOVE_HOME/git" -path '*deepbookv3*/packages/deepbook/Published.toml' 2>/dev/null)

if [ "${#TARGETS[@]}" -eq 0 ]; then
  echo "No fetched deepbook dependency found under $MOVE_HOME/git."
  echo "Run 'sui move build' first to fetch it, then re-run this script."
  exit 1
fi

changed=0
for f in "${TARGETS[@]}"; do
  if grep -q "$DISABLED" "$f"; then
    # Portable in-place edit (BSD/GNU sed differ on -i; use a temp file).
    sed "s/$DISABLED/$ACTIVE/g" "$f" > "$f.tmp" && mv "$f.tmp" "$f"
    echo "patched: $f"
    changed=1
  elif grep -q "$ACTIVE" "$f"; then
    echo "already active: $f"
  else
    echo "unexpected published-at in: $f (left untouched)"
  fi
done

[ "$changed" -eq 1 ] && echo "Done — deepbook published-at now points to the active testnet version."
exit 0
