#!/bin/bash

# Script to check the status of the latest GitHub Action run
# Usage: ./scripts/check-github-action.sh

echo "Checking GitHub Action status..."
echo "Waiting 3 minutes for action to complete..."

sleep 180

echo "Fetching latest workflow run status..."

# Get the latest workflow run conclusion
RESULT=$(curl -s "https://api.github.com/repos/rgilks/comprehendo/actions/runs?per_page=1" | jq -r '.workflow_runs[0].conclusion')

if [ "$RESULT" = "success" ]; then
    echo "✅ GitHub Action completed successfully!"
    exit 0
elif [ "$RESULT" = "failure" ]; then
    echo "❌ GitHub Action failed!"
    exit 1
elif [ "$RESULT" = "null" ]; then
    echo "⏳ GitHub Action is still running..."
    echo "You may want to wait a bit longer and run this script again."
    exit 2
else
    echo "⚠️  GitHub Action status: $RESULT"
    exit 3
fi
