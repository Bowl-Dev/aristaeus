import { browser } from '$app/environment';
import { init, register, locale, waitLocale } from 'svelte-i18n';

// Register the translations
register('es', () => import('./es.json'));
register('en', () => import('./en.json'));

// Get initial locale
const getInitialLocale = () => {
	if (browser) {
		return localStorage.getItem('locale') || 'es';
	}
	return 'es';
};

// Initialize i18n with Spanish as the default locale
init({
	fallbackLocale: 'es',
	initialLocale: getInitialLocale()
});

// Wait for locale to load (used in layout)
export const waitForLocale = () => waitLocale();

// Function to change locale
export function setLocale(newLocale: string) {
	locale.set(newLocale);
	if (browser) {
		localStorage.setItem('locale', newLocale);
	}
}

export { locale };
