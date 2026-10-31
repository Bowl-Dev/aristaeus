// The x-admin-token the admin pages share, remembered in localStorage.
const TOKEN_KEY = 'aristaeus.adminToken';

export function readToken(): string {
	try {
		return localStorage.getItem(TOKEN_KEY) ?? '';
	} catch {
		return '';
	}
}

export function saveToken(value: string) {
	try {
		if (value) localStorage.setItem(TOKEN_KEY, value);
		else localStorage.removeItem(TOKEN_KEY);
	} catch {
		// Storage blocked: the token just lives for this page view.
	}
}
