#!/bin/bash

# Deploy script for Dingplan Construction Planner
echo "🚀 Starting deployment process..."

# Step 1: Build the project with production optimizations
echo "📦 Building the project..."
npm run build

# Check if build succeeded
if [ $? -ne 0 ]; then
  echo "❌ Build failed. Aborting deployment."
  exit 1
fi

echo "✅ Build successful!"

# Step 2: Commit changes
echo "📝 Committing changes..."
git add .
git commit -m "Performance optimization: improved render loop and culling"

# Step 3: Push to GitHub
echo "📤 Pushing to GitHub..."
git push origin master

# Step 4: Vercel deployment happens automatically
echo "🎉 Pushed to GitHub. Vercel deployment will start automatically."
echo "   Monitor deployment at: https://vercel.com/realworldbuilder/dingplan/deployments"

echo "✨ Deployment process completed successfully!" 