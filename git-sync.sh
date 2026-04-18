#!/bin/bash

# Configuration
PROJECT_DIR="/Users/samnagar/Desktop/Messflow"
LOG_FILE="$PROJECT_DIR/logs/git-sync.log"

# Ensure logs directory exists
mkdir -p "$PROJECT_DIR/logs"

# Navigate to project directory
cd "$PROJECT_DIR" || exit

# Log start time
echo "-----------------------------------" >> "$LOG_FILE"
echo "Sync started at: $(date)" >> "$LOG_FILE"

# Check if there are changes
if [[ -z $(git status -s) ]]; then
    echo "No changes to sync." >> "$LOG_FILE"
    exit 0
fi

# Sync process
echo "Changes detected. Syncing..." >> "$LOG_FILE"

# Add all changes
git add -A >> "$LOG_FILE" 2>&1

# Commit changes
COMMIT_MSG="Auto-update: $(date '+%Y-%m-%d %H:%M:%S')"
git commit -m "$COMMIT_MSG" >> "$LOG_FILE" 2>&1

# Push to remote
git push origin main >> "$LOG_FILE" 2>&1

if [ $? -eq 0 ]; then
    echo "Sync successful." >> "$LOG_FILE"
else
    echo "Sync failed! Check logs for details." >> "$LOG_FILE"
fi

echo "Sync finished at: $(date)" >> "$LOG_FILE"
