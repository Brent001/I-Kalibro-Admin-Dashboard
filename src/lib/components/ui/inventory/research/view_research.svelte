<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let isOpen = false;
  export let isEditMode = false;
  export let book: Record<string, any> | null = null;
  const dispatch = createEventDispatcher();
</script>

{#if isOpen && book}
  <div class="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-4" role="presentation">
    <div class="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl">
      <header class="flex items-center justify-between bg-gradient-to-r from-[#0D5C29] to-[#4A7C59] px-6 py-4 text-white">
        <div><p class="text-xs uppercase tracking-wide text-white/70">Research record</p><h2 class="text-xl font-bold">{book.title || 'Research details'}</h2></div>
        <button type="button" aria-label="Close" onclick={() => dispatch('close')} class="rounded-lg p-2 hover:bg-white/15">×</button>
      </header>
      <div class="grid gap-4 p-6 sm:grid-cols-2">
        <div><p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Author</p><p class="mt-1 text-sm text-slate-800">{book.author || 'Not specified'}</p></div>
        <div><p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Research ID</p><p class="mt-1 text-sm text-slate-800">{book.bookId || 'Generated'}</p></div>
        <div><p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Publication year</p><p class="mt-1 text-sm text-slate-800">{book.publishedYear || 'Not specified'}</p></div>
        <div><p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Copies</p><p class="mt-1 text-sm text-slate-800">{book.totalCopies || book.copiesAvailable || 0}</p></div>
        <div class="sm:col-span-2"><p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Description</p><p class="mt-1 whitespace-pre-wrap text-sm text-slate-700">{book.description || 'No abstract provided.'}</p></div>
      </div>
      <footer class="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
        <button type="button" onclick={() => dispatch('close')} class="rounded-lg border border-gray-300 px-4 py-2 text-sm">Close</button>
        {#if !isEditMode}<button type="button" onclick={() => dispatch('edit')} class="rounded-lg bg-[#0D5C29] px-5 py-2 text-sm font-semibold text-white">Edit Research</button>{/if}
      </footer>
    </div>
  </div>
{/if}
