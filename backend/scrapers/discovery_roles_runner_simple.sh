#!/bin/bash

cd "$(dirname "$0")"

clear
echo "🚀 CareerAssistant Discovery Runner (Roles Only)"
echo "=============================================="
echo ""

read -p "Enter roles (comma-separated): " -r input
IFS=',' read -ra roles <<< "$input"

echo ""
echo "Roles (${#roles[@]}):"
for i in "${!roles[@]}"; do
  echo "  $((i+1)). '${roles[i]}'"
done
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
    echo "🔍 Role: '$role'"
    echo "----------------------------------------"
    
    node discovery_scraper.js "$role"
    
    echo "✅ Completed: '$role'"
  done

  echo "✅✅✅ Cycle $cycle COMPLETE"
  echo "Waiting 30 seconds before next cycle... (Ctrl+C to stop)"
  sleep 30
  ((cycle++))
done
