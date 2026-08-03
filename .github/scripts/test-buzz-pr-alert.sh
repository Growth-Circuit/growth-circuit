#!/usr/bin/env bash

set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
state_dir=$(mktemp -d)
trap 'rm -rf "$state_dir"' EXIT

export BUZZ_CHANNEL_ID=test-channel
export BUZZ_CI_PRIVATE_KEY=test-private-key
export BUZZ_CI_PUBLIC_KEY=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
export BUZZ_RELAY_URL=wss://relay.example.test
export GITHUB_REPOSITORY=example/growth-circuit
export MOCK_NAK_STATE="$state_dir"
export NAK_BIN="$repo_root/.github/scripts/test-fixtures/mock-nak.sh"
export PR_AUTHOR=tester
export PR_NUMBER=42
export PR_TITLE='Thread locator regression'
export PR_URL=https://example.test/pull/42

alert_script="$repo_root/.github/scripts/buzz-pr-alert.sh"

"$alert_script" notify-pr

# Simulate newer CI-authored events arriving after the root. The prior kind 9
# lookup could lose the older root when a relay applied limit before #d filtering.
for index in $(seq 1 50); do
  BUZZ_MESSAGE="Unrelated event $index" \
  BUZZ_UPDATE_KEY="unrelated:$index" \
    "$alert_script" notify-standalone
done

"$alert_script" notify-pr

BUZZ_MESSAGE='Build passed' \
BUZZ_UPDATE_KEY='buzz-pr-update:example/growth-circuit#42:build:1' \
BUZZ_REACTION='✅' \
  "$alert_script" notify-pr

BUZZ_MESSAGE='Build passed' \
BUZZ_UPDATE_KEY='buzz-pr-update:example/growth-circuit#42:build:1' \
BUZZ_REACTION='✅' \
  "$alert_script" notify-pr

BUZZ_MESSAGE='Build failed' \
BUZZ_UPDATE_KEY='buzz-pr-update:example/growth-circuit#42:build:2' \
BUZZ_REACTION='❌' \
  "$alert_script" notify-pr

root_count=$(awk -F '\t' '$1 == 9 && $2 ~ /^buzz-pr:/ {count++} END {print count + 0}' "$state_dir/events")
reply_count=$(awk -F '\t' '$1 == 9 && $2 ~ /^buzz-pr-update:/ {count++} END {print count + 0}' "$state_dir/events")
root_locator_count=$(jq -rs '[.[] | select(.d == "buzz-pr:example/growth-circuit#42")] | length' "$state_dir/locators")
terminal_reactions=$(jq -crs '[.[] | .content] | sort' "$state_dir/reactions")

[ "$root_count" -eq 1 ]
[ "$reply_count" -eq 2 ]
[ "$root_locator_count" -eq 1 ]
[ "$terminal_reactions" = '["❌"]' ]

printf 'Buzz PR alert regression test passed\n'
