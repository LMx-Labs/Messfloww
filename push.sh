#!/bin/bash

# Messflow Git Update Script
# Usage: ./push.sh

PROJECT_DIR="/Users/samnagar/Desktop/Messflow"
cd "$PROJECT_DIR" || exit

# Check if there are changes
if [[ -z $(git status -s) ]]; then
    echo "✅ No changes to push."
    exit 0
fi

echo "--- Current Changes ---"
git status -s
echo "-----------------------"
echo ""

# Prompt for commit message
echo "What changes did you make?"
read -p "> " commit_msg

# Validate input
if [[ -z "$commit_msg" ]]; then
    echo "⚠️ Commit message cannot be empty. Aborting."
    exit 1
fi

# Execute Git operations
echo "🚀 Staging changes..."
git add -A

echo "💾 Committing changes..."
git commit -m "$commit_msg"

echo "☁️  Pushing to GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo "✅ Successfully updated on Git!"
else
    echo "❌ Push failed. Please check for errors above."
fi
