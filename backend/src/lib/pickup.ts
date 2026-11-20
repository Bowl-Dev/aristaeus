import { bogotaTime } from '@aristaeus/shared';

/**
 * Pickup day in Bogotá, as YYYY-MM-DD. A weekday order before 09:30 is picked up today;
 * otherwise the next weekday (Mon–Thu → tomorrow, Fri/Sat/Sun → Monday). Holidays ignored.
 */
export function nextPickupDate(now: Date): string {
	const bogota = bogotaTime(now);
	const day = bogota.getUTCDay();
	const weekday = day >= 1 && day <= 5;
	const beforeCutoff = bogota.toISOString().slice(11, 16) < '09:30';
	const days = weekday && beforeCutoff ? 0 : day === 5 ? 3 : day === 6 ? 2 : 1;
	bogota.setUTCDate(bogota.getUTCDate() + days);
	return bogota.toISOString().slice(0, 10);
}

/** A @db.Date column comes back as UTC midnight. */
export const toDateString = (date: Date) => date.toISOString().slice(0, 10);
