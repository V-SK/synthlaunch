#!/bin/bash
source ~/.nvm/nvm.sh
cd ~/synthlaunch
set -a
source .env.local
set +a
npx tsx scripts/run-twitter-bot.ts
