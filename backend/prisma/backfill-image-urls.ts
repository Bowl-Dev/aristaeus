/**
 * Backfill imageUrl on Menu + Ingredient rows to point at the S3 assets bucket.
 *
 * Non-destructive: only UPDATEs imageUrl, leaving orders/robots and all other
 * data untouched (unlike the full seed scripts, which delete + recreate).
 *
 * URL derivation mirrors prisma/seed.ts so the keys line up with the objects
 * uploaded to s3://aristaeus-assets (see ENG-62 / ENG-68).
 *
 * Run against the hosted DB:
 *   cd backend && dotenv -e .env.hosted -- npx tsx prisma/backfill-image-urls.ts
 * or:
 *   DATABASE_URL=... npx tsx prisma/backfill-image-urls.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ASSETS_BASE_URL = 'https://aristaeus-assets.s3.us-east-1.amazonaws.com';

function toSlug(name: string): string {
	return name
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.trim()
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9-]/g, '');
}

function ingredientImageUrl(englishName: string): string {
	return `${ASSETS_BASE_URL}/ingredients/${toSlug(englishName)}.jpg`;
}

// Canonical menu image filenames, keyed by nameEs (mirrors seed.ts).
const MENU_IMAGE_FILES: Record<string, string> = {
	'Bueno, bonito y al gramo': 'bueno-bonito.png',
	'Hoy empiezo la dieta': 'hoy-dieta.png',
	'Alto en proteína': 'alto-proteina.png',
	'Verde y sabroso': 'verde-sabroso.png',
	'Premium de Salmón': 'premium-salmon.png',
	Clásico: 'clasico.jpg',
	Casero: 'casero.jpg',
	'Proteico básico': 'proteico-basico.jpg'
};

function menuImageUrl(nameEs: string): string | null {
	const file = MENU_IMAGE_FILES[nameEs];
	return file ? `${ASSETS_BASE_URL}/menus/${file}` : null;
}

async function main() {
	console.log('Backfilling imageUrl values...\n');

	const ingredients = await prisma.ingredient.findMany({ select: { id: true, name: true } });
	let ingredientUpdates = 0;
	for (const ing of ingredients) {
		const url = ingredientImageUrl(ing.name);
		await prisma.ingredient.update({ where: { id: ing.id }, data: { imageUrl: url } });
		console.log(`  ingredient ${ing.name} -> ${url}`);
		ingredientUpdates++;
	}

	const menus = await prisma.menu.findMany({ select: { id: true, nameEs: true } });
	let menuUpdates = 0;
	let menuMisses = 0;
	for (const menu of menus) {
		const url = menuImageUrl(menu.nameEs);
		await prisma.menu.update({ where: { id: menu.id }, data: { imageUrl: url } });
		if (url) {
			console.log(`  menu ${menu.nameEs} -> ${url}`);
			menuUpdates++;
		} else {
			console.warn(`  menu ${menu.nameEs} -> (no image mapping, set null)`);
			menuMisses++;
		}
	}

	console.log(
		`\nDone. ${ingredientUpdates} ingredients, ${menuUpdates} menus updated` +
			(menuMisses ? `, ${menuMisses} menus had no mapping` : '') +
			'.'
	);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
