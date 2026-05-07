<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type { Menu } from '$lib/types';

	let {
		menu,
		locale,
		onCustomize
	}: {
		menu: Menu;
		locale: string;
		onCustomize: (menu: Menu) => void;
	} = $props();

	const name = $derived(locale === 'es' ? menu.nameEs : menu.nameEn);
	const description = $derived(locale === 'es' ? menu.descriptionEs : menu.descriptionEn);

	const menuImages: Record<string, string> = {
		'Bueno, bonito y al gramo': '/menu_imgs/BuenoBonito.png',
		'Hoy empiezo la dieta': '/menu_imgs/HoyDieta.png',
		'Alto en proteína': '/menu_imgs/AltoProteina.png',
		'Verde y sabroso': '/menu_imgs/IMG_1872.png',
		'Premium de Salmón': '/menu_imgs/PremiumSalmon.png'
	};

	const imageUrl = $derived(menuImages[menu.nameEs] ?? '/bowl_placeholder.png');

	const nutrition = $derived.by(() => {
		let calories = 0,
			protein = 0,
			fat = 0,
			carbs = 0;
		for (const item of menu.ingredients) {
			const mult = item.quantityGrams / 100;
			calories += item.caloriesPer100g * mult;
			protein += item.proteinGPer100g * mult;
			fat += item.fatGPer100g * mult;
			carbs += item.carbsGPer100g * mult;
		}
		return {
			calories: Math.round(calories),
			protein: Math.round(protein),
			fat: Math.round(fat),
			carbs: Math.round(carbs)
		};
	});
</script>

<div class="menu-card">
	<!-- Image -->
	<div class="card-image">
		<img src={imageUrl} alt={name} />
	</div>

	<!-- Body -->
	<div class="card-body">
		<h3 class="card-title">{name}</h3>
		<p class="card-description">{description}</p>

		<!-- Nutrition pills -->
		<div class="nutrition-row">
			<div class="nutrition-pill">
				<span class="pill-label">{$_('menu.card.calories')}</span>
				<span class="pill-value">{nutrition.calories}</span>
			</div>
			<div class="nutrition-pill">
				<span class="pill-label">{$_('menu.card.protein')}</span>
				<span class="pill-value">{nutrition.protein}g</span>
			</div>
			<div class="nutrition-pill">
				<span class="pill-label">{$_('menu.card.fat')}</span>
				<span class="pill-value">{nutrition.fat}g</span>
			</div>
			<div class="nutrition-pill">
				<span class="pill-label">{$_('menu.card.carbs')}</span>
				<span class="pill-value">{nutrition.carbs}g</span>
			</div>
		</div>

		<button class="customize-btn" onclick={() => onCustomize(menu)}>
			{$_('menu.card.customize')}
		</button>
	</div>
</div>

<style>
	.menu-card {
		background: #ffffff;
		border-radius: 1rem;
		overflow: hidden;
		box-shadow:
			0 1px 4px rgba(0, 0, 0, 0.06),
			0 2px 12px rgba(0, 0, 0, 0.04);
		display: flex;
		flex-direction: column;
	}

	.card-image {
		width: 100%;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		background: #f0f0f0;
	}

	.card-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.card-body {
		padding: 1.125rem 1rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.card-title {
		font-size: 1rem;
		font-weight: 700;
		color: #1a1a1a;
		margin: 0;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.card-description {
		font-size: 0.875rem;
		color: #555555;
		margin: 0;
		line-height: 1.45;
	}

	.nutrition-row {
		display: flex;
		justify-content: center;
		border-radius: 0.375rem;
		gap: 0.375rem;
		flex-wrap: wrap;
		background: #1a1a1a;
		align-self: flex-start;
		width: fit-content;
		margin: 0 auto;
	}

	.nutrition-pill {
		color: #ffffff;
		border-radius: 0.375rem;
		padding: 0.3rem 0.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.1rem;
		min-width: 3.25rem;
	}

	.pill-label {
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.7);
		line-height: 1;
	}

	.pill-value {
		font-size: 1rem;
		font-weight: 700;
		color: #ffffff;
		line-height: 1;
	}

	.customize-btn {
		margin-top: 0.25rem;
		background: #0d3b2e;
		color: #d4e84a;
		font-weight: 700;
		font-size: 0.8125rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 0.875rem 1rem;
		border-radius: 9999px;
		border: none;
		cursor: pointer;
		width: 100%;
		transition:
			background 0.2s,
			transform 0.1s;
	}

	.customize-btn:hover {
		background: #0a2e23;
	}

	.customize-btn:active {
		transform: scale(0.98);
	}
</style>
