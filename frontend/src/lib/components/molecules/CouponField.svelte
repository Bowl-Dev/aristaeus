<script lang="ts">
	import { _ } from 'svelte-i18n';

	let {
		value = $bindable(''),
		pending = false,
		success,
		error,
		onApply,
		onEdit
	}: {
		value?: string;
		pending?: boolean;
		/** Shown with a check mark once the server accepted the code. */
		success?: string;
		error?: string;
		onApply: () => void;
		/** Fires on every edit, after `value` is updated. */
		onEdit?: () => void;
	} = $props();

	const canApply = $derived(value.trim().length > 0 && !pending);

	function onInput(e: Event & { currentTarget: HTMLInputElement }) {
		value = e.currentTarget.value.toUpperCase();
		onEdit?.();
	}
</script>

<div class="flex flex-col gap-1.5">
	<label for="delivery-coupon" class="text-sm font-semibold text-text-black">
		{$_('coupon.label')}
	</label>
	<div class="flex gap-2">
		<input
			id="delivery-coupon"
			type="text"
			autocomplete="off"
			autocapitalize="characters"
			spellcheck="false"
			{value}
			oninput={onInput}
			onkeydown={(e) => e.key === 'Enter' && canApply && onApply()}
			placeholder={$_('coupon.placeholder')}
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={error || success ? 'delivery-coupon-status' : undefined}
			class="min-w-0 flex-1 rounded-xl border bg-pure-white px-4 py-3 text-sm uppercase text-text-black placeholder:text-text-muted focus:outline-none {error
				? 'border-red-500'
				: value
					? 'border-dark-green'
					: 'border-strokes focus:border-dark-green'}"
		/>
		<button
			type="button"
			disabled={!canApply}
			onclick={onApply}
			class="cursor-pointer rounded-xl border-none bg-dark-green px-5 text-xs font-bold uppercase tracking-[0.08em] text-light-green transition-all duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
		>
			{pending ? $_('coupon.applying') : $_('coupon.apply')}
		</button>
	</div>
	{#if success}
		<p
			id="delivery-coupon-status"
			class="m-0 flex items-center gap-1 text-xs font-semibold text-dark-green"
		>
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="3"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<polyline points="20 6 9 17 4 12" />
			</svg>
			{success}
		</p>
	{:else if error}
		<p id="delivery-coupon-status" class="m-0 text-xs text-red-500">{error}</p>
	{/if}
</div>
