#!/bin/bash
cd ~/Desktop/ClipStream
npm install
npx vite build
npx electron-builder --mac dir
ditto dist-electron/mac-arm64/ClipStream.app /Applications/ClipStream.app
xattr -cr /Applications/ClipStream.app
echo DONE - App installed locally
