import { get } from 'svelte/store';
import { locale } from 'svelte-i18n';

interface Localized {
	nameEs: string;
	nameEn: string;
}

function pickEnglish(currentLocale: string | null | undefined): boolean {
	return (currentLocale ?? 'es').toLowerCase().startsWith('en');
}

export function ingredientName(ing: Localized): string {
	return pickEnglish(get(locale)) ? ing.nameEn : ing.nameEs;
}

export function pickName(nameEs: string, nameEn: string): string {
	return pickEnglish(get(locale)) ? nameEn : nameEs;
}
