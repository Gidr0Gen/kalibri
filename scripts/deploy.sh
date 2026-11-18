#!/bin/sh
# One command publishes Kalibri to GitHub Pages (git push) AND Vercel (production).
# Usage: sh scripts/deploy.sh "commit message"
set -e
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/node/bin:$PATH"
cp index.html 404.html   # SPA fallback for GitHub Pages deep links
git add -A
git commit -m "${1:-Update Kalibri}" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" || echo "nothing to commit"
git push origin main
vercel deploy --prod --yes 2>&1 | grep -E "Aliased|Production|Error" || true
echo "GitHub Pages: https://gidr0gen.github.io/kalibri/"
echo "Vercel:       https://kalibri-omega.vercel.app"
