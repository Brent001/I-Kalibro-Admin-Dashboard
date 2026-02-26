<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';

  export let isOpen: boolean = false;
  export let itemType: string = 'journal';

  let newCategoryName = "";
  let newCategoryDescription = "";
  let categoryError = "";
  let categoryLoading = false;
  // Category list for display
  let categories: { id: number; name: string; description: string }[] = [];
  let categoriesLoading = false;

  const dispatch = createEventDispatcher();

  // Fetch category list from API (filtered by item type)
  $: capitalizedItemType = itemType && itemType.length ? itemType.charAt(0).toUpperCase() + itemType.slice(1) : 'Item';

  async function fetchCategories() {
    categoriesLoading = true;
    try {
      const response = await fetch(`/api/inventory/books/categories?itemType=${encodeURIComponent(itemType)}`, {
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
    resetEdit();
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
      const response = await fetch('/api/inventory/books/categories', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          description: newCategoryDescription.trim(),
          itemType: itemType
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

  let editingCategoryId: number | null = null;
  let editCategoryName = "";
  let editCategoryDescription = "";
  let editError = "";
  let editLoading = false;
  let deleteLoadingId: number | null = null;
  // Edit category
  function startEditCategory(cat: { id: number; name: string; description: string }) {
    editingCategoryId = cat.id;
    editCategoryName = cat.name;
    editCategoryDescription = cat.description || "";
    editError = "";
  }

  function cancelEditCategory() {
    resetEdit();
  }

  function resetEdit() {
    editingCategoryId = null;
    editCategoryName = "";
    editCategoryDescription = "";
    editError = "";
    editLoading = false;
  }

  // Update category
  async function saveEditCategory() {
    if (!editCategoryName.trim()) {
      editError = "Category name is required.";
      return;
    }
    if (editCategoryName.length > 50) {
      editError = "Category name must be at most 50 characters.";
      return;
    }
    if (editCategoryDescription.length > 255) {
      editError = "Description must be at most 255 characters.";
      return;
    }
    editLoading = true;
    editError = "";
    try {
      const response = await fetch('/api/inventory/books/categories', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCategoryId,
          name: editCategoryName.trim(),
          description: editCategoryDescription.trim(),
          itemType: itemType
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        resetEdit();
        fetchCategories();
      } else {
        editError = data.message || "Failed to update category.";
      }
    } catch (err) {
      editError = "Network error. Please try again.";
    } finally {
      editLoading = false;
    }
  }

  // Delete category
  async function deleteCategory(id: number) {
    if (!confirm("Are you sure you want to delete this category?")) return;
    deleteLoadingId = id;
    try {
      const response = await fetch('/api/inventory/books/categories', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, itemType })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        fetchCategories();
        // If editing deleted category, reset edit
        if (editingCategoryId === id) resetEdit();
      } else {
        alert(data.message || "Failed to delete category.");
      }
    } catch (err) {
      alert("Network error. Please try again.");
    } finally {
      deleteLoadingId = null;
    }
  }

  function handleClose() {
    newCategoryName = "";
    newCategoryDescription = "";
    categoryError = "";
    categoryLoading = false;
    resetEdit();
    dispatch('close');
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div 
      class="fixed inset-0 bg-black/50 backdrop-blur-sm transition-all duration-300" 
      on:click={categoryLoading ? null : handleClose}
      role="button"
      tabindex="-1"
    ></div>
    
    <div class="relative w-full max-w-4xl max-h-[90vh] transform transition-all duration-300 scale-100">
      <div class="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-[#4A7C59]/30 overflow-hidden flex flex-col max-h-[90vh]">
        <form on:submit|preventDefault={addCategory} class="flex flex-col h-full">
          <div class="px-6 py-4 border-b border-[#4A7C59]/20 bg-white/80 flex-shrink-0">
            <div class="flex items-start sm:items-center justify-between gap-3">
              <div class="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                <div class="flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-[#0D5C29] to-[#4A7C59] shadow-lg flex-shrink-0">
                  <svg class="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
                  </svg>
                </div>
                
                <div class="min-w-0 flex-1">
                  <h3 class="text-lg sm:text-xl font-bold text-[#0D5C29] truncate">Manage Categories</h3>
                  <p class="text-xs sm:text-sm text-[#4A7C59] hidden sm:block">Create and organize your {capitalizedItemType} categories</p>
                </div>
              </div>
              <button 
                type="button" 
                on:click={handleClose} 
                disabled={categoryLoading}
                class="p-2 rounded-lg text-gray-400 hover:text-[#0D5C29] hover:bg-[#0D5C29]/10 transition-colors duration-200 disabled:opacity-50 flex-shrink-0"
              >
                <svg class="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
          
          <div class="px-6 py-6 max-h-[60vh] overflow-y-auto flex-1 custom-scrollbar">
            <div class="space-y-4 sm:space-y-6">
              <div class="bg-[#f8faf9] border-2 border-dashed border-[#4A7C59]/30 rounded-xl p-4 sm:p-5">
                <div class="flex items-center gap-2 mb-4">
                  <svg class="h-5 w-5 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <h4 class="text-base sm:text-lg font-semibold text-[#0D5C29]">Add New Category</h4>
                </div>
                
                <div class="space-y-3 sm:space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Category Name *</label>
                    <input
                      type="text"
                      bind:value={newCategoryName}
                      maxlength="50"
                      class="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-50 bg-white text-sm sm:text-base"
                      placeholder="e.g. Science Fiction"
                      disabled={categoryLoading}
                    />
                    <div class="text-xs text-gray-500 mt-1.5">{newCategoryName.length}/50 characters</div>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Description (optional)</label>
                    <textarea
                      bind:value={newCategoryDescription}
                      maxlength="255"
                      class="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-50 bg-white text-sm sm:text-base"
                      rows="2"
                      placeholder="Brief description of the category"
                      disabled={categoryLoading}
                    ></textarea>
                    <div class="text-xs text-gray-500 mt-1.5">{newCategoryDescription.length}/255 characters</div>
                  </div>
                  {#if categoryError}
                    <div class="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
                      <svg class="h-5 w-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      <span>{categoryError}</span>
                    </div>
                  {/if}
                </div>
              </div>

              <div>
                <div class="flex items-center justify-between mb-3 sm:mb-4">
                  <div class="flex items-center gap-2">
                    <svg class="h-5 w-5 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
                    </svg>
                    <h4 class="text-base sm:text-lg font-semibold text-[#0D5C29]">Existing Categories</h4>
                  </div>
                  <span class="text-xs sm:text-sm text-[#0D5C29] bg-[#E8B923]/20 px-2.5 py-1 rounded-full font-medium">{categories.length} total</span>
                </div>
                
                {#if categoriesLoading}
                  <div class="flex items-center justify-center py-8 sm:py-12">
                    <svg class="animate-spin h-8 w-8 text-[#0D5C29]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                {:else if categories.length === 0}
                  <div class="text-center py-8 sm:py-12 bg-gray-50 rounded-xl border border-gray-200">
                    <svg class="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    <p class="text-gray-500 text-sm sm:text-base">No categories found</p>
                    <p class="text-gray-400 text-xs sm:text-sm mt-1">Add your first category above</p>
                  </div>
                {:else}
                  <div class="space-y-2 sm:space-y-3">
                    {#each categories as cat}
                      <div class="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-md hover:border-[#E8B923]/50 transition-all duration-200 group">
                        {#if editingCategoryId === cat.id}
                          <div class="space-y-3">
                             <div>
                              <input
                                type="text"
                                bind:value={editCategoryName}
                                maxlength="50"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] text-sm sm:text-base"
                                placeholder="Category name"
                                disabled={editLoading}
                              />
                            </div>
                            <div>
                              <textarea
                                bind:value={editCategoryDescription}
                                maxlength="255"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] text-sm sm:text-base"
                                rows="2"
                                placeholder="Description"
                                disabled={editLoading}
                              ></textarea>
                             </div>
                            {#if editError}
                              <div class="flex items-start gap-2 text-red-600 text-xs sm:text-sm bg-red-50 border border-red-200 rounded-lg p-2">
                                <svg class="h-4 w-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                                <span>{editError}</span>
                              </div>
                            {/if}
                            <div class="flex flex-col sm:flex-row gap-2">
                              <button 
                                type="button" 
                                class="flex-1 px-4 py-2 rounded-lg bg-[#0D5C29] text-white text-sm font-medium hover:bg-[#0A4520] disabled:opacity-50 transition-colors duration-200 flex items-center justify-center gap-2" 
                                on:click={saveEditCategory} 
                                disabled={editLoading}
                              >
                                {#if editLoading}
                                  <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Saving...
                                {:else}
                                  <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                                  </svg>
                                  Save Changes
                                {/if}
                              </button>
                              <button 
                                type="button" 
                                class="flex-1 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors duration-200 flex items-center justify-center gap-2" 
                                on:click={cancelEditCategory} 
                                disabled={editLoading}
                              >
                                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                                Cancel
                              </button>
                            </div>
                          </div>
                        {:else}
                          <div class="flex items-start gap-3">
                            <div class="flex-1 min-w-0">
                              <h5 class="font-semibold text-[#0D5C29] text-sm sm:text-base truncate group-hover:text-[#B8860B] transition-colors">{cat.name}</h5>
                              {#if cat.description}
                                <p class="text-gray-600 text-xs sm:text-sm mt-1 line-clamp-2">{cat.description}</p>
                              {/if}
                            </div>
                            <div class="flex gap-1.5 flex-shrink-0">
                              <button 
                                type="button" 
                                class="p-2 rounded-lg text-[#0D5C29] bg-[#E8B923]/10 hover:bg-[#E8B923]/30 transition-colors duration-200 disabled:opacity-50" 
                                on:click={() => startEditCategory(cat)} 
                                disabled={categoryLoading || deleteLoadingId === cat.id}
                                title="Edit category"
                              >
                                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                </svg>
                              </button>
                              <button 
                                type="button" 
                                class="p-2 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-colors duration-200 disabled:opacity-50" 
                                on:click={() => deleteCategory(cat.id)} 
                                disabled={categoryLoading || deleteLoadingId === cat.id}
                                title="Delete category"
                              >
                                {#if deleteLoadingId === cat.id}
                                  <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                {:else}
                                  <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                  </svg>
                                {/if}
                              </button>
                            </div>
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          </div>
          
          <div class="px-6 py-4 border-t border-[#4A7C59]/20 bg-white/80 flex flex-col sm:flex-row-reverse gap-3 flex-shrink-0">
            <button 
              type="button" 
              on:click={handleClose} 
              disabled={categoryLoading}
              class="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg border border-gray-300 bg-white text-sm sm:text-base font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={categoryLoading}
              class="w-full sm:w-auto sm:ml-auto px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg bg-gradient-to-r from-[#0D5C29] to-[#4A7C59] text-sm sm:text-base font-semibold text-white hover:from-[#0A4520] hover:to-[#3D664A] shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {#if categoryLoading}
                <svg class="animate-spin h-4 w-4 sm:h-5 sm:w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Adding...
              {:else}
                <svg class="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Add Category
              {/if}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}

<style>
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(74, 124, 89, 0.3);
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(74, 124, 89, 0.5);
  }
  
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>