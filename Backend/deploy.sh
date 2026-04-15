#!/bin/bash

echo "=== File Management System - Ubuntu Deployment ==="

# 1. Update system
echo ">> Updating system packages..."
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js v22 (matches your dev environment)
echo ">> Installing Node.js v22..."
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Verify Node.js and npm
echo ">> Node version: $(node -v)"
echo ">> NPM version: $(npm -v)"

# 4. Install PM2 globally to keep app running
echo ">> Installing PM2..."
sudo npm install -g pm2

# 5. Install project dependencies
echo ">> Installing project dependencies..."
npm install --omit=dev

# 6. Check .env exists
if [ ! -f ".env" ]; then
    echo "ERROR: .env file not found. Copy .env.example to .env and fill in your values."
    echo "  cp .env.example .env && nano .env"
    exit 1
fi

# 7. Start app with PM2
echo ">> Starting app with PM2..."
pm2 start ecosystem.config.cjs

# 8. Save PM2 process list and enable startup on reboot
pm2 save
pm2 startup | tail -1 | sudo bash

echo ""
echo "=== Deployment Complete ==="
echo "App running on port 3000"
echo "Use 'pm2 logs file-management' to view logs"
echo "Use 'pm2 status' to check app status"
