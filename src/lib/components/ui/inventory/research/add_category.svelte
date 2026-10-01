<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { toast } from '$lib/stores/toastStore.js';

  export let isOpen = false;
  const dispatch = createEventDispatcher();
  let name = '';
  let description = '';
  let error = '';
  let saving = false;

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) {
      error = 'Category name is required.';
      toast.warning(error);
      return;
    }
    saving = true;
    error = '';
    try {
      const response = await fetch('/api/inventory/research/categories', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Could not add category.');
      dispatch('success', result.data);
      toast.success('Research category added.');
      name = ''; description = ''; dispatch('close');
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Network error. Please try again.';
      dispatch('error', { message: error });
      toast.error(error);
    } finally { saving = false; }
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="presentation">
    <form class="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl" onsubmit={submit}>
      <header class="flex items-center justify-between bg-gradient-to-r from-[#0D5C29] to-[#4A7C59] px-6 py-4 text-white">
        <div><h2 class="text-lg font-bold">Add Research Category</h2><p class="text-xs text-white/80">Organize thesis and research records</p></div>
        <button type="button" aria-label="Close" onclick={() => dispatch('close')} class="rounded-lg p-2 hover:bg-white/15">×</button>
      </header>
      <div class="space-y-4 p-6">
        {#if error}<p class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>{/if}
        <label>Category name *<input required maxlength="100" bind:value={name} /></label>
        <label>Description<textarea rows="3" maxlength="255" bind:value={description}></textarea></label>
      </div>
      <footer class="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
        <button type="button" onclick={() => dispatch('close')} class="rounded-lg border border-gray-300 px-4 py-2 text-sm">Cancel</button>
        <button type="submit" disabled={saving} class="rounded-lg bg-[#0D5C29] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Adding…' : 'Add Category'}</button>
      </footer>
    </form>
  </div>
{/if}

<style>
  label { display: block; color: #475569; font-size: .875rem; font-weight: 600; }
  input, textarea { display: block; margin-top: .375rem; width: 100%; border: 1px solid #cbd5e1; border-radius: .5rem; padding: .625rem .75rem; font-weight: 400; outline: none; }
  input:focus, textarea:focus { border-color: #0D5C29; box-shadow: 0 0 0 2px rgb(13 92 41 / .15); }
</style>
