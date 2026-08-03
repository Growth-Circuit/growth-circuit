#!/usr/bin/env bash

set -euo pipefail

: "${BUZZ_CHANNEL_ID:?BUZZ_CHANNEL_ID is required}"
: "${BUZZ_CI_PRIVATE_KEY:?BUZZ_CI_PRIVATE_KEY is required}"
: "${BUZZ_CI_PUBLIC_KEY:?BUZZ_CI_PUBLIC_KEY is required}"
: "${BUZZ_RELAY_URL:?BUZZ_RELAY_URL is required}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

NAK_BIN=${NAK_BIN:-nak}

query_events() {
  "$NAK_BIN" req \
    --auth \
    --force-pre-auth \
    --sec "$BUZZ_CI_PRIVATE_KEY" \
    "$@" \
    "$BUZZ_RELAY_URL"
}

publish_event() {
  "$NAK_BIN" event \
    --auth \
    --force-pre-auth \
    --sec "$BUZZ_CI_PRIVATE_KEY" \
    "$@" \
    "$BUZZ_RELAY_URL" >/dev/null
}

event_id_for_d_tag() {
  local d_tag=$1
  local events

  events=$(query_events -k 9 -a "$BUZZ_CI_PUBLIC_KEY" -d "$d_tag" -l 1)
  jq -rs 'sort_by(.created_at) | last | .id // empty' <<< "$events"
}

ensure_root() {
  : "${PR_AUTHOR:?PR_AUTHOR is required}"
  : "${PR_NUMBER:?PR_NUMBER is required}"
  : "${PR_TITLE:?PR_TITLE is required}"
  : "${PR_URL:?PR_URL is required}"

  local root_key="buzz-pr:${GITHUB_REPOSITORY}#${PR_NUMBER}"
  local root_id
  local content

  root_id=$(event_id_for_d_tag "$root_key")
  if [ -n "$root_id" ]; then
    printf '%s\n' "$root_id"
    return
  fi

  printf -v content '🔔 **PR #%s: %s**\n%s opened this pull request.\n[Open in GitHub](%s)' \
    "$PR_NUMBER" "$PR_TITLE" "$PR_AUTHOR" "$PR_URL"

  publish_event \
    -k 9 \
    -c "$content" \
    -h "$BUZZ_CHANNEL_ID" \
    -d "$root_key"

  for _ in 1 2 3 4 5; do
    root_id=$(event_id_for_d_tag "$root_key")
    if [ -n "$root_id" ]; then
      printf '%s\n' "$root_id"
      return
    fi
    sleep 1
  done

  echo "Published the PR root but could not read it back from Buzz" >&2
  return 1
}

post_reply_once() {
  local root_id=$1
  local update_key=$2
  local message=$3

  if [ -n "$(event_id_for_d_tag "$update_key")" ]; then
    return
  fi

  publish_event \
    -k 9 \
    -c "$message" \
    -h "$BUZZ_CHANNEL_ID" \
    -d "$update_key" \
    -t "e=${root_id};;reply"
}

set_terminal_reaction() {
  local root_id=$1
  local desired_emoji=$2
  local events
  local matching_count
  local terminal_count

  events=$(query_events -k 7 -a "$BUZZ_CI_PUBLIC_KEY" -e "$root_id")
  matching_count=$(jq -rs --arg emoji "$desired_emoji" \
    '[.[] | select(.content == $emoji)] | length' <<< "$events")
  terminal_count=$(jq -rs \
    '[.[] | select(.content == "✅" or .content == "❌")] | length' <<< "$events")

  if [ "$matching_count" -gt 0 ] && [ "$matching_count" -eq "$terminal_count" ]; then
    return
  fi

  jq -rs -r '.[] | select(.content == "✅" or .content == "❌") | .id' <<< "$events" |
    while IFS= read -r reaction_id; do
      [ -n "$reaction_id" ] || continue
      publish_event -k 5 -c '' -e "$reaction_id"
    done

  publish_event -k 7 -c "$desired_emoji" -e "$root_id"
}

post_standalone_once() {
  : "${BUZZ_MESSAGE:?BUZZ_MESSAGE is required}"
  : "${BUZZ_UPDATE_KEY:?BUZZ_UPDATE_KEY is required}"

  if [ -n "$(event_id_for_d_tag "$BUZZ_UPDATE_KEY")" ]; then
    return
  fi

  publish_event \
    -k 9 \
    -c "$BUZZ_MESSAGE" \
    -h "$BUZZ_CHANNEL_ID" \
    -d "$BUZZ_UPDATE_KEY"
}

case "${1:-notify-pr}" in
  notify-pr)
    root_id=$(ensure_root)

    if [ -n "${BUZZ_MESSAGE:-}" ]; then
      : "${BUZZ_UPDATE_KEY:?BUZZ_UPDATE_KEY is required when BUZZ_MESSAGE is set}"
      post_reply_once "$root_id" "$BUZZ_UPDATE_KEY" "$BUZZ_MESSAGE"
    fi

    if [ -n "${BUZZ_REACTION:-}" ]; then
      case "$BUZZ_REACTION" in
        ✅|❌) set_terminal_reaction "$root_id" "$BUZZ_REACTION" ;;
        *) echo "BUZZ_REACTION must be ✅ or ❌" >&2; exit 1 ;;
      esac
    fi
    ;;
  notify-standalone)
    post_standalone_once
    ;;
  *)
    echo "Usage: $0 [notify-pr|notify-standalone]" >&2
    exit 2
    ;;
esac
