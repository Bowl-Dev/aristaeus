<script lang="ts">
	type Size = 'sm' | 'md' | 'lg';
	type Tone = 'light' | 'dark';

	let {
		size = 'md',
		tone = 'dark'
	}: {
		size?: Size;
		tone?: Tone;
	} = $props();

	const sizes: Record<Size, string> = {
		sm: 'text-[24px] font-semibold tracking-[-0.6px]',
		md: 'text-2xl font-bold tracking-tight',
		lg: 'text-[60px] font-bold leading-none tracking-tight'
	};

	const tones: Record<Tone, string> = {
		light: 'text-pure-white',
		dark: 'text-text-black'
	};

	const cls = $derived(`m-0 ${sizes[size]} ${tones[tone]}`);

	const inlineStyle = $derived(size === 'sm' ? '' : 'letter-spacing: -0.02em;');
</script>

<span class={cls} style={inlineStyle}>alGramo.</span>
