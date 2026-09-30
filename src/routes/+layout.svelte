<script lang="ts">
	import '../app.css';
	import { fly } from 'svelte/transition';
	import { setupToast } from '$lib/stores/setupToastStore.js';
	
	let { children } = $props();
</script>

{@render children()}
{#if $setupToast}
	<div
		class="fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] items-start gap-3 rounded-md border border-green-200 bg-white p-4 shadow-lg"
		role="status"
		aria-live="polite"
		transition:fly={{ y: -12, duration: 220 }}
	>
		<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700" aria-hidden="true">
			<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="m5 12 4 4L19 6" />
			</svg>
		</div>
		<div class="min-w-0 flex-1">
			<p class="font-semibold text-gray-900">Administrator account created</p>
			<p class="mt-1 break-words text-sm text-gray-600">{$setupToast}</p>
		</div>
		<button
			type="button"
			class="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
			aria-label="Dismiss notification"
			onclick={() => setupToast.dismiss()}
		>
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
				<path stroke-linecap="round" stroke-linejoin="round" d="m18 6-12 12M6 6l12 12" />
			</svg>
		</button>
	</div>
{/if}
