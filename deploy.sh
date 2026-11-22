#!/bin/bash

# ==========================================
# Discord Music Bot - Deployment Script
# ==========================================

echo "🚀 Starting deployment..."

# 1. Go to project directory
cd ~/discord-music-bot || { echo "❌ Project directory not found!"; exit 1; }

# 2. (Optional) Pull latest changes from Git
# echo "📥 Pulling latest changes..."
# git pull origin main

# 3. Install/Update dependencies
echo "📦 Installing dependencies..."
npm install

# 4. Register slash commands (optional, but recommended on changes)
echo "🔨 Deploying slash commands..."
npm run deploy

# 5. Restart the bot service using systemd
echo "🔄 Restarting the bot service..."
sudo systemctl restart discord-music-bot

echo "✅ Deployment complete!"
echo "Check status with: sudo systemctl status discord-music-bot"
echo "Check logs with:   sudo journalctl -u discord-music-bot -f"