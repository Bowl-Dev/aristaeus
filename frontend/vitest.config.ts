import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
	plugins: [svelte({ hot: !process.env.VITEST })],
	test: {
		globals: true,
		environment: 'jsdom',
		include: ['src/**/*.test.ts'],
		exclude: ['node_modules'],
		coverage: {
			provider: 'v8',
			include: ['src/lib/**'],
			exclude: ['src/**/*.test.ts']
		},
		setupFiles: ['./src/test/setup.ts']
	},
	resolve: {
		alias: {
			$lib: '/src/lib',
			$app: '/node_modules/@sveltejs/kit/src/runtime/app'
		}
	}
});
