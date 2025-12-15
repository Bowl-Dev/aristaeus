import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			// GitHub Pages deployment settings
			pages: 'build',
			assets: 'build',
			fallback: 'index.html', // SPA fallback for client-side routing
			precompress: false,
			strict: true
		}),
		// Set the base path for GitHub Pages (update with your repo name)
		// For https://username.github.io/aristaeus/, use '/aristaeus'
		// For custom domain or root deployment, use ''
		paths: {
			base: process.env.BASE_PATH || ''
		},
		prerender: {
			handleHttpError: ({ path, message }) => {
				// Ignore missing favicon errors
				if (path === '/favicon.png') {
					return;
				}
				throw new Error(message);
			}
		}
	}
};

export default config;
