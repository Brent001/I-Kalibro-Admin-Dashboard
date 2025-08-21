<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';

  export let isOpen: boolean = false;

  let newCategoryName = "";
  let newCategoryDescription = "";
  let categoryError = "";
  let categoryLoading = false;

  // Category list for display
  let categories: { id: number; name: string; description: string }[] = [];
  let categoriesLoading = false;

  const dispatch = createEventDispatcher();

  // Fetch category list from API
  async function fetchCategories() {
    categoriesLoading = true;
    try {
      const response = await fetch('/api/books/categories', {
        method: 'GET',
        credentials: 'include'
      });
      const data = await response.json();
      if (response.ok && data.success) {
        categories = data.data.categories;
      } else {
        categories = [];
      }
    } catch (err) {
      categories = [];
    } finally {
      categoriesLoading = false;
    }
  }

  // Fetch categories when modal opens
  $: if (isOpen) {
    fetchCategories();
  }

  async function addCategory() {
    if (!newCategoryName.trim()) {
      categoryError = "Category name is required.";
      return;
    }
    if (newCategoryName.length > 50) {
      categoryError = "Category name must be at most 50 characters.";
      return;
    }
    if (newCategoryDescription.length > 255) {
      categoryError = "Description must be at most 255 characters.";
      return;
    }
    categoryLoading = true;
    categoryError = "";
    try {
      const response = await fetch('/api/books/categories', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          description: newCategoryDescription.trim()
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        dispatch('success', { category: data.data?.category, message: data.message });
        handleClose();
        fetchCategories(); // Refresh list after adding
      } else {
        categoryError = data.message || "Failed to add category.";
        dispatch('error', { message: categoryError });
      }
    } catch (err) {
      categoryError = "Network error. Please try again.";
      dispatch('error', { message: categoryError });
    } finally {
      categoryLoading = false;
    }
  }

  function handleClose() {
    newCategoryName = "";
    newCategoryDescription = "";
    categoryError = "";
    categoryLoading = false;
    dispatch('close');
  }
</script>

{#if isOpen}
  <!-- Modal Backdrop with Blur Effect -->
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Blurred Background Overlay -->
    <div 
      class="fixed inset-0 bg-black/50 backdrop-blur-sm transition-all duration-300" 
      on:click={categoryLoading ? null : handleClose}
      role="button"
      tabindex="-1"
    ></div>
    
    <!-- Modal Container -->
    <div class="relative w-full max-w-md max-h-[90vh] transform transition-all duration-300 scale-100">
      <!-- Modal Panel - Floating Card -->
      <div class="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200/50 overflow-hidden">
        <form on:submit|preventDefault={addCategory}>
          <!-- Header -->
          <div class="px-6 py-4 border-b border-slate-200/50 bg-white/80">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <div class="flex items-center justify-center h-10 w-10 rounded-xl bg-slate-900 shadow-lg">
                  <svg class="h-5 w-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                  </svg>
                </div>
                <div>
                  <h3 class="text-xl font-bold text-slate-900">Add Category</h3>
                  <p class="text-sm text-slate-600">Create a new book category for your library</p>
                </div>
              </div>
              <button 
                type="button" 
                on:click={handleClose} 
                disabled={categoryLoading}
                class="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100/50 transition-colors duration-200 disabled:opacity-50"
              >
                <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
          
          <!-- Form Content with Scroll -->
          <div class="px-6 py-6 max-h-[60vh] overflow-y-auto">
            <div class="space-y-6">
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  bind:value={newCategoryName}
                  maxlength="50"
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 disabled:opacity-50 disabled:bg-slate-100 border-slate-300 bg-white/50"
                  placeholder="e.g. Science"
                  disabled={categoryLoading}
                />
                <div class="text-xs text-slate-400 mt-1">{newCategoryName.length}/50</div>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
                <textarea
                  bind:value={newCategoryDescription}
                  maxlength="255"
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 disabled:opacity-50 disabled:bg-slate-100 border-slate-300 bg-white/50"
                  rows="2"
                  placeholder="Short description"
                  disabled={categoryLoading}
                ></textarea>
                <div class="text-xs text-slate-400 mt-1">{newCategoryDescription.length}/255</div>
              </div>
              {#if categoryError}
                <div class="text-red-600 text-sm mb-2">{categoryError}</div>
              {/if}
              <div class="mt-6">
                <h4 class="text-sm font-semibold mb-2">Existing Categories</h4>
                {#if categoriesLoading}
                  <div class="text-slate-400 text-sm">Loading...</div>
                {:else if categories.length === 0}
                  <div class="text-slate-400 text-sm">No categories found.</div>
                {:else}
                  <ul class="space-y-1">
                    {#each categories as cat}
                      <li class="text-slate-700 text-sm">
                        <span class="font-medium">{cat.name}</span>
                        {#if cat.description}
                          <span class="text-slate-400"> - {cat.description}</span>
                        {/if}
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>
            </div>
          </div>
          
          <!-- Footer -->
          <div class="px-6 py-4 border-t border-slate-200/50 bg-white/80 flex flex-col sm:flex-row-reverse gap-3">
            <button 
              type="submit" 
              disabled={categoryLoading}
              class="flex-1 sm:flex-initial sm:min-w-[120px] inline-flex justify-center items-center rounded-xl border border-transparent shadow-lg px-6 py-3 bg-slate-900 text-base font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-900"
            >
              {#if categoryLoading}
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Adding Category...
              {:else}
                <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                </svg>
                Add Category
              {/if}
            </button>
            <button 
              type="button" 
              on:click={handleClose} 
              disabled={categoryLoading}
              class="flex-1 sm:flex-initial sm:min-w-[120px] inline-flex justify-center items-center rounded-xl border border-slate-300 shadow-sm px-6 py-3 bg-white/80 text-base font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}

<style>
  .overflow-y-auto::-webkit-scrollbar {
    width: 6px;
  }
  .overflow-y-auto::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 10px;
  }
  .overflow-y-auto::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 10px;
  }
  .overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.3);
  }
</style>