#!/bin/bash
set -euo pipefail

# === CONFIG BACKOFFICE ===
PROJECT_DIR="/home/prima-flows/Documents/GitHub/flows-backoffice/flows-backoffice"   
DIST_DIR="$PROJECT_DIR/dist"
NGINX_WEBROOT="/var/www/backoffice-flows"
PM2_API_APP="flows-backoffice-backend"
DOMAIN="https://backoffice-flows.unica.it"

cd "$PROJECT_DIR"

echo "📦 Build BACKOFFICE (Vite)..."
rm -rf dist

# build riproducibile se esiste package-lock.json
if [ -f package-lock.json ]; then
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

echo "🔁 Restart API (PM2: $PM2_API_APP)..."
pm2 restart "$PM2_API_APP"

echo "🔍 Nginx config test + reload..."
sudo nginx -t
sudo systemctl reload nginx

echo "✅ Deploy completato! Visita: $DOMAIN"
