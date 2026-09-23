#!/usr/bin/env bash

set -euo pipefail

: "${MOCK_NAK_STATE:?MOCK_NAK_STATE is required}"

command=$1
shift

kind=''
d_tag=''
e_tag=''
content=''

while [ "$#" -gt 0 ]; do
  case "$1" in
    -k) kind=$2; shift 2 ;;
    -d) d_tag=$2; shift 2 ;;
    -e) e_tag=$2; shift 2 ;;
    -c) content=$2; shift 2 ;;
    -t)
      case "$2" in
        e=*) e_tag=${2#e=} ;;
      esac
      shift 2
      ;;
    --sec|-a|-l|-h) shift 2 ;;
    --auth|--force-pre-auth) shift ;;
    *) shift ;;
  esac
done

mkdir -p "$MOCK_NAK_STATE"

if [ "${MOCK_NAK_FAIL_COMMAND:-}" = "$command" ] && [ "${MOCK_NAK_FAIL_KIND:-}" = "$kind" ]; then
  exit 1
fi

if [ "$command" = req ]; then
  if [ "$kind" = 30078 ] && [ -f "$MOCK_NAK_STATE/locators" ]; then
    jq -c --arg d "$d_tag" 'select(.d == $d)' "$MOCK_NAK_STATE/locators"
  elif [ "$kind" = 7 ] && [ -f "$MOCK_NAK_STATE/reactions" ]; then
    jq -c --arg e "$e_tag" 'select(.target == $e) | {id,content}' "$MOCK_NAK_STATE/reactions"
  fi
  exit 0
fi

counter_file="$MOCK_NAK_STATE/counter"
counter=0
[ ! -f "$counter_file" ] || counter=$(<"$counter_file")
counter=$((counter + 1))
printf '%s' "$counter" > "$counter_file"
id=$(printf '%064d' "$counter")

printf '%s\t%s\t%s\n' "$kind" "$d_tag" "$e_tag" >> "$MOCK_NAK_STATE/events"

case "$kind" in
  30078)
    jq -nc \
      --arg d "$d_tag" \
      --arg id "$id" \
      --arg content "$content" \
      '{d:$d,id:$id,created_at:1,content:$content}' >> "$MOCK_NAK_STATE/locators"
    ;;
  7)
    jq -nc \
      --arg target "$e_tag" \
      --arg id "$id" \
      --arg content "$content" \
      '{target:$target,id:$id,content:$content}' >> "$MOCK_NAK_STATE/reactions"
    ;;
  5)
    if [ -f "$MOCK_NAK_STATE/reactions" ]; then
      jq -c --arg id "$e_tag" 'select(.id != $id)' \
        "$MOCK_NAK_STATE/reactions" > "$MOCK_NAK_STATE/reactions.next"
      mv "$MOCK_NAK_STATE/reactions.next" "$MOCK_NAK_STATE/reactions"
    fi
    ;;
esac

jq -nc --arg id "$id" '{id:$id}'
