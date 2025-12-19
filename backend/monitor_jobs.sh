#!/bin/bash
while true; do
    clear
    echo "=== Job Database Monitor ==="
    echo "Total jobs: $(sqlite3 jobs.db 'SELECT COUNT(*) FROM jobs')"
    echo "New jobs: $(sqlite3 jobs.db "SELECT COUNT(*) FROM jobs WHERE status='new'")"
    echo "Enriched: $(sqlite3 jobs.db "SELECT COUNT(*) FROM jobs WHERE status='enriched'")"
    echo ""
    echo "Recent jobs:"
    sqlite3 jobs.db "SELECT title, company, status FROM jobs ORDER BY created_at DESC LIMIT 5"
    sleep 5
done
