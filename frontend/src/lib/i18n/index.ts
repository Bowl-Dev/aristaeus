import { browser } from '$app/environment';
import { init, register, locale, waitLocale } from 'svelte-i18n';

// Register the translations
register('es', () => import('./es.json'));
register('en', () => import('./en.json'));

// Get initial locale.
// Spanish is the default, because the store serves Colombia. The browser language
// does not select the locale. A browser set to English gave an English page to a
// Colombian customer, and the store page has no locale toggle to correct it.
// Only an explicit choice, held in localStorage, changes the locale.
// Caution: localStorage belongs to one origin. A domain change drops every stored
// choice, and each customer returns to Spanish.
const getInitialLocale = () => {
	if (!browser) return 'es';
	const stored = localStorage.getItem('locale');
	if (stored === 'es' || stored === 'en') return stored;
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
