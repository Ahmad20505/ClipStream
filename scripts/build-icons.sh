#!/bin/bash
# Run this ONCE on your Mac to generate the .icns file.
# Requires macOS (uses the built-in iconutil tool).
set -e
cd "$(dirname "$0")/.."
iconutil -c icns assets/icon.iconset -o assets/icon.icns
echo "✅ assets/icon.icns created!"
