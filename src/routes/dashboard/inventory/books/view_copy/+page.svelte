<script lang="ts">
  import Layout from '$lib/components/ui/layout.svelte';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import ViewBookCopies from '$lib/components/ui/inventory/books/view_book_copies.svelte';

  let itemId: number | null = null;
  let itemTitle = '';

  onMount(() => {
    const params = $page.url.searchParams;
    const id = params.get('itemId') || params.get('id');
    itemId = id ? parseInt(id) : null;
    itemTitle = params.get('title') || '';
  });

  function goBack() {
    goto('/dashboard/inventory/books');
  }
</script>

<svelte:head>
  <title>Book Copies | E-Kalibro Admin Portal</title>
</svelte:head>

<Layout>
  <div class="p-4">
    <div class="max-w-6xl mx-auto">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <button type="button" on:click={goBack} class="p-2 rounded-md bg-white border hover:bg-gray-50">
            ← Back
          </button>
          <h1 class="text-xl font-semibold">Book Copies</h1>
          {#if itemTitle}
            <span class="text-sm text-gray-500">— {itemTitle}</span>
          {/if}
        </div>
      </div>

      {#if itemId}
        <ViewBookCopies isOpen={true} itemType="book" itemId={itemId} itemTitle={itemTitle} />
      {:else}
        <div class="p-6 bg-white rounded-lg border text-gray-600">No book selected. Please open this page with an <strong>itemId</strong> query parameter.</div>
      {/if}
    </div>
  </div>
</Layout>
