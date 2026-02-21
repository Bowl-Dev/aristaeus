#!/bin/bash
# Build script for Lambda deployment
# Creates a ZIP file with bundled code and Prisma client

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$BACKEND_DIR")"
DIST_DIR="$BACKEND_DIR/dist"
BUILD_DIR="$DIST_DIR/lambda-build"

echo "Building Lambda package..."
echo "Backend dir: $BACKEND_DIR"
echo "Root dir: $ROOT_DIR"

# Clean previous builds
rm -rf "$DIST_DIR"
mkdir -p "$BUILD_DIR/handlers"

# Generate Prisma client if not exists
echo "Generating Prisma client..."
cd "$ROOT_DIR"
npm run db:generate

# Use esbuild to bundle each handler file
echo "Bundling handlers with esbuild..."
cd "$BACKEND_DIR"

# Bundle each handler file separately (keeps the export structure)
npx esbuild \
  src/handlers/ingredients.ts \
  src/handlers/orders.ts \
  src/handlers/robots.ts \
  src/handlers/users.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --outdir="$BUILD_DIR/handlers" \
  --format=cjs \
  --outbase=src/handlers \
  --external:@prisma/client

# Copy Prisma client and schema
echo "Copying Prisma client..."
mkdir -p "$BUILD_DIR/node_modules/@prisma"
mkdir -p "$BUILD_DIR/node_modules/.prisma"
mkdir -p "$BUILD_DIR/prisma"

# Copy the Prisma client
cp -r "$ROOT_DIR/node_modules/@prisma/client" "$BUILD_DIR/node_modules/@prisma/"
cp -r "$ROOT_DIR/node_modules/.prisma" "$BUILD_DIR/node_modules/"

# Copy only the rhel binary for Lambda (remove native binary to save space)
echo "Optimizing Prisma binaries for Lambda..."
find "$BUILD_DIR/node_modules/.prisma" -name "libquery_engine-*" ! -name "*rhel*" -type f -delete 2>/dev/null || true
find "$BUILD_DIR/node_modules/@prisma" -name "libquery_engine-*" ! -name "*rhel*" -type f -delete 2>/dev/null || true

# Copy Prisma schema (needed by Prisma client)
cp "$BACKEND_DIR/prisma/schema.prisma" "$BUILD_DIR/prisma/"

# Create the ZIP file
echo "Creating ZIP archive..."
cd "$BUILD_DIR"
zip -rq "$DIST_DIR/lambda.zip" . -x "*.DS_Store" -x "__MACOSX/*"

# Print size info
echo ""
echo "Build complete!"
ls -lh "$DIST_DIR/lambda.zip"
echo ""
echo "ZIP contents (first 40 lines):"
unzip -l "$DIST_DIR/lambda.zip" | head -40
