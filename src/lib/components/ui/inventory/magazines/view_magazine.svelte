<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let isOpen = false;
  export let isEditMode = false;
  export let magazine: {
    id: number; magazineId?: string; title: string; publisher?: string | null; issn?: string | null;
    volume?: string | null; issueNumber?: string | null; publishedDate?: string | null; language?: string | null;
    categoryId?: number | null; category?: string; location?: string | null; totalCopies?: number | null;
    availableCopies?: number | null; description?: string | null; coverImage?: string | null;
  } | null = null;

  const dispatch = createEventDispatcher();
  let submitting = false;
  let error = '';
  let form = { magazineId: '', title: '', publisher: '', issn: '', volume: '', issueNumber: '', publishedDate: '', language: 'English', categoryId: '', location: '', totalCopies: '' };

  $: if (isOpen && isEditMode && magazine) {
    form = {
      magazineId: magazine.magazineId ?? '', title: magazine.title ?? '', publisher: magazine.publisher ?? '',
      issn: magazine.issn ?? '', volume: magazine.volume ?? '', issueNumber: magazine.issueNumber ?? '',
      publishedDate: magazine.publishedDate?.slice(0, 10) ?? '', language: magazine.language ?? 'English',
      categoryId: String(magazine.categoryId ?? ''), location: magazine.location ?? '', totalCopies: String(magazine.totalCopies ?? 0)
    };
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!magazine) return;
    submitting = true;
    error = '';
    try {
      const response = await fetch('/api/inventory/magazines', {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: magazine.id, itemType: 'magazine', magazineId: form.magazineId.trim(), title: form.title.trim(),
          publisher: form.publisher.trim() || null, issn: form.issn.trim() || null, volume: form.volume.trim() || null,
          issueNumber: form.issueNumber.trim() || null, publishedDate: form.publishedDate || null,
          language: form.language || null, categoryId: form.categoryId ? Number(form.categoryId) : null,
          location: form.location.trim() || null
        })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Could not update magazine.');
      dispatch('save', result.data);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Network error. Please try again.';
    } finally {
      submitting = false;
    }
  }
</script>

