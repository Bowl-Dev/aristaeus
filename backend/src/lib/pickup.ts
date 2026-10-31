const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC-5, no DST

/** Next weekday after today in Bogotá, as YYYY-MM-DD: Mon–Thu → tomorrow, Fri/Sat/Sun → Monday. Holidays ignored. */
export function nextPickupDate(now: Date): string {
	const bogota = new Date(now.getTime() - BOGOTA_OFFSET_MS);
	const day = bogota.getUTCDay();
	const days = day === 5 ? 3 : day === 6 ? 2 : 1;
	bogota.setUTCDate(bogota.getUTCDate() + days);
	return bogota.toISOString().slice(0, 10);
}

/** A @db.Date column comes back as UTC midnight. */
export const toDateString = (date: Date) => date.toISOString().slice(0, 10);
