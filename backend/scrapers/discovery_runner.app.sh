#!/bin/bash

# Make it double-click friendly
cd "$(dirname "$0")"

clear
echo "🚀 CareerAssistant Discovery Runner"
echo "=================================="
echo ""

# Prompt for roles
read -p "Enter roles (comma-separated, e.g. program manager,business analyst,project manager): " -r role_input
IFS=',' read -ra roles <<< "$role_input"
roles=($(printf '%s\n' "${roles[@]}" | xargs -n1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'))

echo ""
echo "Roles: ${roles[*]}"
echo ""

# Prompt for countries
read -p "Enter countries (comma-separated, e.g. United States,Canada,United Kingdom): " -r country_input
IFS=',' read -ra countries <<< "$country_input"
countries=($(printf '%s\n' "${countries[@]}" | xargs -n1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'))

echo ""
echo "Countries: ${countries[*]}"
echo ""
echo "Starting infinite discovery cycles... Press Ctrl+C to stop"
echo "=================================="

cycle=1
while true; do
  echo ""
  echo "🔄 CYCLE $cycle STARTING ($((${#roles[@]} * ${#countries[@]})) subcycles)"
  echo "=================================="

  for role in "${roles[@]}"; do
    for country in "${countries[@]}"; do
      echo ""
      echo "----------------------------------------"
      echo "🔍 Role: $role"
      echo "📍 Country: $country"
      echo "----------------------------------------"
      
      node discovery_scraper.js "$role" "$country"
      
      echo "✅ Completed: $role in $country"
      echo ""
    done
  done

  echo "✅✅✅ Cycle $cycle COMPLETE"
  echo "Waiting 30 seconds before next cycle... (Ctrl+C to stop)"
  sleep 30
  ((cycle++))
done
