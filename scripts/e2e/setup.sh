#!/usr/bin/env bash
# One-time setup for the robot tester (no sudo needed).
# Playwright's full Chromium (needed: the headless shell cannot load extensions)
# needs libnss3/libnspr4/libasound2, which this WSL distro lacks. We download the
# .debs and extract them into .libs/ instead of installing system-wide.
set -euo pipefail
cd "$(dirname "$0")"
npm install
npx playwright install chromium
mkdir -p .libs .debs
(cd .debs && (apt-get download libnss3 libnspr4 libasound2t64 || apt-get download libnss3 libnspr4 libasound2))
for f in .debs/*.deb; do dpkg -x "$f" .libs; done
rm -rf .debs
echo "Robot tester ready. Try: node run-goal.mjs http://localhost:3001/ \"pay my credit card bill\""
