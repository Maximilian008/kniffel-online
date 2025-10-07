#!/bin/bash
echo "Building for Netlify..."

# Copy shared packages to node_modules
echo "Setting up workspace dependencies..."
mkdir -p node_modules/@shared
mkdir -p node_modules/@game

# Copy shared lib
cp -r ../../packages/shared/src node_modules/@shared/lib
echo '{"main": "index.ts", "types": "index.ts"}' > node_modules/@shared/lib/package.json

# Copy game rules  
cp -r ../../packages/game-rules/src node_modules/@game/rules
echo '{"main": "index.ts", "types": "index.ts"}' > node_modules/@game/rules/package.json

echo "Dependencies copied, running build..."
npm run build