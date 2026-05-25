<script lang="ts">
	type FieldType = 'text' | 'tel' | 'email' | 'textarea';

	let {
		id,
		label,
		type = 'text',
		value = $bindable(''),
		placeholder,
		required = false,
		rows = 3
	}: {
		id: string;
		label: string;
		type?: FieldType;
		value?: string;
		placeholder?: string;
		required?: boolean;
		rows?: number;
	} = $props();

	const fieldClass =
		'rounded-xl border border-strokes bg-pure-white px-4 py-3 text-sm text-text-black placeholder:text-text-muted focus:border-dark-green focus:outline-none';
</script>

<div class="flex flex-col gap-1.5">
	<label for={id} class="text-sm font-semibold text-text-black">
		{label}{#if required}&nbsp;*{/if}
	</label>
	{#if type === 'textarea'}
		<textarea {id} bind:value {placeholder} {rows} class="resize-none {fieldClass}"></textarea>
	{:else}
		<input {id} {type} bind:value {placeholder} class={fieldClass} />
	{/if}
</div>
