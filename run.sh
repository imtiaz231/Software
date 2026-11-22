#!/usr/bin/env bash
# Shop Manager - one command does everything:  ./run.sh        (development mode: ./run.sh dev)
set -e
cd "$(dirname "$0")"

command -v node >/dev/null 2>&1 || { echo "Node.js is not installed. Install Node 22 or 24 (LTS) from nodejs.org."; exit 1; }
echo "Node $(node -v)"

[ -d server/node_modules ] || { echo ">> Installing server packages..."; npm --prefix server install; }
[ -d client/node_modules ] || { echo ">> Installing client packages..."; npm --prefix client install; }
[ -f server/.env ] || { cp server/.env.example server/.env; echo ">> Created server/.env (change ADMIN_PASSWORD and JWT_SECRET inside it)"; }

if [ "$1" = "dev" ]; then
  echo ">> Dev mode: the app opens at http://localhost:5173"
  npm --prefix server run dev &
  SERVER_PID=$!
  trap 'kill $SERVER_PID 2>/dev/null' EXIT
  npm --prefix client run dev
else
  echo ">> Building the frontend (a few seconds)..."
  npm --prefix client run build
  echo ">> Starting: http://localhost:4000"
  npm --prefix server start
fi
