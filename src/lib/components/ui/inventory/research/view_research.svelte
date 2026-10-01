<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { handleResearchAuthorKeydown } from '$lib/utils/researchAuthors.js';

  export let isOpen = false;
  export let isEditMode = false;
  export let book: Record<string, any> | null = null;
  export let categories: { id: number; name: string }[] = [];
  const dispatch = createEventDispatcher();

  let form = {
    thesisId: '', title: '', author: '', advisor: '', department: '',
    publicationYear: '', categoryId: '', location: '', abstract: ''
  };

  $: if (isOpen && isEditMode && book) {
    form = {
      thesisId: book.bookId || '',
      title: book.title || '',
      author: book.author || '',
      advisor: book.advisor || '',
      department: book.department || '',
      publicationYear: String(book.publishedYear || ''),
      categoryId: String(book.categoryId || ''),
      location: book.location || '',
      abstract: book.description || ''
    };
  }

  function save(event: SubmitEvent) {
    event.preventDefault();
    dispatch('save', {
      id: book?.id,
      thesisId: form.thesisId.trim(),
      title: form.title.trim(),
      author: form.author.trim(),
      advisor: form.advisor.trim(),
      department: form.department.trim(),
      publicationYear: Number(form.publicationYear),
      categoryId: Number(form.categoryId),
      location: form.location.trim(),
      abstract: form.abstract.trim()
    });
  }
</script>

{#if isOpen && book}
  <div class="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-4" role="presentation">
    <div class="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl">
      <header class="flex items-center justify-between bg-gradient-to-r from-[#0D5C29] to-[#4A7C59] px-6 py-4 text-white">
        <div><p class="text-xs uppercase tracking-wide text-white/70">Research record</p><h2 class="text-xl font-bold">{book.title || 'Research details'}</h2></div>
        <button type="button" aria-label="Close" onclick={() => dispatch('close')} class="rounded-lg p-2 hover:bg-white/15">×</button>
      </header>
      {#if isEditMode}
        <form onsubmit={save}>
          <div class="grid gap-4 p-6 sm:grid-cols-2">
            <label class="text-sm font-medium text-slate-700">Title *<input required bind:value={form.title} class="mt-1 w-full rounded border-slate-300" /></label>
            <label class="text-sm font-medium text-slate-700">Authors *<input required maxlength="200" placeholder="Separate names with semicolons or press Enter" onkeydown={handleResearchAuthorKeydown} bind:value={form.author} class="mt-1 w-full rounded border-slate-300" /></label>
            <label class="text-sm font-medium text-slate-700">Research ID<input bind:value={form.thesisId} class="mt-1 w-full rounded border-slate-300" /></label>
            <label class="text-sm font-medium text-slate-700">Publication year *<input required type="number" bind:value={form.publicationYear} class="mt-1 w-full rounded border-slate-300" /></label>
            <label class="text-sm font-medium text-slate-700">Advisor<input bind:value={form.advisor} class="mt-1 w-full rounded border-slate-300" /></label>
            <label class="text-sm font-medium text-slate-700">Department<input bind:value={form.department} class="mt-1 w-full rounded border-slate-300" /></label>
            <label class="text-sm font-medium text-slate-700">Category *
              <select required bind:value={form.categoryId} class="mt-1 w-full rounded border-slate-300">
                <option value="">Select category</option>
                {#each categories as category}
                  <option value={category.id}>{category.name}</option>
                {/each}
              </select>
            </label>
            <label class="text-sm font-medium text-slate-700">Location<input bind:value={form.location} class="mt-1 w-full rounded border-slate-300" /></label>
            <label class="text-sm font-medium text-slate-700 sm:col-span-2">Abstract<textarea bind:value={form.abstract} rows="4" class="mt-1 w-full rounded border-slate-300"></textarea></label>
          </div>
          <footer class="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button type="button" onclick={() => dispatch('close')} class="rounded-lg border border-gray-300 px-4 py-2 text-sm">Cancel</button>
            <button type="submit" class="rounded-lg bg-[#0D5C29] px-5 py-2 text-sm font-semibold text-white">Save changes</button>
          </footer>
        </form>
      {:else}
        <div class="grid gap-4 p-6 sm:grid-cols-2">
          <div><p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Authors</p><p class="mt-1 text-sm text-slate-800">{book.author || 'Not specified'}</p></div>
          <div><p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Research ID</p><p class="mt-1 text-sm text-slate-800">{book.bookId || 'Generated'}</p></div>
          <div><p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Publication year</p><p class="mt-1 text-sm text-slate-800">{book.publishedYear || 'Not specified'}</p></div>
          <div><p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Copies</p><p class="mt-1 text-sm text-slate-800">{book.totalCopies || book.copiesAvailable || 0}</p></div>
          <div class="sm:col-span-2"><p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Description</p><p class="mt-1 whitespace-pre-wrap text-sm text-slate-700">{book.description || 'No abstract provided.'}</p></div>
        </div>
        <footer class="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button type="button" onclick={() => dispatch('close')} class="rounded-lg border border-gray-300 px-4 py-2 text-sm">Close</button>
          <button type="button" onclick={() => dispatch('edit')} class="rounded-lg bg-[#0D5C29] px-5 py-2 text-sm font-semibold text-white">Edit Research</button>
        </footer>
      {/if}
    </div>
  </div>
{/if}
