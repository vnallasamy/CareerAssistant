#!/bin/bash

cd "$(dirname "$0")"

clear
echo "🚀 CareerAssistant Discovery Runner (Roles Only)"
echo "=============================================="
echo ""

read -p "Enter roles (comma-separated): " -r role_input
IFS=',' read -ra roles <<< "$role_input"
roles=($(printf '%s\n' "${roles[@]}" | xargs -n1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'))

echo ""
echo "Roles: ${roles[*]}"
echo ""
echo "Starting infinite discovery cycles... Press Ctrl+C to stop"
echo "=============================================="

cycle=1
while true; do
  echo ""
  echo "🔄 CYCLE $cycle STARTING (${#roles[@]} subcycles)"
  echo "=================================="

  for role in "${roles[@]}"; do
    echo ""
    echo "----------------------------------------"
    echo "🔍 Role: $role"
    echo "----------------------------------------"
    
    node discovery_scraper.js "$role"
    
    echo "✅ Completed: $role"
    echo ""
  done

  echo "✅✅✅ Cycle $cycle COMPLETE"
  echo "Waiting 30 seconds before next cycle... (Ctrl+C to stop)"
  sleep 30
  ((cycle++))
done
