#!/bin/bash
set -euo pipefail

# === CONFIG BACKOFFICE ===
PROJECT_DIR="/home/prima-flows/Documents/GitHub/flows-backoffice/flows-backoffice"
FRONTEND_DIR="$PROJECT_DIR/frontend"
DIST_DIR="$FRONTEND_DIR/dist"
BACKEND_DIR="$PROJECT_DIR/backend"
BACKEND_ENTRY="$BACKEND_DIR/server.js"
NGINX_WEBROOT="/var/www/backoffice-flows"
PM2_API_APP="flows-backoffice-backend"
DOMAIN="https://backoffice-flows.unica.it"

cd "$FRONTEND_DIR"

echo "📦 Build BACKOFFICE (Vite)..."
rm -rf "$DIST_DIR"

# build riproducibile se esiste package-lock.json
if [ -f "$FRONTEND_DIR/package-lock.json" ]; then
  npm ci
else
  npm install
fi

npm run build

echo "📁 Deploy frontend in $NGINX_WEBROOT..."
sudo mkdir -p "$NGINX_WEBROOT"
sudo rm -rf "$NGINX_WEBROOT"/*
sudo cp -r "$DIST_DIR"/* "$NGINX_WEBROOT"/
sudo chown -R www-data:www-data "$NGINX_WEBROOT"

echo "📦 Install backend dependencies..."
cd "$BACKEND_DIR"
rm -rf "$BACKEND_DIR/node_modules"
if [ -f "$BACKEND_DIR/package-lock.json" ]; then
  npm ci
else
  npm install
fi

echo "🔁 Restart API (PM2: $PM2_API_APP)..."
pm2 delete "$PM2_API_APP" >/dev/null 2>&1 || true
pm2 start "$BACKEND_ENTRY" --name "$PM2_API_APP" --cwd "$BACKEND_DIR"

echo "🔍 Nginx config test + reload..."
sudo nginx -t
sudo systemctl reload nginx

echo "✅ Deploy completato! Visita: $DOMAIN"
