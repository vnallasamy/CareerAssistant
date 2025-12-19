#!/bin/bash

# Navigate to backend directory
cd "$(dirname "$0")/../../../backend"

# Kill any existing processes
pkill -f "node server.js"
pkill -f continuous_scraper
pkill -f job_enricher
lsof -ti:3000 | xargs kill -9 2>/dev/null

# Start the server in background
nohup node server.js > /tmp/career-assistant.log 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > /tmp/career-assistant.pid

# Wait for server to start
sleep 3

# Open Safari to localhost:3000
open -a Safari http://localhost:3000

# Exit this script (terminal will close)
exit 0
