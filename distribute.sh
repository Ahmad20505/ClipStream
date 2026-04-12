#!/bin/bash
cd ~/Desktop/ClipStream
npm install
npx vite build
npx electron-builder --mac dmg
echo ""
echo "========================================"
echo "DMG ready for sharing!"
echo "Location: ~/Desktop/ClipStream/dist-electron/"
echo "========================================"
open dist-electron
