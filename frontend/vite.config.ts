// ponytail: package.json still carries gh-pages (deploys go to S3+CloudFront),
// autoprefixer and postcss (Tailwind 4 runs through @tailwindcss/vite, no postcss
// config in the repo) — three unused build deps, plus the dead `deploy:gh-pages`
// script. Drop them at the next dependency bump.
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()]
});
