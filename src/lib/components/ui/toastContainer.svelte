<script lang="ts">
  import { fly } from 'svelte/transition';
  import * as Lucide from 'lucide-svelte';
  import { toast } from '$lib/stores/toastStore.js';

  const Icons: any = Lucide;

  const styleByType = {
    success: 'border-emerald-200 bg-white text-emerald-900',
    error: 'border-rose-200 bg-white text-rose-900',
    warning: 'border-amber-200 bg-white text-amber-900',
    info: 'border-sky-200 bg-white text-sky-900'
  };

  const iconStyleByType = {
    success: 'text-emerald-600',
    error: 'text-rose-600',
    warning: 'text-amber-600',
    info: 'text-sky-600'
  };

  const titleByType = {
    success: 'Success',
    error: 'Something went wrong',
    warning: 'Check this',
    info: 'Notice'
  };
</script>

<div class="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3" aria-live="polite" aria-relevant="additions removals">
  {#each $toast as item (item.id)}
    <div
      class="pointer-events-auto flex items-start gap-3 rounded-md border p-4 shadow-lg {styleByType[item.type]}"
      role={item.type === 'error' ? 'alert' : 'status'}
      transition:fly={{ y: -10, duration: 180 }}
    >
      <div class="mt-0.5 shrink-0 {iconStyleByType[item.type]}" aria-hidden="true">
        {#if item.type === 'success'}
          <svelte:component this={Icons.CircleCheckBig} size={20} />
        {:else if item.type === 'error'}
          <svelte:component this={Icons.CircleAlert} size={20} />
        {:else if item.type === 'warning'}
          <svelte:component this={Icons.TriangleAlert} size={20} />
        {:else}
          <svelte:component this={Icons.Info} size={20} />
        {/if}
      </div>
      <div class="min-w-0 flex-1">
        <p class="font-semibold">{item.title || titleByType[item.type]}</p>
        <p class="mt-1 break-words text-sm text-gray-600">{item.message}</p>
      </div>
      <button
        type="button"
        class="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
        aria-label="Dismiss toast"
        onclick={() => toast.dismiss(item.id)}
      >
        <svelte:component this={Icons.X} size={16} aria-hidden="true" />
      </button>
    </div>
  {/each}
</div>
