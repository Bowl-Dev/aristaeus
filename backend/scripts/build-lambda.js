/**
 * Build script for Lambda deployment
 * Bundles handlers with esbuild and creates lambda.zip for Terraform
 */

import * as esbuild from 'esbuild';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, rmSync, cpSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const distDir = resolve(rootDir, 'dist');
const buildDir = resolve(distDir, 'build');

async function build() {
  console.log('🔨 Building Lambda functions...');

  // Clean and create dist directory
  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true });
  }
  mkdirSync(buildDir, { recursive: true });

  // Bundle handlers with esbuild
  await esbuild.build({
    entryPoints: [
      resolve(rootDir, 'src/handlers/ingredients.ts'),
      resolve(rootDir, 'src/handlers/orders.ts'),
      resolve(rootDir, 'src/handlers/robots.ts'),
    ],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outdir: resolve(buildDir, 'handlers'),
    format: 'cjs',
    external: ['@prisma/client'],
    sourcemap: true,
    minify: false,
  });

  // Copy Prisma client
  const prismaClientSrc = resolve(rootDir, 'node_modules/.prisma');
  const prismaClientDest = resolve(buildDir, 'node_modules/.prisma');
  if (existsSync(prismaClientSrc)) {
    mkdirSync(resolve(buildDir, 'node_modules'), { recursive: true });
    cpSync(prismaClientSrc, prismaClientDest, { recursive: true });
  }

  // Copy @prisma/client
  const prismaCoreSrc = resolve(rootDir, 'node_modules/@prisma/client');
  const prismaCoreDest = resolve(buildDir, 'node_modules/@prisma/client');
  if (existsSync(prismaCoreSrc)) {
    cpSync(prismaCoreSrc, prismaCoreDest, { recursive: true });
  }

  // Create zip file
  console.log('📦 Creating lambda.zip...');
  process.chdir(buildDir);
  execSync('zip -r ../lambda.zip .', { stdio: 'inherit' });

  console.log('✅ Build complete: dist/lambda.zip');
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
