#!/bin/bash
cd /Users/nallasamyv/Downloads/careerassistantv1.6/backend/scrapers

roles=("program manager" "business analyst" "project manager")
locations=("United States" "Canada")

cycle=1
while true; do
  echo ""
  echo "========================================"
  echo "🔄 CYCLE $cycle STARTING"
  echo "========================================"
  
  for role in "${roles[@]}"; do
    for location in "${locations[@]}"; do
      echo ""
      echo "----------------------------------------"
      echo "🔍 Role: $role"
      echo "📍 Location: $location"
      echo "----------------------------------------"
      node discovery_scraper.js "$role" "$location"
      echo "✅ Completed: $role in $location"
    done
  done
  
  echo ""
  echo "✅✅✅ Cycle $cycle COMPLETE (6 subcycles)"
  echo "Waiting 30 seconds before next cycle..."
  sleep 30
  ((cycle++))
done
