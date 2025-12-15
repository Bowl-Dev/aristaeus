import { browser } from '$app/environment';
import { init, register, locale } from 'svelte-i18n';

// Register the translations
register('es', () => import('./es.json'));
register('en', () => import('./en.json'));

// Initialize i18n with Spanish as the default locale
init({
	fallbackLocale: 'es',
	initialLocale: browser ? (localStorage.getItem('locale') || 'es') : 'es'
});

// Function to change locale
export function setLocale(newLocale: string) {
	locale.set(newLocale);
	if (browser) {
		localStorage.setItem('locale', newLocale);
	}
}

export { locale };
