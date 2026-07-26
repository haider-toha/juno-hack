#!/usr/bin/env bash
# Drives the whole demo arc over HTTP and asserts each beat. Run it before a
# take: if this is green, every beat except the spoken conversation itself is
# working, and if it is red it names which one is not.
#
#   make dev        # in another terminal
#   make arc
#
# It ends by leaving the app in the seeded state, ready to film.
set -uo pipefail

BASE="${BASE:-http://localhost:3000}"
SECRET="$(grep -h '^PORTICO_TOOL_SECRET=' .env.local .env 2>/dev/null | head -1 | cut -d= -f2-)"

pass=0
fail=0

check() {
  local name="$1" expected="$2" actual="$3"
  if [[ "$actual" == *"$expected"* ]]; then
    printf '  \033[32mPASS\033[0m  %s\n' "$name"
    pass=$((pass + 1))
  else
    printf '  \033[31mFAIL\033[0m  %s\n        expected: %s\n        got:      %s\n' \
      "$name" "$expected" "$actual"
    fail=$((fail + 1))
  fi
}

# The escalation card's heading is the whole claim of the family screen, so the
# arc asserts on that rather than on an HTTP code.
#
# Keyed on the id the card's own `aria-labelledby` points at, never on its class
# list: the alert branch and the calm branch carry different classes, so a
# class-keyed pattern matches nothing on at least one of them and the assertion
# passes or fails for a reason that has nothing to do with the escalation.
family_says() {
  local heading
  heading="$(curl -sS "$BASE/family" \
    | grep -oE '<h2 id="family-assessment"[^>]*>[^<]*' \
    | sed 's/.*>//' | head -1)"
  # A blank `got:` is what let three silent failures read as a green arc in two
  # documents. Name the absence instead.
  echo "${heading:-(no escalation heading on /family)}"
}

post() { curl -sS -X POST "$BASE$1" -H 'content-type: application/json' ${2:+-d "$2"}; }

echo "Portico demo arc → $BASE"
echo

echo "1 · reset"
check "seed returns the Whitfield plan" '"medications":7' "$(post /api/seed)"

echo "2 · clock"
check "clock reads the seeded day" '"today":"' "$(curl -sS "$BASE/api/demo/clock")"
TODAY="$(curl -sS "$BASE/api/demo/clock" | sed 's/.*"today":"//;s/".*//')"
TOMORROW="$(date -j -v+1d -f %Y-%m-%d "$TODAY" +%Y-%m-%d 2>/dev/null || date -d "$TODAY +1 day" +%Y-%m-%d)"
# Asserts the date it lands on, not that a date came back: a route that ignored
# `shiftDays` and echoed today would satisfy the looser check.
check "clock moves a day" "\"today\":\"$TOMORROW\"" "$(post /api/demo/clock '{"shiftDays":1}')"
check "clock moves back" "\"today\":\"$TODAY\"" "$(post /api/demo/clock "{\"day\":\"$TODAY\"}")"

echo "3 · escalation, from the seeded misses"
check "family escalates to next of kin" "missed twice" "$(family_says)"

echo "4 · escalation clears when the misses are answered"
YESTERDAY="$(date -j -v-1d -f %Y-%m-%d "$TODAY" +%Y-%m-%d 2>/dev/null || date -d "$TODAY -1 day" +%Y-%m-%d)"
BEFORE="$(date -j -v-2d -f %Y-%m-%d "$TODAY" +%Y-%m-%d 2>/dev/null || date -d "$TODAY -2 day" +%Y-%m-%d)"
post /api/demo/log "{\"itemId\":\"med-apixaban\",\"day\":\"$YESTERDAY\",\"status\":\"taken\"}" >/dev/null
check "one answered miss drops it to a nudge" "A dose was missed" "$(family_says)"
post /api/demo/log "{\"itemId\":\"med-apixaban\",\"day\":\"$BEFORE\",\"status\":\"taken\"}" >/dev/null
check "both answered clears it" "Nothing needs your attention" "$(family_says)"

echo "5 · the ElevenLabs server tools"
check "log_step refuses an unauthenticated call" '"unauthorized"' \
  "$(post /api/log '{"patient_id":"demo","check_in_id":"c","item_id":"med-apixaban","status":"missed"}')"
check "log_step writes with the shared secret" '"ok":true' \
  "$(curl -sS -X POST "$BASE/api/log" -H 'content-type: application/json' \
      -H "x-portico-tool-secret: $SECRET" \
      -d '{"patient_id":"demo","check_in_id":"arc","item_id":"med-apixaban","status":"missed"}')"
check "log_step rejects an id that is not in the plan" '"unknown_item"' \
  "$(curl -sS -X POST "$BASE/api/log" -H 'content-type: application/json' \
      -H "x-portico-tool-secret: $SECRET" \
      -d '{"patient_id":"demo","check_in_id":"arc","item_id":"med-nope","status":"taken"}')"
check "escalate refuses an unauthenticated call" '"unauthorized"' \
  "$(post /api/escalate '{"patient_id":"demo","check_in_id":"c","item_id":"med-apixaban","reason":"x"}')"
check "escalate records a miss and names the next of kin" '"next_of_kin":"Daughter"' \
  "$(curl -sS -X POST "$BASE/api/escalate" -H 'content-type: application/json' \
      -H "x-portico-tool-secret: $SECRET" \
      -d '{"patient_id":"demo","check_in_id":"arc","item_id":"med-apixaban","reason":"Could not open the packet."}')"

echo "6 · the raised check-in"
check "nothing is ringing to start with" '"raisedAt":null' \
  "$(curl -sS -X DELETE "$BASE/api/demo/check-in")"
check "the operator can ring it" '"raisedAt":"2' "$(post /api/demo/check-in)"
check "the phone can see it ringing" '"raisedAt":"2' "$(curl -sS "$BASE/api/demo/check-in")"
check "answering clears it" '"raisedAt":null' "$(curl -sS -X DELETE "$BASE/api/demo/check-in")"

echo "7 · the screens"
check "the check-in prompt carries a real plan item" "med-apixaban" "$(curl -sS "$BASE/check-in")"
check "the opening line is plan-aware" "on your plan for today" "$(curl -sS "$BASE/check-in")"
check "the operator panel renders" "Operator — not part of the product" "$(curl -sS "$BASE/operator")"

echo "8 · the empty opening shot"
# Seed first so the surviving days are exactly the two primed misses and the
# assertion can name them. This IS the on-camera procedure: reset, clear the
# letter, roll — the plan then arrives through the real upload.
post /api/seed >/dev/null
check "clearing the letter keeps the primed misses and the clock" \
  "\"today\":\"$TODAY\",\"keptLogDays\":[\"$BEFORE\",\"$YESTERDAY\"]" \
  "$(curl -sS -X DELETE "$BASE/api/demo/plan")"
check "the panel sees no plan stored" "none stored" "$(curl -sS "$BASE/operator")"

echo
echo "9 · leaving the app seeded and ready to film"
post /api/seed >/dev/null
echo "  today is now $(curl -sS "$BASE/api/demo/clock" | sed 's/.*"today":"//;s/".*//'), apixaban missed twice"

echo
printf '%d passed, %d failed\n' "$pass" "$fail"
[[ "$fail" -eq 0 ]]
