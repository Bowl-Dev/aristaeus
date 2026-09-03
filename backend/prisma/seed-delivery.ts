/**
 * Seed the delivery observation pool.
 *
 * Loads the 20 past deliveries provided by Ops (previously hard-coded in
 * `frontend/src/lib/utils/deliveryModel.ts`) and geocodes each one exactly
 * once, so seed rows and operator corrections share a single coordinate basis.
 *
 * Rows that fail to geocode are still inserted, with null coordinates and
 * `match_tier = 'failed'`, and are reported at the end. They are excluded from
 * the fit but kept so the failure is visible rather than silent.
 *
 * Usage: npm run db:seed-delivery
 */

import { PrismaClient } from '@prisma/client';
import { parseAddress } from '../src/lib/delivery/address.js';
import { geocodeAddress, KITCHEN_ORIGIN } from '../src/lib/delivery/geocode.js';
import {
	SEED_OBSERVATIONS,
	seedAddressText,
	haversineLegs,
	fitDeliveryModel,
	looCvMae,
	type LegObservation
} from '../src/lib/delivery/model.js';

const prisma = new PrismaClient();

async function main() {
	console.log('Seeding delivery observations...\n');

	// Idempotent: only the seed rows are cleared, operator corrections survive.
	const removed = await prisma.deliveryObservation.deleteMany({ where: { source: 'seed' } });
	if (removed.count > 0) console.log(`Cleared ${removed.count} existing seed rows.\n`);

	const tiers = new Map<string, number>();
	const failures: string[] = [];
	const fitted: LegObservation[] = [];

	for (const seed of SEED_OBSERVATIONS) {
		const text = seedAddressText(seed);
		const address = parseAddress(text);

		if (!address) {
			failures.push(`${text} (unparseable)`);
			continue;
		}

		const { result: geocoded, searchTruncated } = await geocodeAddress(address);
		const legs = geocoded
			? haversineLegs(KITCHEN_ORIGIN, { lat: geocoded.lat, lng: geocoded.lng })
			: null;

		const tier = geocoded?.matchTier ?? 'failed';
		tiers.set(tier, (tiers.get(tier) ?? 0) + 1);
		if (!geocoded) {
			failures.push(`${text} ${searchTruncated ? '(lookup timed out)' : '(no cadastral match)'}`);
		}
		if (legs) fitted.push({ ...legs, actualCost: seed.actualCost, source: 'seed' });

		await prisma.deliveryObservation.create({
			data: {
				rawAddress: text,
				prefix: address.prefix,
				street: address.street,
				cross: address.cross,
				number: address.number,
				lat: geocoded?.lat ?? null,
				lng: geocoded?.lng ?? null,
				matchTier: tier,
				northKm: legs?.northKm ?? null,
				eastKm: legs?.eastKm ?? null,
				actualCost: seed.actualCost,
				source: 'seed'
			}
		});

		console.log(
			`  ${text.padEnd(24)} ${tier.padEnd(15)} ${(geocoded?.resolvedPlate ?? '-').padEnd(20)} ${seed.actualCost} COP`
		);
	}

	console.log('\nMatch tiers:');
	for (const [tier, count] of [...tiers.entries()].sort()) {
		console.log(`  ${tier.padEnd(16)} ${count}`);
	}

	if (failures.length > 0) {
		console.log('\nFailed to geocode (inserted with null coordinates, excluded from the fit):');
		for (const failure of failures) console.log(`  - ${failure}`);
	} else {
		console.log('\nAll seed observations geocoded successfully.');
	}

	console.log('\nFitted model:', fitDeliveryModel(fitted));
	console.log('Leave-one-out cross-validated MAE:', looCvMae(fitted), 'COP');
	console.log(`\nSeeded ${fitted.length}/${SEED_OBSERVATIONS.length} usable observations.`);
}

main()
	.catch((error) => {
		console.error('Delivery seed failed:', error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
