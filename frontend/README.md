# Aristaeus Frontend

SvelteKit-based frontend for the Aristaeus automated bowl kitchen system.

## Development

```bash
# From the monorepo root
npm install                    # Install all dependencies
npm run dev                    # Start dev server (http://localhost:5173)
```

## Linting & Formatting

This project uses ESLint and Prettier for code quality. Pre-commit hooks automatically run linting on staged files.

```bash
# From the monorepo root
npm run lint                   # Run ESLint
npm run lint:fix               # Run ESLint with auto-fix
npm run format                 # Format with Prettier
npm run format:check           # Check formatting
```

## Building

```bash
npm run build                  # Build for production (GitHub Pages)
npm run preview                # Preview production build
```

## Type Checking

```bash
npm run check                  # Run svelte-check
npm run check:watch            # Run svelte-check in watch mode
```

## Environment Variables

Create `frontend/.env` for local development:

```bash
VITE_API_URL=http://localhost:3000   # Backend API URL
BASE_PATH=/aristaeus                  # For GitHub Pages deployment
```

## Tech Stack

- SvelteKit 2.0 with adapter-static
- Svelte 5 (using runes: `$state`, `$derived`, `$effect`)
- TypeScript
- svelte-i18n for internationalization
