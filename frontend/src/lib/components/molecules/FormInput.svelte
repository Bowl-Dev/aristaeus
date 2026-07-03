<script lang="ts">
	type FieldType = 'text' | 'tel' | 'email' | 'numeric' | 'textarea';

	let {
		id,
		label,
		type = 'text',
		value = $bindable(''),
		placeholder,
		required = false,
		rows = 3,
		error
	}: {
		id: string;
		label: string;
		type?: FieldType;
		value?: string;
		placeholder?: string;
		required?: boolean;
		rows?: number;
		error?: string;
	} = $props();

	const fieldClass =
		'rounded-xl border bg-pure-white px-4 py-3 text-sm text-text-black placeholder:text-text-muted focus:outline-none';

	const borderClass = $derived(
		error ? 'border-red-500 focus:border-red-500' : 'border-strokes focus:border-dark-green'
	);

	// Numeric fields accept digits only, capped at 10 (Colombian mobile length).
	// Filter on input so the constraint holds for typing and paste alike, and drop
	// a pasted +57 country code (e.g. "+57 300 123 4567" → "3001234567").
	function onNumericInput(e: Event & { currentTarget: HTMLInputElement }) {
		let digits = e.currentTarget.value.replace(/\D/g, '');
		if (digits.length > 10 && digits.startsWith('57')) digits = digits.slice(2);
		value = digits.slice(0, 10);
	}
</script>

<div class="flex flex-col gap-1.5">
	<label for={id} class="text-sm font-semibold text-text-black">
		{label}{#if required}&nbsp;*{/if}
	</label>
	{#if type === 'textarea'}
		<textarea
			{id}
			bind:value
			{placeholder}
			{rows}
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={error ? `${id}-error` : undefined}
			class="resize-none {fieldClass} {borderClass}"
		></textarea>
	{:else if type === 'numeric'}
		<input
			{id}
			type="tel"
			inputmode="numeric"
			pattern="[0-9]*"
			maxlength={10}
			{value}
			oninput={onNumericInput}
			{placeholder}
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={error ? `${id}-error` : undefined}
			class="{fieldClass} {borderClass}"
		/>
	{:else}
		<input
			{id}
			{type}
			bind:value
			{placeholder}
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={error ? `${id}-error` : undefined}
			class="{fieldClass} {borderClass}"
		/>
	{/if}
	{#if error}
		<p id="{id}-error" class="m-0 text-xs text-red-500">{error}</p>
	{/if}
</div>
