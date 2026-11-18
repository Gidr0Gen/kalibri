#!/bin/sh
# Publish to GitHub Pages (main branch, repo root). Run from anywhere: sh scripts/deploy.sh "message"
set -e
cd "$(dirname "$0")/.."
cp index.html 404.html   # SPA fallback for deep links like /kalibri/progress
git add -A
git commit -m "${1:-Update Kalibri}" || echo "nothing to commit"
git push origin main
