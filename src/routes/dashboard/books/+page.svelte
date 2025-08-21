<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from '$app/environment';
  import Layout from "$lib/components/ui/layout.svelte";
  import AddBooks from "$lib/components/ui/add_books.svelte";
  import AddCategory from "$lib/components/ui/add_category.svelte";

  let searchTerm = "";
  let selectedCategory = "all";
  let showAddModal = false;
  let showAddCategoryModal = false;
  let loading = false;
  let error = "";

  // API response types
  interface Book {
    id: number;
    title: string;
    author: string;
    isbn: string;
    qrCode?: string;
    publishedYear: number;
    copiesAvailable: number;
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
      books: Book[];
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

  // Categories - you may want to fetch these from API too
  let categories = ['all'];
  let stats = {
    totalBooks: 0,
    availableCopies: 0,
    borrowedBooks: 0,
    categoriesCount: 0
  };

  // Reactive statement for filtered books (client-side filtering)
  $: filteredBooks = books.filter(book => {
    const matchesSearch = book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         book.isbn.includes(searchTerm);
    const matchesCategory = selectedCategory === 'all' || book.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Function to fetch books from API
  async function fetchBooks(page = 1, search = "", category = "") {
    if (!browser) return; // Skip during SSR
    
    loading = true;
    error = "";
    
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '20'); // Adjust as needed
      
      if (search) params.set('search', search);
      if (category && category !== 'all') params.set('category', category);
      
      const response = await fetch(`/api/books?${params.toString()}`, {
        method: 'GET',
        credentials: 'include', // Include cookies for authentication
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Handle unauthorized - redirect to login
          window.location.href = '/';
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse = await response.json();
      
      if (data.success) {
        // Transform API data to match your frontend expectations
        books = data.data.books.map(book => ({
          ...book,
          copies: book.copiesAvailable, // Map for compatibility
          available: book.copiesAvailable,
          published: book.publishedYear?.toString() || 'Unknown',
          status: book.copiesAvailable > 5 ? 'Available' : 
                  book.copiesAvailable > 0 ? 'Limited' : 'Unavailable',
          category: 'General' // You'll need to add category to your schema
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

  // Debounced search function
  let searchTimeout: NodeJS.Timeout;
  function debouncedSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      fetchBooks(1, searchTerm, selectedCategory);
    }, 300);
  }

  // Watch for search changes
  $: if (browser && (searchTerm || selectedCategory !== 'all')) {
    debouncedSearch();
  }

  // Load initial data on component mount
  onMount(async () => {
    await Promise.all([
      fetchBooks(),
      fetchCategories(),
      fetchStats()
    ]);
  });

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
          categories = ['all', ...data.data.categories];
        }
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
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
  function handleAddBookSuccess(event) {
    console.log('Book added successfully:', event.detail);
    // Refresh the book list and stats
    Promise.all([fetchBooks(), fetchStats()]);
  }

  function handleAddBookError(event) {
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
        return 'bg-emerald-100 text-emerald-800';
      case 'Limited':
        return 'bg-amber-100 text-amber-800';
      case 'Unavailable':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  }

  // Pagination handlers
  function goToPage(page: number) {
    if (page >= 1 && page <= pagination.totalPages) {
      fetchBooks(page, searchTerm, selectedCategory);
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
  function handleAddCategoryError(event) {
    categoryError = event.detail.message;
  }
  function handleAddCategoryClose() {
    showAddCategoryModal = false;
  }
</script>

<Layout>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">Book Management</h2>
        <p class="text-slate-600">Manage your library's book collection</p>
      </div>
      <div class="flex gap-2">
        <button
          on:click={() => showAddModal = true}
          class="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors duration-200"
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
      <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
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
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
    {/if}

    <!-- Stats Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center">
          <div class="p-3 bg-slate-100 rounded-xl">
            <svg class="h-6 w-6 text-slate-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-slate-600">Total Books</p>
            <p class="text-2xl font-bold text-slate-900">{stats.totalBooks}</p>
          </div>
        </div>
      </div>
      <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center">
          <div class="p-3 bg-emerald-100 rounded-xl">
            <svg class="h-6 w-6 text-emerald-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-slate-600">Available</p>
            <p class="text-2xl font-bold text-slate-900">{stats.availableCopies}</p>
          </div>
        </div>
      </div>
      <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center">
          <div class="p-3 bg-amber-100 rounded-xl">
            <svg class="h-6 w-6 text-amber-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-slate-600">Borrowed</p>
            <p class="text-2xl font-bold text-slate-900">{stats.borrowedBooks}</p>
          </div>
        </div>
      </div>
      <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center">
          <div class="p-3 bg-purple-100 rounded-xl">
            <svg class="h-6 w-6 text-purple-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-slate-600">Categories</p>
            <p class="text-2xl font-bold text-slate-900">{categories.length - 1}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters and Search -->
    <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200">
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
              class="pl-10 pr-4 py-3 w-full border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors duration-200"
              disabled={loading}
            />
            {#if loading}
              <div class="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div class="animate-spin rounded-full h-4 w-4 border-2 border-slate-300 border-t-slate-600"></div>
              </div>
            {/if}
          </div>
        </div>
        <div class="flex flex-col sm:flex-row gap-2">
          <select
            bind:value={selectedCategory}
            class="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 bg-white text-slate-700 transition-colors duration-200"
            disabled={loading}
          >
            {#each categories as category}
              <option value={category}>
                {category === 'all' ? 'All Categories' : category}
              </option>
            {/each}
          </select>
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

    <!-- Loading State -->
    {#if loading && books.length === 0}
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div class="flex items-center justify-center">
          <div class="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-slate-600"></div>
          <span class="ml-3 text-slate-600">Loading books...</span>
        </div>
      </div>
    {/if}

    <!-- Desktop Table View -->
    {#if !loading || books.length > 0}
      <div class="bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden hidden lg:block">
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
              {#each filteredBooks as book}
                <tr class="hover:bg-slate-50 transition-colors duration-200">
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
                        class="bg-slate-600 h-2 rounded-full transition-all duration-300"
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
                      <button class="text-slate-600 hover:text-slate-900 transition-colors duration-200" title="View Details">
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="3"/>
                          <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                      </button>
                      <button class="text-emerald-600 hover:text-emerald-700 transition-colors duration-200" title="Edit Book">
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 3.487a2.1 2.1 0 112.97 2.97L7.5 18.789l-4 1 1-4 12.362-12.302z"/>
                        </svg>
                      </button>
                      <button 
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
          
          {#if filteredBooks.length === 0 && !loading}
            <div class="text-center py-8">
              <p class="text-slate-500">No books found matching your criteria.</p>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Mobile Card View -->
    {#if !loading || books.length > 0}
      <div class="grid grid-cols-1 gap-4 lg:hidden">
        {#each filteredBooks as book}
          <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
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
                  class="bg-slate-600 h-2 rounded-full transition-all duration-300"
                  style="width: {Math.min(book.copiesAvailable * 10, 100)}%"
                ></div>
              </div>
            </div>

            <div class="flex justify-end space-x-3">
              <button class="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors duration-200" title="View Details">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
              </button>
              <button class="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors duration-200" title="Edit Book">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 3.487a2.1 2.1 0 112.97 2.97L7.5 18.789l-4 1 1-4 12.362-12.302z"/>
                </svg>
              </button>
              <button 
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
        
        {#if filteredBooks.length === 0 && !loading}
          <div class="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
            <p class="text-slate-500">No books found matching your criteria.</p>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Pagination -->
    {#if pagination.totalPages > 1}
      <div class="bg-white px-4 lg:px-6 py-4 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="text-sm text-slate-700 order-2 sm:order-1">
          Showing <span class="font-semibold">{((pagination.currentPage - 1) * pagination.limit) + 1}</span> to 
          <span class="font-semibold">{Math.min(pagination.currentPage * pagination.limit, pagination.totalCount)}</span> of
          <span class="font-semibold">{pagination.totalCount}</span> results
        </div>
        <nav class="relative z-0 inline-flex rounded-lg shadow-sm -space-x-px order-1 sm:order-2">
          <button 
            on:click={prevPage}
            disabled={!pagination.hasPrevPage || loading}
            class="relative inline-flex items-center px-3 py-2 border border-slate-300 text-sm font-medium rounded-l-lg text-slate-500 bg-white hover:bg-slate-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            <span class="hidden sm:inline">Previous</span>
          </button>
          
          <button 
            class="relative inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium text-slate-700 bg-slate-50"
            disabled
          >
            {pagination.currentPage}
          </button>
          
          <button 
            on:click={nextPage}
            disabled={!pagination.hasNextPage || loading}
            class="relative inline-flex items-center px-3 py-2 border border-slate-300 text-sm font-medium rounded-r-lg text-slate-500 bg-white hover:bg-slate-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
  </div>
</Layout>