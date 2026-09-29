<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let isOpen = false;
  export let isEditMode = false;
  export let journal: {
    id: number; journalId?: string; title: string; publisher?: string | null; issn?: string | null;
    volume?: string | null; issueNumber?: string | null; publishedDate?: string | null; language?: string | null;
    categoryId?: number | null; category?: string; location?: string | null; totalCopies?: number | null;
    availableCopies?: number | null; description?: string | null;
  } | null = null;

  const dispatch = createEventDispatcher();
  let submitting = false;
  let error = '';
  let form = { journalId: '', title: '', publisher: '', issn: '', volume: '', issueNumber: '', publishedDate: '', language: 'English', location: '', totalCopies: '' };

  $: if (isOpen && isEditMode && journal) {
    form = {
      journalId: journal.journalId ?? '', title: journal.title ?? '', publisher: journal.publisher ?? '',
      issn: journal.issn ?? '', volume: journal.volume ?? '', issueNumber: journal.issueNumber ?? '',
      publishedDate: journal.publishedDate?.slice(0, 10) ?? '', language: journal.language ?? 'English',
      location: journal.location ?? '', totalCopies: String(journal.totalCopies ?? 0)
    };
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!journal) return;
    submitting = true;
    error = '';
    try {
      const response = await fetch('/api/inventory/journals', {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: journal.id, itemType: 'journal', journalId: form.journalId.trim(), title: form.title.trim(),
          publisher: form.publisher.trim() || null, issn: form.issn.trim() || null, volume: form.volume.trim() || null,
          issueNumber: form.issueNumber.trim() || null, publishedDate: form.publishedDate || null,
          language: form.language || null, location: form.location.trim() || null
        })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Could not update journal.');
      dispatch('save', result.data);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Network error. Please try again.';
    } finally {
      submitting = false;
    }
  }
</script>

{#if isOpen && journal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" on:click={(event) => event.target === event.currentTarget && dispatch('close')}>
    <section class="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-2xl">
      <header class="flex items-center justify-between border-b border-sky-200 bg-sky-50 px-5 py-4">
        <div><h2 class="text-xl font-semibold text-sky-950">{isEditMode ? 'Edit journal' : journal.title}</h2><p class="mt-1 text-sm text-sky-800">Journal record and issue details</p></div>
        <button type="button" class="rounded p-2 text-sky-800 hover:bg-sky-100" aria-label="Close" on:click={() => dispatch('close')}>×</button>
      </header>
      {#if isEditMode}
        <form on:submit={save}>
          <div class="grid gap-4 p-5 sm:grid-cols-2">
            {#if error}<p class="sm:col-span-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>{/if}
            <label class="text-sm font-medium text-slate-700">Title *<input required bind:value={form.title} class="mt-1 w-full rounded border-slate-300 focus:border-sky-600 focus:ring-sky-600" /></label>
            <label class="text-sm font-medium text-slate-700">Publisher<input bind:value={form.publisher} class="mt-1 w-full rounded border-slate-300 focus:border-sky-600 focus:ring-sky-600" /></label>
            <label class="text-sm font-medium text-slate-700">Journal ID<input bind:value={form.journalId} class="mt-1 w-full rounded border-slate-300 focus:border-sky-600 focus:ring-sky-600" /></label>
            <label class="text-sm font-medium text-slate-700">ISSN<input bind:value={form.issn} class="mt-1 w-full rounded border-slate-300 focus:border-sky-600 focus:ring-sky-600" /></label>
            <label class="text-sm font-medium text-slate-700">Volume<input bind:value={form.volume} class="mt-1 w-full rounded border-slate-300 focus:border-sky-600 focus:ring-sky-600" /></label>
            <label class="text-sm font-medium text-slate-700">Issue number<input bind:value={form.issueNumber} class="mt-1 w-full rounded border-slate-300 focus:border-sky-600 focus:ring-sky-600" /></label>
            <label class="text-sm font-medium text-slate-700">Publication date<input type="date" bind:value={form.publishedDate} class="mt-1 w-full rounded border-slate-300 focus:border-sky-600 focus:ring-sky-600" /></label>
            <label class="text-sm font-medium text-slate-700">Language<input bind:value={form.language} class="mt-1 w-full rounded border-slate-300 focus:border-sky-600 focus:ring-sky-600" /></label>
            <label class="text-sm font-medium text-slate-700">Shelf location<input bind:value={form.location} class="mt-1 w-full rounded border-slate-300 focus:border-sky-600 focus:ring-sky-600" /></label>
          </div>
          <footer class="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
            <button type="button" on:click={() => dispatch('close')} class="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</button>
            <button type="submit" disabled={submitting} class="rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{submitting ? 'Saving…' : 'Save changes'}</button>
          </footer>
        </form>
      {:else}
        <dl class="grid gap-x-8 gap-y-5 p-5 sm:grid-cols-2">
          <div><dt class="text-xs font-semibold uppercase text-slate-500">Journal ID</dt><dd class="mt-1 text-sm text-slate-900">{journal.journalId || '—'}</dd></div>
          <div><dt class="text-xs font-semibold uppercase text-slate-500">ISSN</dt><dd class="mt-1 text-sm text-slate-900">{journal.issn || '—'}</dd></div>
          <div><dt class="text-xs font-semibold uppercase text-slate-500">Publisher</dt><dd class="mt-1 text-sm text-slate-900">{journal.publisher || '—'}</dd></div>
          <div><dt class="text-xs font-semibold uppercase text-slate-500">Category</dt><dd class="mt-1 text-sm text-slate-900">{journal.category || '—'}</dd></div>
          <div><dt class="text-xs font-semibold uppercase text-slate-500">Volume / Issue</dt><dd class="mt-1 text-sm text-slate-900">{journal.volume || '—'} / {journal.issueNumber || '—'}</dd></div>
          <div><dt class="text-xs font-semibold uppercase text-slate-500">Publication date</dt><dd class="mt-1 text-sm text-slate-900">{journal.publishedDate || '—'}</dd></div>
          <div><dt class="text-xs font-semibold uppercase text-slate-500">Language</dt><dd class="mt-1 text-sm text-slate-900">{journal.language || '—'}</dd></div>
          <div><dt class="text-xs font-semibold uppercase text-slate-500">Shelf location</dt><dd class="mt-1 text-sm text-slate-900">{journal.location || '—'}</dd></div>
          <div><dt class="text-xs font-semibold uppercase text-slate-500">Availability</dt><dd class="mt-1 text-sm text-slate-900">{journal.availableCopies ?? 0} / {journal.totalCopies ?? 0}</dd></div>
          {#if journal.description}<div class="sm:col-span-2"><dt class="text-xs font-semibold uppercase text-slate-500">Description</dt><dd class="mt-1 text-sm text-slate-900">{journal.description}</dd></div>{/if}
        </dl>
        <footer class="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" on:click={() => dispatch('close')} class="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700">Close</button>
          <button type="button" on:click={() => dispatch('edit')} class="rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white">Edit journal</button>
        </footer>
      {/if}
    </section>
  </div>
{/if}