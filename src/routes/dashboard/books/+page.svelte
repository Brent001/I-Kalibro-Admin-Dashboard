<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import AddBooks from "$lib/components/ui/add_books.svelte";
  import AddCategory from "$lib/components/ui/add_category.svelte";
  import ViewBook from "$lib/components/ui/view_book.svelte";

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
  interface ApiBook {
    id: number;
    bookId: string;
    title: string;
    author: string;
    publishedYear: number;
    copiesAvailable: number;
    categoryId?: number;
    category?: string;
    language?: string;
    originPlace?: string;
    publisher?: string;
    location?: string;
    description?: string;
  }

  interface Book {
    id: number;
    title: string;
    author: string;
    isbn: string;
    qrCode?: string;
    publishedYear: number;
    copiesAvailable: number;
    categoryId?: number;
    // Computed fields for display
    copies?: number;
    available?: number;
    published?: string;
    status?: string;
    category?: string;
  }

  interface ApiResponse {
    success: boolean;
    data: {
      books: ApiBook[];
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

  let books: Book[] = [];
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
    fetchBooks(initialPage, initialSearch, initialCategory, initialLanguage);
  }

  // Categories - fetch from API
  let categories: { id: number, name: string }[] = [];
  let categoryMap: Record<number, string> = {};

  // Languages - fetch from API
  let languages: string[] = [];

  let stats = {
    totalBooks: 0,
    availableCopies: 0,
    borrowedBooks: 0,
    categoriesCount: 0
  };

  // Function to fetch books from API
  async function fetchBooks(page = 1, search = "", category = "", language = "") {
    if (!browser) return;
    loading = true;
    error = "";
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '20');
      if (search) params.set('q', search);
      if (category && category !== 'all') {
        params.set('category', category);
      }
      if (language) params.set('lang', language);
      const response = await fetch(`/api/books?${params.toString()}`, {
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
        // Transform API data to match your frontend expectations
        books = data.data.books.map((book: ApiBook) => ({
          ...book,
          isbn: book.bookId,
          copies: book.copiesAvailable,
          available: book.copiesAvailable,
          published: book.publishedYear?.toString() || 'Unknown',
          status: book.copiesAvailable > 5 ? 'Available' : 
                  book.copiesAvailable > 0 ? 'Limited' : 'Unavailable',
          category: book.categoryId !== undefined ? categoryMap[book.categoryId] || book.category || 'General' : book.category || 'General'
        }));
        pagination = data.data.pagination;
      } else {
        throw new Error(data.message || 'Failed to fetch books');
      }
    } catch (err) {
      console.error('Error fetching books:', err);
      error = err instanceof Error ? err.message : 'An error occurred while fetching books';
      books = [];
    } finally {
      loading = false;
    }
  }

  // Debounced search function - auto-searches after delay, commits on Enter
  function debouncedSearch(immediate = false) {
    if (immediate) {
      // Immediate search for Enter key - commit the search term
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
    await goto(`/dashboard/books${queryString ? '?' + queryString : ''}`);
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
      const response = await fetch('/api/books/categories', {
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
      const response = await fetch('/api/books/stats', {
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

  // Function to delete a book
  async function deleteBook(bookId: number, bookTitle: string) {
    if (!confirm(`Are you sure you want to delete "${bookTitle}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/books?id=${bookId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        // Refresh data
        await Promise.all([
          fetchBooks(),
          fetchStats()
        ]);
      } else {
        throw new Error(data.message || 'Failed to delete book');
      }
    } catch (err) {
      console.error('Error deleting book:', err);
      error = err instanceof Error ? err.message : 'An error occurred while deleting the book';
    }
  }

  // Event handlers for the modal
  function handleAddBookSuccess(event: CustomEvent) {
    console.log('Book added successfully:', event.detail);
    // Refresh the book list and stats, go to first page
    goto('/dashboard/books?page=1');
    fetchStats();
  }

  function handleAddBookError(event: CustomEvent) {
    console.error('Error adding book:', event.detail);
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
      goto(`/dashboard/books${queryString ? '?' + queryString : ''}`);
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

  let showViewBookModal = false;
  let showEditBookModal = false;
  let selectedBook: Book | null = null;

  function openViewBookModal(book: Book) {
    selectedBook = book;
    showViewBookModal = true;
    showEditBookModal = false;
  }

  function openEditBookModal(book: Book) {
    selectedBook = book;
    showEditBookModal = true;
    showViewBookModal = false;
  }

  function closeBookModal() {
    showViewBookModal = false;
    showEditBookModal = false;
    selectedBook = null;
  }

  function handleBookSave(event: CustomEvent) {
    // You can implement save logic here
    closeBookModal();
    fetchBooks();
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
  <title>Books | E-Kalibro Admin Portal</title>
</svelte:head>

<div class="space-y-4">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">Book Management</h2>
        <p class="text-slate-600">Manage your library's book collection</p>
      </div>
      <div class="flex justify-center gap-2">
        <button
          on:click={() => showAddModal = true}
          class="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-600 transition-colors duration-200"
        >
          <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Add New Book
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
              on:click={() => fetchBooks()} 
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
    {#if loading && books.length === 0}
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
            <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Total Books</p>
            <p class="text-lg sm:text-xl font-bold text-gray-900">{stats.totalBooks}</p>
          </div>
        </div>
        <div class="group relative bg-white rounded-xl shadow-sm border border-gray-200 p-3 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <div class="flex flex-col items-center text-center">
            <div class="p-2.5 rounded-lg mb-3 bg-gradient-to-br from-green-400 to-green-600 shadow-sm">
              <svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Available</p>
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
            <p class="text-lg sm:text-xl font-bold text-gray-900">{stats.borrowedBooks}</p>
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
            <p class="text-lg sm:text-xl font-bold text-gray-900">{categories.length - 1}</p>
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
              placeholder="Search by title, author, or ISBN..."
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

    <!-- Loading State with Skeleton -->
    {#if loading && books.length === 0}
      <!-- Desktop Table Skeleton -->
      <div class="bg-white shadow-lg border border-slate-200 rounded-xl overflow-hidden hidden lg:block">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200">
            <thead class="bg-slate-50">
              <tr>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Book Details
                </th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Category
                </th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Availability
                </th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-slate-100">
              {#each Array(8) as _, i}
                <tr class="animate-pulse">
                  <td class="px-6 py-4">
                    <div class="space-y-2">
                      <div class="h-4 bg-slate-200 rounded w-3/4"></div>
                      <div class="h-3 bg-slate-200 rounded w-1/2"></div>
                      <div class="h-3 bg-slate-200 rounded w-2/3"></div>
                    </div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="h-6 bg-slate-200 rounded-full w-20"></div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="space-y-2">
                      <div class="h-3 bg-slate-200 rounded w-24 mb-2"></div>
                      <div class="h-2 bg-slate-200 rounded-full w-full"></div>
                    </div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="h-6 bg-slate-200 rounded-full w-20"></div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="flex space-x-3">
                      <div class="h-4 w-4 bg-slate-200 rounded"></div>
                      <div class="h-4 w-4 bg-slate-200 rounded"></div>
                      <div class="h-4 w-4 bg-slate-200 rounded"></div>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Mobile Card Skeleton -->
      <div class="grid grid-cols-1 gap-3 lg:hidden">
        {#each Array(5) as _, i}
          <div class="bg-white p-4 rounded-xl shadow-lg border border-slate-200 animate-pulse">
            <div class="flex items-start justify-between mb-3">
              <div class="flex-1 space-y-2">
                <div class="h-4 bg-slate-200 rounded w-3/4"></div>
                <div class="h-3 bg-slate-200 rounded w-1/2"></div>
                <div class="h-3 bg-slate-200 rounded w-2/3"></div>
              </div>
              <div class="h-6 bg-slate-200 rounded-full w-16 ml-3"></div>
            </div>
            
            <div class="flex items-center justify-between mb-3">
              <div class="h-6 bg-slate-200 rounded-full w-20"></div>
              <div class="h-3 bg-slate-200 rounded w-24"></div>
            </div>

            <div class="mb-4">
              <div class="w-full bg-slate-200 rounded-full h-2"></div>
            </div>

            <div class="flex justify-end space-x-3">
              <div class="h-8 w-8 bg-slate-200 rounded-lg"></div>
              <div class="h-8 w-8 bg-slate-200 rounded-lg"></div>
              <div class="h-8 w-8 bg-slate-200 rounded-lg"></div>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Book List -->
    {#key 'book-list'}
      <!-- Desktop Table View -->
      {#if !loading || books.length > 0}
        <div class="bg-white shadow-lg border border-slate-200 rounded-xl overflow-hidden hidden lg:block">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200">
            <thead class="bg-slate-50">
              <tr>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Book Details
                </th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Category
                </th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Availability
                </th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-slate-100">
              {#each books as book}
                <tr class="hover:bg-yellow-50 transition-colors duration-200">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div class="text-sm font-semibold text-slate-900">{book.title}</div>
                      <div class="text-sm text-slate-600">by {book.author}</div>
                      <div class="text-xs text-slate-400">ISBN: {book.isbn} • {book.published}</div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                      {book.category || 'General'}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    <div class="mb-2">
                      <span class="font-semibold">{book.copiesAvailable}</span> available
                    </div>
                    <div class="w-full bg-slate-200 rounded-full h-2">
                      <div
                        class="bg-green-600 h-2 rounded-full transition-all duration-300"
                        style="width: {Math.min(book.copiesAvailable * 10, 100)}%"
                      ></div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(book.status || 'Unknown')}`}>
                      {book.status || 'Unknown'}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div class="flex space-x-3">
                      <button
                        aria-label="View Details"
                        class="text-slate-600 hover:text-slate-900 transition-colors duration-200"
                        title="View Details"
                        on:click={() => openViewBookModal(book)}
                      >
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="3"/>
                          <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                      </button>
                      <button
                        aria-label="Edit Book"
                        class="text-green-600 hover:text-green-700 transition-colors duration-200"
                        title="Edit Book"
                        on:click={() => openEditBookModal(book)}
                      >
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 3.487a2.1 2.1 0 112.97 2.97L7.5 18.789l-4 1 1-4 12.362-12.302z"/>
                        </svg>
                      </button>
                      <button aria-label="Delete Book" 
                        class="text-red-600 hover:text-red-700 transition-colors duration-200" 
                        title="Delete Book"
                        on:click={() => deleteBook(book.id, book.title)}
                      >
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <polyline points="3 6 5 6 21 6"/>
                          <path stroke-linecap="round" stroke-linejoin="round" d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m5 6v6m4-6v6"/>
                          <path stroke-linecap="round" stroke-linejoin="round" d="M10 11V17M14 11V17"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
          
          {#if books.length === 0 && !loading}
            <div class="text-center py-8">
              <p class="text-slate-500">No books found matching your criteria.</p>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Mobile Card View -->
    {#if !loading || books.length > 0}
      <div class="grid grid-cols-1 gap-3 lg:hidden">
        {#each books as book}
          <div class="bg-white p-4 rounded-xl shadow-lg border border-slate-200">
            <div class="flex items-start justify-between mb-3">
              <div class="flex-1 min-w-0">
                <h3 class="text-base font-semibold text-slate-900 truncate">{book.title}</h3>
                <p class="text-sm text-slate-600">by {book.author}</p>
                <p class="text-xs text-slate-400">ISBN: {book.isbn} • {book.published}</p>
              </div>
              <span class={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(book.status || 'Unknown')} ml-3`}>
                {book.status || 'Unknown'}
              </span>
            </div>
            
            <div class="flex items-center justify-between mb-3">
              <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                {book.category || 'General'}
              </span>
              <div class="text-right">
                <div class="text-sm text-slate-900">
                  <span class="font-semibold">{book.copiesAvailable}</span> available
                </div>
              </div>
            </div>

            <div class="mb-4">
              <div class="w-full bg-slate-200 rounded-full h-2">
                <div
                  class="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style="width: {Math.min(book.copiesAvailable * 10, 100)}%"
                ></div>
              </div>
            </div>

            <div class="flex justify-center space-x-3">
              <button
                aria-label="View Details"
                class="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                title="View Details"
                on:click={() => openViewBookModal(book)}
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
              </button>
              <button
                aria-label="Edit Book"
                class="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors duration-200"
                title="Edit Book"
                on:click={() => openEditBookModal(book)}
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 3.487a2.1 2.1 0 112.97 2.97L7.5 18.789l-4 1 1-4 12.362-12.302z"/>
                </svg>
              </button>
              <button aria-label="Delete Book" 
                class="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-200" 
                title="Delete Book"
                on:click={() => deleteBook(book.id, book.title)}
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <polyline points="3 6 5 6 21 6"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m5 6v6m4-6v6"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10 11V17M14 11V17"/>
                </svg>
              </button>
            </div>
          </div>
        {/each}
        
        {#if books.length === 0 && !loading}
          <div class="bg-white p-8 rounded-xl shadow-lg border border-slate-200 text-center">
            <p class="text-slate-500">No books found matching your criteria.</p>
          </div>
        {/if}
      </div>
    {/if}
    {/key}

    <!-- Pagination -->
    {#if pagination.totalPages > 1}
      <div class="bg-white px-4 lg:px-6 py-4 border border-amber-200 rounded-xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-2">
        <div class="text-sm text-slate-700 order-2 sm:order-1">
          Page {pagination.currentPage} of {pagination.totalPages} • Showing <span class="font-semibold">{((pagination.currentPage - 1) * pagination.limit) + 1}</span> to 
          <span class="font-semibold">{Math.min(pagination.currentPage * pagination.limit, pagination.totalCount)}</span> of
          <span class="font-semibold">{pagination.totalCount}</span> results
        </div>
        <nav class="relative z-0 inline-flex rounded-lg shadow-sm -space-x-px order-1 sm:order-2">
          <!-- Previous Button -->
          <button 
            on:click={prevPage}
            disabled={!pagination.hasPrevPage || loading}
            class="relative inline-flex items-center px-3 py-2 border border-amber-300 text-sm font-medium rounded-l-lg text-slate-500 bg-white hover:bg-yellow-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            <span class="hidden sm:inline">Previous</span>
          </button>
          
          <!-- Page Numbers -->
          {#each pageNumbers as pageNum}
            {#if pageNum === '...'}
              <span class="relative inline-flex items-center px-4 py-2 border border-amber-300 bg-white text-sm font-medium text-slate-700">
                ...
              </span>
            {:else}
              <button 
                on:click={() => goToPage(pageNum as number)}
                disabled={loading}
                class="relative inline-flex items-center px-4 py-2 border border-amber-300 text-sm font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed {pageNum === pagination.currentPage ? 'text-yellow-800 bg-yellow-100' : 'text-slate-500 bg-white hover:bg-yellow-50'}"
              >
                {pageNum}
              </button>
            {/if}
          {/each}
          
          <!-- Next Button -->
          <button 
            on:click={nextPage}
            disabled={!pagination.hasNextPage || loading}
            class="relative inline-flex items-center px-3 py-2 border border-amber-300 text-sm font-medium rounded-r-lg text-slate-500 bg-white hover:bg-yellow-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span class="hidden sm:inline">Next</span>
            <svg class="h-4 w-4 ml-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </nav>
      </div>
    {/if}

    <!-- Add Book Modal -->
    <AddBooks
      isOpen={showAddModal}
      on:close={handleModalClose}
      on:success={handleAddBookSuccess}
      on:error={handleAddBookError}
    />

    <!-- Add Category Modal Component -->
    <AddCategory
      isOpen={showAddCategoryModal}
      on:success={handleAddCategorySuccess}
      on:error={handleAddCategoryError}
      on:close={handleAddCategoryClose}
    />

    <!-- Book View/Edit Modal -->
    {#if showViewBookModal || showEditBookModal}
      <ViewBook
        isOpen={showViewBookModal || showEditBookModal}
        book={selectedBook}
        isEditMode={showEditBookModal}
        on:close={closeBookModal}
        on:save={handleBookSave}
        on:edit={() => {
          showEditBookModal = true;
          showViewBookModal = false;
        }}
      />
    {/if}
  </div>