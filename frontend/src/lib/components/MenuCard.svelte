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

<div
	class="flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04)]"
>
	<!-- Image -->
	<div class="aspect-video w-full overflow-hidden bg-gray-100">
		<img src={imageUrl} alt={name} class="h-full w-full object-cover" />
	</div>

	<!-- Body -->
	<div class="flex flex-col gap-[0.625rem] px-4 pb-4 pt-[1.125rem]">
		<h3 class="m-0 text-base font-bold uppercase tracking-[0.03em] text-[#1a1a1a]">
			{name}
		</h3>
		<p class="m-0 text-sm leading-[1.45] text-[#555555]">{description}</p>

		<!-- Nutrition pills -->
		<div
			class="mx-auto flex w-fit flex-wrap items-start justify-center self-start rounded-md bg-[#1a1a1a] gap-[0.375rem]"
		>
			<div
				class="flex min-w-[3.25rem] flex-col items-center gap-[0.1rem] rounded-md px-2 py-[0.3rem] text-white"
			>
				<span
					class="text-[0.7rem] font-semibold uppercase leading-none tracking-[0.06em] text-white/70"
				>
					{$_('menu.card.calories')}
				</span>
				<span class="text-base font-bold leading-none text-white">{nutrition.calories}</span>
			</div>
			<div
				class="flex min-w-[3.25rem] flex-col items-center gap-[0.1rem] rounded-md px-2 py-[0.3rem] text-white"
			>
				<span
					class="text-[0.7rem] font-semibold uppercase leading-none tracking-[0.06em] text-white/70"
				>
					{$_('menu.card.protein')}
				</span>
				<span class="text-base font-bold leading-none text-white">{nutrition.protein}g</span>
			</div>
			<div
				class="flex min-w-[3.25rem] flex-col items-center gap-[0.1rem] rounded-md px-2 py-[0.3rem] text-white"
			>
				<span
					class="text-[0.7rem] font-semibold uppercase leading-none tracking-[0.06em] text-white/70"
				>
					{$_('menu.card.fat')}
				</span>
				<span class="text-base font-bold leading-none text-white">{nutrition.fat}g</span>
			</div>
			<div
				class="flex min-w-[3.25rem] flex-col items-center gap-[0.1rem] rounded-md px-2 py-[0.3rem] text-white"
			>
				<span
					class="text-[0.7rem] font-semibold uppercase leading-none tracking-[0.06em] text-white/70"
				>
					{$_('menu.card.carbs')}
				</span>
				<span class="text-base font-bold leading-none text-white">{nutrition.carbs}g</span>
			</div>
		</div>

		<button
			class="mt-1 w-full cursor-pointer rounded-full border-none bg-[#0d3b2e] px-4 py-[0.875rem] text-[0.8125rem] font-bold uppercase tracking-[0.08em] text-[#d4e84a] transition-all duration-200 hover:bg-[#0a2e23] active:scale-[0.98]"
			onclick={() => onCustomize(menu)}
		>
			{$_('menu.card.customize')}
		</button>
	</div>
</div>
