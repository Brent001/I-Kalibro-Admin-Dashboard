<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import AddBooks from "$lib/components/ui/inventory/books/add_books.svelte";
  import AddCategory from "$lib/components/ui/inventory/books/add_category.svelte";
  import ViewBook from "$lib/components/ui/inventory/books/view_book.svelte";

  let searchTerm = "";
  let committedSearchTerm = ""; // For active filters display - only set on Enter
  let selectedCategory = "all";
  let selectedLanguage = "";
  let categoryDropdownOpen = false;
  let languageDropdownOpen = false;
  let showAddModal = false;
  let showAddCategoryModal = false;
  let loading = false;
  let error = "";

  // Get initial values from URL
  $: initialPage = browser ? parseInt($page.url.searchParams.get('page') || '1') : 1;
  $: initialSearch = browser ? $page.url.searchParams.get('q') || '' : '';
  $: initialCategory = browser ? $page.url.searchParams.get('category') || 'all' : 'all';
  $: initialLanguage = browser ? ($page.url.searchParams.get('lang') || $page.url.searchParams.get('language') || '') : '';

  // Set initial values only once on mount
  let initialized = false;
  $: if (browser && !initialized) {
    searchTerm = initialSearch;
    committedSearchTerm = initialSearch;
    selectedCategory = initialCategory;
    selectedLanguage = initialLanguage;
    initialized = true;
  }

  // API response types
  interface ApiMagazine {
    id: number;
    magazineId?: string;
    title: string;
    publisher?: string;
    publishedYear?: number;
    copiesAvailable?: number;
    categoryId?: number;
    category?: string;
    language?: string;
    originPlace?: string;
    description?: string;
  }

  interface Magazine {
    id: number;
    title: string;
    publisher?: string;
    publishedYear?: number;
    copiesAvailable?: number;
    categoryId?: number;
    copies?: number;
    available?: number;
    published?: string;
    status?: string;
    category?: string;
  }

  interface ApiResponse {
    success: boolean;
    data: {
      magazines: ApiMagazine[];
      pagination: {
        currentPage: number;
        totalPages: number;
        totalCount: number;
        limit: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
      };
    };
    message?: string;
  }

  let magazines: Magazine[] = [];
  let pagination = {
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 10,
    hasNextPage: false,
    hasPrevPage: false
  };

  // React to URL parameter changes - only on initial load or explicit navigation
  $: if (browser && initialPage) {
    fetchMagazines(initialPage, initialSearch, initialCategory, initialLanguage);
  }

  // Categories - fetch from API
  let categories: { id: number, name: string }[] = [];
  let categoryMap: Record<number, string> = {};

  // Languages - fetch from API
  let languages: string[] = [];

  let stats = {
    totalMagazines: 0,
    availableCopies: 0,
    borrowedMagazines: 0,
    categoriesCount: 0
  };

  // Function to fetch magazines from API (uses books endpoint with itemType=magazine)
  async function fetchMagazines(page = 1, search = "", category = "", language = "") {
    if (!browser) return;
    loading = true;
    error = "";
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '20');
      if (search) params.set('q', search);
      if (category && category !== 'all') {
        // Try to map category name to ID when possible
        const cat = categories.find(c => c && c.name === category);
        if (cat && cat.id) {
          params.set('categoryId', String(cat.id));
        } else {
          // fallback: send name — server will try to resolve
          params.set('category', category);
        }
      }
      if (language) params.set('lang', language);
      const response = await fetch(`/api/inventory/magazines?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/';
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: ApiResponse = await response.json();
      if (data.success) {
        magazines = data.data.magazines.map((m: ApiMagazine) => {
          const copies = parseInt(m.copiesAvailable?.toString() || '0', 10);
          return {
            ...m,
            copiesAvailable: copies,
            copies: copies,
            available: copies,
            published: m.publishedYear?.toString() || 'Unknown',
            status: copies > 5 ? 'Available' : copies > 0 ? 'Limited' : 'Unavailable',
            category: m.categoryId !== undefined ? categoryMap[m.categoryId] || m.category || 'General' : m.category || 'General'
          } as Magazine;
        });
        pagination = data.data.pagination;
      } else {
        throw new Error(data.message || 'Failed to fetch magazines');
      }
    } catch (err) {
      console.error('Error fetching magazines:', err);
      error = err instanceof Error ? err.message : 'An error occurred while fetching magazines';
      magazines = [];
    } finally {
      loading = false;
    }
  }

  // Debounced search function - auto-searches after delay, commits on Enter
  function debouncedSearch(immediate = false) {
    if (immediate) {
      committedSearchTerm = searchTerm.trim();
      performSearch();
    }
  }

  // Function to perform search with URL update (for Enter key and filter changes)
  async function performSearch() {
    const params = new URLSearchParams();
    params.set('page', '1');
    if (committedSearchTerm) params.set('q', committedSearchTerm);
    if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory);
    if (selectedLanguage.trim()) params.set('lang', selectedLanguage.trim());

    const queryString = params.toString();
    await goto(`/dashboard/magazines${queryString ? '?' + queryString : ''}`);
  }

  // Load initial data on component mount
  onMount(async () => {
    await Promise.all([
      fetchCategories(),
      fetchLanguages(),
      fetchStats()
    ]);
  });

  // Close dropdowns when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.category-dropdown')) {
      categoryDropdownOpen = false;
    }
    if (!target.closest('.language-dropdown')) {
      languageDropdownOpen = false;
    }
  }

  // Add click outside listener
  $: if (browser) {
    if (categoryDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
    } else {
      document.removeEventListener('click', handleClickOutside);
    }
  }

  // Function to fetch categories from API
  async function fetchCategories() {
    if (!browser) return;
    try {
      // request the magazines-specific categories via books endpoint
      const response = await fetch('/api/inventory/magazines/categories', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          categories = data.data.categories;
          // Build categoryMap for ID -> name lookup
          categoryMap = {};
          for (const cat of categories) {
            if (cat && cat.id && cat.name) {
              categoryMap[cat.id] = cat.name;
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  }

  // Function to fetch languages from API
  async function fetchLanguages() {
    if (!browser) return;
    try {
      const response = await fetch('/api/books/languages', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          languages = data.data.languages;
        }
      }
    } catch (err) {
      console.error('Error fetching languages:', err);
    }
  }

  // Function to fetch statistics from API
  async function fetchStats() {
    if (!browser) return;
    
    try {
      const response = await fetch('/api/books/stats?itemType=magazine', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          stats = data.data;
        }
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }

  // Function to delete a magazine
  async function deleteMagazine(magazineId: number, magazineTitle: string) {
    if (!confirm(`Are you sure you want to delete "${magazineTitle}"?`)) {
      return;
    }

    try {
      const response = await fetch('/api/inventory/magazines', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: magazineId, itemType: 'magazine' })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        // Refresh data with current pagination and filters
        await Promise.all([
          fetchMagazines(pagination.currentPage, committedSearchTerm, selectedCategory, selectedLanguage),
          fetchStats()
        ]);
      } else {
        throw new Error(data.message || 'Failed to delete magazine');
      }
    } catch (err) {
      console.error('Error deleting magazine:', err);
      error = err instanceof Error ? err.message : 'An error occurred while deleting the magazine';
    }
  }

  // Event handlers for the modal
  function handleAddMagazineSuccess(event: CustomEvent) {
    console.log('Magazine added successfully:', event.detail);
    // Refresh the list and stats, go to first page
    goto('/dashboard/magazines?page=1');
    fetchStats();
  }

  function handleAddMagazineError(event: CustomEvent) {
    console.error('Error adding magazine:', event.detail);
    error = event.detail.message;
  }

  function handleModalClose() {
    showAddModal = false;
  }

  // Category management
  let newCategoryName = "";
  let newCategoryDescription = "";
  let categoryError = "";
  let categoryLoading = false;

  async function addCategory() {
    if (!newCategoryName.trim()) {
      categoryError = "Category name is required.";
      return;
    }
    categoryLoading = true;
    categoryError = "";
    try {
      const response = await fetch('/api/inventory/magazines/categories', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          description: newCategoryDescription.trim(),
          itemType: 'magazine'
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        showAddCategoryModal = false;
        newCategoryName = "";
        newCategoryDescription = "";
        await fetchCategories();
      } else {
        categoryError = data.message || "Failed to add category.";
      }
    } catch (err) {
      categoryError = "Network error. Please try again.";
    } finally {
      categoryLoading = false;
    }
  }

  // Utility function for status color
  function getStatusColor(status: string) {
    switch (status) {
      case 'Available':
        return 'bg-green-100 text-green-600';
      case 'Limited':
        return 'bg-amber-100 text-amber-600';
      case 'Unavailable':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  }

  // Pagination handlers
  function goToPage(page: number) {
    if (page >= 1 && page <= pagination.totalPages) {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      if (committedSearchTerm) params.set('q', committedSearchTerm);
      if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory);
      if (selectedLanguage.trim()) params.set('lang', selectedLanguage.trim());
      
      const queryString = params.toString();
      goto(`/dashboard/magazines${queryString ? '?' + queryString : ''}`);
    }
  }

  function nextPage() {
    if (pagination.hasNextPage) {
      goToPage(pagination.currentPage + 1);
    }
  }

  function prevPage() {
    if (pagination.hasPrevPage) {
      goToPage(pagination.currentPage - 1);
    }
  }

  function handleAddCategorySuccess() {
    showAddCategoryModal = false;
    fetchCategories();
  }
  function handleAddCategoryError(event: CustomEvent) {
    categoryError = event.detail.message;
  }
  function handleAddCategoryClose() {
    showAddCategoryModal = false;
  }

  let showViewMagazineModal = false;
  let showEditMagazineModal = false;
  let selectedMagazine: Magazine | null = null;

  function openViewMagazineModal(magazine: Magazine) {
    selectedMagazine = magazine;
    showViewMagazineModal = true;
    showEditMagazineModal = false;
  }

  function openEditMagazineModal(magazine: Magazine) {
    selectedMagazine = magazine;
    showEditMagazineModal = true;
    showViewMagazineModal = false;
  }

  function closeMagazineModal() {
    showViewMagazineModal = false;
    showEditMagazineModal = false;
    selectedMagazine = null;
  }

  function handleMagazineSave(event: CustomEvent) {
    (async () => {
      const updatedData = event.detail;
      try {
        const response = await fetch('/api/inventory/magazines', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedData)
        });
        const data = await response.json();
        if (response.ok && data.success) {
          closeMagazineModal();
          await Promise.all([
            fetchMagazines(pagination.currentPage, committedSearchTerm, selectedCategory, selectedLanguage),
            fetchStats()
          ]);
        } else {
          throw new Error(data.message || 'Failed to update magazine');
        }
      } catch (err) {
        console.error('Error updating magazine:', err);
        error = err instanceof Error ? err.message : 'An error occurred while updating the magazine';
      }
    })();
  }

  // Generate page numbers to display
  $: pageNumbers = (() => {
    const pages: (number | string)[] = [];
    const total = pagination.totalPages;
    const current = pagination.currentPage;
    const delta = 2; // pages to show around current

    // Always show first page
    if (1 < current - delta) {
      pages.push(1);
      if (2 < current - delta) pages.push('...');
    }

    // Show pages around current
    for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
      pages.push(i);
    }

    // Always show last page
    if (total > current + delta) {
      if (total - 1 > current + delta) pages.push('...');
      pages.push(total);
    }

    return pages;
  })();

  // Update category dropdown for filters
  $: categoryDropdownOptions = ['all', ...categories.filter(c => c && c.name).map(c => c.name)];

  // Function to check if any filters are active
  $: hasActiveFilters = committedSearchTerm.trim() !== '' || selectedCategory !== 'all' || selectedLanguage.trim() !== '';

  // Function to clear all filters
  function clearFilters() {
    searchTerm = '';
    committedSearchTerm = '';
    selectedCategory = 'all';
    selectedLanguage = '';
    performSearch();
  }
</script>

<svelte:head>
  <title>Magazines | E-Kalibro Admin Portal</title>
</svelte:head>

<div class="space-y-4">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">Magazine Management</h2>
        <p class="text-slate-600">Manage your library's magazine collection</p>
      </div>
      <div class="flex justify-center gap-2">
        <button
          on:click={() => showAddModal = true}
          class="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-600 transition-colors duration-200"
        >
          <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Add New Magazine
        </button>
        <button
          on:click={() => showAddCategoryModal = true}
          class="inline-flex items-center justify-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg text-slate-900 bg-white hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors duration-200"
        >
          <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Add Category
        </button>
      </div>
    </div>

    <!-- Error Message -->
    {#if error}
      <div class="bg-[#E8B923]/10 border border-[#E8B923] text-[#E8B923] px-4 py-3 rounded-lg">
        <div class="flex justify-between items-start">
          <div>
            <p class="font-medium">Error:</p>
            <p class="text-sm">{error}</p>
            <button 
              on:click={() => fetchMagazines()} 
              class="mt-2 text-sm text-red-800 hover:text-red-900 underline"
            >
              Try again
            </button>
          </div>
          <button 
            on:click={() => error = ""} 
            class="text-red-400 hover:text-red-600"
            aria-label="Close error message"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
    {/if}

    <!-- Stats Cards -->
    {#if loading && magazines.length === 0}
      <!-- Stats Skeleton -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {#each Array(4) as _, i}
          <div class="group relative bg-white rounded-xl shadow-sm border border-gray-200 p-3 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
            <div class="animate-pulse flex flex-col items-center">
              <div class="h-10 w-10 bg-gray-200 rounded-lg mb-3"></div>
              <div class="h-6 w-16 bg-gray-200 rounded mb-2"></div>
              <div class="h-3 w-20 bg-gray-200 rounded"></div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <!-- Stats Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div class="group relative bg-white rounded-xl shadow-sm border border-gray-200 p-3 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <div class="flex flex-col items-center text-center">
            <div class="p-2.5 rounded-lg mb-3 bg-gradient-to-br from-green-400 to-green-600 shadow-sm">
              <svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
              </svg>
            </div>
            <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Total Magazines</p>
            <p class="text-lg sm:text-xl font-bold text-gray-900">{stats.totalMagazines}</p>
          </div>
        </div>
        <div class="group relative bg-white rounded-xl shadow-sm border border-gray-200 p-3 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <div class="flex flex-col items-center text-center">
            <div class="p-2.5 rounded-lg mb-3 bg-gradient-to-br from-green-400 to-green-600 shadow-sm">
              <svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Available Copies</p>
            <p class="text-lg sm:text-xl font-bold text-gray-900">{stats.availableCopies}</p>
          </div>
        </div>
        <div class="group relative bg-white rounded-xl shadow-sm border border-gray-200 p-3 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <div class="flex flex-col items-center text-center">
            <div class="p-2.5 rounded-lg mb-3 bg-gradient-to-br from-amber-400 to-amber-600 shadow-sm">
              <svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4"/>
              </svg>
            </div>
            <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Borrowed</p>
            <p class="text-lg sm:text-xl font-bold text-gray-900">{stats.borrowedMagazines}</p>
          </div>
        </div>
        <div class="group relative bg-white rounded-xl shadow-sm border border-gray-200 p-3 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <div class="flex flex-col items-center text-center">
            <div class="p-2.5 rounded-lg mb-3 bg-gradient-to-br from-amber-400 to-amber-600 shadow-sm">
              <svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
              </svg>
            </div>
            <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Categories</p>
            <p class="text-lg sm:text-xl font-bold text-gray-900">{Math.max(0, stats.categoriesCount)}</p>
          </div>
        </div>
      </div>
    {/if}

    <!-- Active Filters Summary -->
    {#if hasActiveFilters}
      <div class="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="flex items-center text-blue-700">
              <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
              </svg>
              <span class="font-medium">Active Filters:</span>
            </div>
            <div class="flex flex-wrap gap-2">
              {#if committedSearchTerm}
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                  Search: "{committedSearchTerm}"
                  <button 
                    on:click={() => { searchTerm = ''; committedSearchTerm = ''; performSearch(); }}
                    class="ml-2 text-blue-600 hover:text-blue-800"
                    aria-label="Remove search filter"
                  >
                    <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </span>
              {/if}
              {#if selectedCategory !== 'all'}
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                  Category: {selectedCategory}
                  <button 
                    on:click={() => { selectedCategory = 'all'; performSearch(); }}
                    class="ml-2 text-blue-600 hover:text-blue-800"
                    aria-label="Remove category filter"
                  >
                    <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </span>
              {/if}
              {#if selectedLanguage}
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                  Language: {selectedLanguage}
                  <button 
                    on:click={() => { selectedLanguage = ''; performSearch(); }}
                    class="ml-2 text-blue-600 hover:text-blue-800"
                    aria-label="Remove language filter"
                  >
                    <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </span>
              {/if}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button 
              on:click={clearFilters}
              class="text-blue-600 hover:text-blue-800 text-sm font-medium underline"
            >
              Clear All
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Filters and Search -->
    <div class="bg-white p-4 lg:p-6 rounded-xl shadow-lg border border-slate-200">
      <div class="flex flex-col lg:flex-row gap-4">
        <div class="flex-1">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search by title, publisher, or ID..."
              bind:value={searchTerm}
              on:keydown={(e) => {
                if (e.key === 'Enter') {
                  debouncedSearch(true);
                }
              }}
              class="pl-10 pr-4 py-3 w-full border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors duration-200 {committedSearchTerm ? 'border-green-500 bg-green-50' : ''}"
              disabled={loading}
            />
            {#if loading}
              <div class="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div class="animate-spin rounded-full h-4 w-4 border-2 border-slate-300 border-t-slate-600"></div>
              </div>
            {/if}
            {#if committedSearchTerm}
              <div class="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center">
                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Active
                </span>
              </div>
            {/if}
          </div>
        </div>

        <div class="flex flex-col sm:flex-row gap-2">
          <div class="relative category-dropdown">
            <!-- Custom Category Dropdown -->
            <div class="relative">
              <button
                on:click={() => categoryDropdownOpen = !categoryDropdownOpen}
                class="px-4 py-3 w-full sm:w-48 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 bg-white text-slate-700 transition-colors duration-200 {selectedCategory !== 'all' ? 'border-green-500 bg-green-50' : ''} flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                <span class="truncate">
                  {selectedCategory === 'all' ? 'All Categories' : selectedCategory}
                </span>
                <svg 
                  class="h-4 w-4 ml-2 transition-transform duration-200 {categoryDropdownOpen ? 'rotate-180' : ''}" 
                  fill="none" 
                  stroke="currentColor" 
                  stroke-width="2" 
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>

              {#if categoryDropdownOpen}
                <div class="absolute z-10 mt-1 w-full sm:w-48 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  <button 
                    type="button"
                    on:click={() => { selectedCategory = 'all'; categoryDropdownOpen = false; performSearch(); }}
                    class="w-full text-left px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors duration-200 {selectedCategory === 'all' ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}"
                  >
                    All Categories
                  </button>
                  {#each categories.filter(c => c && c.name) as category}
                    <button 
                      type="button"
                      on:click={() => { selectedCategory = category.name; categoryDropdownOpen = false; performSearch(); }}
                      class="w-full text-left px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors duration-200 {selectedCategory === category.name ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}"
                    >
                      {category.name}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
            
            {#if selectedCategory !== 'all'}
              <div class="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center">
                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Active
                </span>
              </div>
            {/if}
          </div>

          <div class="relative language-dropdown">
            <!-- Custom Language Dropdown -->
            <div class="relative">
              <button
                on:click={() => languageDropdownOpen = !languageDropdownOpen}
                class="px-4 py-3 w-full sm:w-48 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 bg-white text-slate-700 transition-colors duration-200 {selectedLanguage ? 'border-green-500 bg-green-50' : ''} flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                <span class="truncate">
                  {selectedLanguage || 'All Languages'}
                </span>
                <svg 
                  class="h-4 w-4 ml-2 transition-transform duration-200 {languageDropdownOpen ? 'rotate-180' : ''}" 
                  fill="none" 
                  stroke="currentColor" 
                  stroke-width="2" 
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>

              {#if languageDropdownOpen}
                <div class="absolute z-10 mt-1 w-full sm:w-48 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  <button 
                    type="button"
                    on:click={() => { selectedLanguage = ''; languageDropdownOpen = false; performSearch(); }}
                    class="w-full text-left px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors duration-200 {!selectedLanguage ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}"
                  >
                    All Languages
                  </button>
                  {#each languages as language}
                    <button 
                      type="button"
                      on:click={() => { selectedLanguage = language; languageDropdownOpen = false; performSearch(); }}
                      class="w-full text-left px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors duration-200 {selectedLanguage === language ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}"
                    >
                      {language}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
            
            {#if selectedLanguage}
              <div class="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center">
                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Active
                </span>
              </div>
            {/if}
          </div>
          <button class="px-4 py-3 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center justify-center text-slate-700 transition-colors duration-200" disabled={loading}>
            <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M7 11l5 5 5-5"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v12"/>
            </svg>
            Export
          </button>
        </div>
      </div>
    </div>

    <!-- The rest of the UI mirrors the books page but shows magazines -->

    <!-- Add Magazine Modal -->
    <AddBooks
      isOpen={showAddModal}
      on:close={handleModalClose}
      on:success={handleAddMagazineSuccess}
      on:error={handleAddMagazineError}
      itemType={'magazine'}
    />

    <!-- Add Category Modal Component -->
    <AddCategory
      isOpen={showAddCategoryModal}
      on:success={handleAddCategorySuccess}
      on:error={handleAddCategoryError}
      on:close={handleAddCategoryClose}
      itemType={'magazine'}
    />

    <!-- Magazine View/Edit Modal -->
    {#if showViewMagazineModal || showEditMagazineModal}
      <ViewBook
        isOpen={showViewMagazineModal || showEditMagazineModal}
        book={selectedMagazine}
        itemType={'magazine'}
        isEditMode={showEditMagazineModal}
        on:close={closeMagazineModal}
        on:save={handleMagazineSave}
        on:edit={() => {
          showEditMagazineModal = true;
          showViewMagazineModal = false;
        }}
      />
    {/if}
  </div>