{#if isOpen && magazine}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" on:click={(event) => event.target === event.currentTarget && dispatch('close')}>
    <section class="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-2xl">
      <header class="flex items-center justify-between border-b border-orange-200 bg-orange-50 px-5 py-4">
        <div><h2 class="text-xl font-semibold text-orange-950">{isEditMode ? 'Edit magazine' : magazine.title}</h2><p class="mt-1 text-sm text-orange-800">Magazine record and issue details</p></div>
        <button type="button" class="rounded p-2 text-orange-800 hover:bg-orange-100" aria-label="Close" on:click={() => dispatch('close')}>×</button>
      </header>

      {#if isEditMode}
        <form on:submit={save}>
          <div class="grid gap-4 p-5 sm:grid-cols-2">
            {#if error}<p class="sm:col-span-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>{/if}
            <label class="text-sm font-medium text-slate-700">Title *<input required bind:value={form.title} class="mt-1 w-full rounded border-slate-300 focus:border-orange-600 focus:ring-orange-600" /></label>
            <label class="text-sm font-medium text-slate-700">Publisher<input bind:value={form.publisher} class="mt-1 w-full rounded border-slate-300 focus:border-orange-600 focus:ring-orange-600" /></label>
            <label class="text-sm font-medium text-slate-700">Magazine ID<input bind:value={form.magazineId} class="mt-1 w-full rounded border-slate-300 focus:border-orange-600 focus:ring-orange-600" /></label>
            <label class="text-sm font-medium text-slate-700">ISSN<input bind:value={form.issn} class="mt-1 w-full rounded border-slate-300 focus:border-orange-600 focus:ring-orange-600" /></label>
            <label class="text-sm font-medium text-slate-700">Volume<input bind:value={form.volume} class="mt-1 w-full rounded border-slate-300 focus:border-orange-600 focus:ring-orange-600" /></label>
            <label class="text-sm font-medium text-slate-700">Issue number<input bind:value={form.issueNumber} class="mt-1 w-full rounded border-slate-300 focus:border-orange-600 focus:ring-orange-600" /></label>
            <label class="text-sm font-medium text-slate-700">Publication date<input type="date" bind:value={form.publishedDate} class="mt-1 w-full rounded border-slate-300 focus:border-orange-600 focus:ring-orange-600" /></label>
            <label class="text-sm font-medium text-slate-700">Language<input bind:value={form.language} class="mt-1 w-full rounded border-slate-300 focus:border-orange-600 focus:ring-orange-600" /></label>
            <label class="text-sm font-medium text-slate-700">Shelf location<input bind:value={form.location} class="mt-1 w-full rounded border-slate-300 focus:border-orange-600 focus:ring-orange-600" /></label>
          </div>
          <footer class="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
            <button type="button" on:click={() => dispatch('close')} class="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</button>
            <button type="submit" disabled={submitting} class="rounded bg-orange-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{submitting ? 'Saving…' : 'Save changes'}</button>
          </footer>
        </form>
      {:else}
        {#if magazine.coverImage}
          <div class="flex justify-center border-b border-slate-100 bg-slate-50 p-5">
            <img src={magazine.coverImage} alt={`${magazine.title} cover`} class="h-56 w-40 rounded-lg object-cover shadow-sm" />
          </div>
        {/if}
        <dl class="grid gap-x-8 gap-y-5 p-5 sm:grid-cols-2">
          <div><dt class="text-xs font-semibold uppercase text-slate-500">Magazine ID</dt><dd class="mt-1 text-sm text-slate-900">{magazine.magazineId || '—'}</dd></div>
          <div><dt class="text-xs font-semibold uppercase text-slate-500">ISSN</dt><dd class="mt-1 text-sm text-slate-900">{magazine.issn || '—'}</dd></div>
          <div><dt class="text-xs font-semibold uppercase text-slate-500">Publisher</dt><dd class="mt-1 text-sm text-slate-900">{magazine.publisher || '—'}</dd></div>
          <div><dt class="text-xs font-semibold uppercase text-slate-500">Category</dt><dd class="mt-1 text-sm text-slate-900">{magazine.category || '—'}</dd></div>
          <div><dt class="text-xs font-semibold uppercase text-slate-500">Volume / Issue</dt><dd class="mt-1 text-sm text-slate-900">{magazine.volume || '—'} / {magazine.issueNumber || '—'}</dd></div>
          <div><dt class="text-xs font-semibold uppercase text-slate-500">Publication date</dt><dd class="mt-1 text-sm text-slate-900">{magazine.publishedDate || '—'}</dd></div>
          <div><dt class="text-xs font-semibold uppercase text-slate-500">Language</dt><dd class="mt-1 text-sm text-slate-900">{magazine.language || '—'}</dd></div>
          <div><dt class="text-xs font-semibold uppercase text-slate-500">Shelf location</dt><dd class="mt-1 text-sm text-slate-900">{magazine.location || '—'}</dd></div>
          <div><dt class="text-xs font-semibold uppercase text-slate-500">Availability</dt><dd class="mt-1 text-sm text-slate-900">{magazine.availableCopies ?? 0} / {magazine.totalCopies ?? 0}</dd></div>
          {#if magazine.description}<div class="sm:col-span-2"><dt class="text-xs font-semibold uppercase text-slate-500">Description</dt><dd class="mt-1 text-sm text-slate-900">{magazine.description}</dd></div>{/if}
        </dl>
        <footer class="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" on:click={() => dispatch('close')} class="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700">Close</button>
          <button type="button" on:click={() => dispatch('edit')} class="rounded bg-orange-700 px-4 py-2 text-sm font-medium text-white">Edit magazine</button>
        </footer>
      {/if}
    </section>
  </div>
{/if}