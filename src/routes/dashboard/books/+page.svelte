<script lang="ts">
  import { onMount } from "svelte";
  import Layout from "$lib/components/ui/layout.svelte";

  let searchTerm = "";
  let selectedCategory = "all";
  let showAddModal = false;

  let books = [
    {
      id: 1,
      title: 'Introduction to Computer Science',
      author: 'John Smith',
      isbn: '978-0123456789',
      category: 'Technology',
      copies: 5,
      available: 3,
      published: '2023',
      status: 'Available'
    },
    {
      id: 2,
      title: 'Calculus and Analytic Geometry',
      author: 'Mary Johnson',
      isbn: '978-0987654321',
      category: 'Mathematics',
      copies: 8,
      available: 2,
      published: '2022',
      status: 'Limited'
    },
    {
      id: 3,
      title: 'World History: Ancient Civilizations',
      author: 'Robert Brown',
      isbn: '978-0456789123',
      category: 'History',
      copies: 6,
      available: 0,
      published: '2021',
      status: 'Unavailable'
    },
    {
      id: 4,
      title: 'Physics Principles and Problems',
      author: 'Sarah Davis',
      isbn: '978-0321654987',
      category: 'Science',
      copies: 4,
      available: 4,
      published: '2023',
      status: 'Available'
    },
    {
      id: 5,
      title: 'English Literature Anthology',
      author: 'David Wilson',
      isbn: '978-0147258369',
      category: 'Literature',
      copies: 10,
      available: 7,
      published: '2022',
      status: 'Available'
    },
  ];

  let categories = ['all', 'Technology', 'Mathematics', 'History', 'Science', 'Literature'];

  $: filteredBooks = books.filter(book => {
    const matchesSearch = book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         book.isbn.includes(searchTerm);
    const matchesCategory = selectedCategory === 'all' || book.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

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
</script>

<Layout>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">Book Management</h2>
        <p class="text-slate-600">Manage your library's book collection</p>
      </div>
      <button
        on:click={() => showAddModal = true}
        class="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors duration-200"
      >
        <!-- Plus Icon -->
        <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
        </svg>
        Add New Book
      </button>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center">
          <div class="p-3 bg-slate-100 rounded-xl">
            <!-- BookOpen Icon -->
            <svg class="h-6 w-6 text-slate-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-slate-600">Total Books</p>
            <p class="text-2xl font-bold text-slate-900">{books.reduce((acc, book) => acc + book.copies, 0)}</p>
          </div>
        </div>
      </div>
      <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center">
          <div class="p-3 bg-emerald-100 rounded-xl">
            <!-- CheckCircle Icon -->
            <svg class="h-6 w-6 text-emerald-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-slate-600">Available</p>
            <p class="text-2xl font-bold text-slate-900">{books.reduce((acc, book) => acc + book.available, 0)}</p>
          </div>
        </div>
      </div>
      <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center">
          <div class="p-3 bg-amber-100 rounded-xl">
            <!-- Clock Icon -->
            <svg class="h-6 w-6 text-amber-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-slate-600">Borrowed</p>
            <p class="text-2xl font-bold text-slate-900">{books.reduce((acc, book) => acc + (book.copies - book.available), 0)}</p>
          </div>
        </div>
      </div>
      <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center">
          <div class="p-3 bg-purple-100 rounded-xl">
            <!-- Tag Icon -->
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
            <!-- Search Icon -->
            <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search by title, author, or ISBN..."
              bind:value={searchTerm}
              class="pl-10 pr-4 py-3 w-full border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors duration-200"
            />
          </div>
        </div>
        <div class="flex flex-col sm:flex-row gap-2">
          <select
            bind:value={selectedCategory}
            class="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 bg-white text-slate-700 transition-colors duration-200"
          >
            {#each categories as category}
              <option value={category}>
                {category === 'all' ? 'All Categories' : category}
              </option>
            {/each}
          </select>
          <button class="px-4 py-3 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center justify-center text-slate-700 transition-colors duration-200">
            <!-- Download Icon -->
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

    <!-- Desktop Table View -->
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
                    {book.category}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                  <div class="mb-2">
                    <span class="font-semibold">{book.available}</span> of {book.copies} available
                  </div>
                  <div class="w-full bg-slate-200 rounded-full h-2">
                    <div
                      class="bg-slate-600 h-2 rounded-full transition-all duration-300"
                      style="width: {(book.available / book.copies) * 100}%"
                    ></div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(book.status)}`}>
                    {book.status}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div class="flex space-x-3">
                    <button class="text-slate-600 hover:text-slate-900 transition-colors duration-200" title="View Details">
                      <!-- Eye Icon -->
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="3"/>
                        <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                      </svg>
                    </button>
                    <button class="text-emerald-600 hover:text-emerald-700 transition-colors duration-200" title="Edit Book">
                      <!-- Edit2 Icon -->
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 3.487a2.1 2.1 0 112.97 2.97L7.5 18.789l-4 1 1-4 12.362-12.302z"/>
                      </svg>
                    </button>
                    <button class="text-red-600 hover:text-red-700 transition-colors duration-200" title="Delete Book">
                      <!-- Trash2 Icon -->
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
      </div>
    </div>

    <!-- Mobile Card View -->
    <div class="grid grid-cols-1 gap-4 lg:hidden">
      {#each filteredBooks as book}
        <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div class="flex items-start justify-between mb-3">
            <div class="flex-1 min-w-0">
              <h3 class="text-base font-semibold text-slate-900 truncate">{book.title}</h3>
              <p class="text-sm text-slate-600">by {book.author}</p>
              <p class="text-xs text-slate-400">ISBN: {book.isbn} • {book.published}</p>
            </div>
            <span class={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(book.status)} ml-3`}>
              {book.status}
            </span>
          </div>
          
          <div class="flex items-center justify-between mb-3">
            <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
              {book.category}
            </span>
            <div class="text-right">
              <div class="text-sm text-slate-900">
                <span class="font-semibold">{book.available}</span>/{book.copies} available
              </div>
            </div>
          </div>

          <div class="mb-4">
            <div class="w-full bg-slate-200 rounded-full h-2">
              <div
                class="bg-slate-600 h-2 rounded-full transition-all duration-300"
                style="width: {(book.available / book.copies) * 100}%"
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
            <button class="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-200" title="Delete Book">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <polyline points="3 6 5 6 21 6"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m5 6v6m4-6v6"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M10 11V17M14 11V17"/>
              </svg>
            </button>
          </div>
        </div>
      {/each}
    </div>

    <!-- Pagination -->
    <div class="bg-white px-4 lg:px-6 py-4 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="text-sm text-slate-700 order-2 sm:order-1">
        Showing <span class="font-semibold">1</span> to <span class="font-semibold">{filteredBooks.length}</span> of
        <span class="font-semibold">{filteredBooks.length}</span> results
      </div>
      <nav class="relative z-0 inline-flex rounded-lg shadow-sm -space-x-px order-1 sm:order-2">
        <button class="relative inline-flex items-center px-3 py-2 border border-slate-300 text-sm font-medium rounded-l-lg text-slate-500 bg-white hover:bg-slate-50 transition-colors duration-200">
          <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          <span class="hidden sm:inline">Previous</span>
        </button>
        <button class="relative inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors duration-200">
          1
        </button>
        <button class="relative inline-flex items-center px-3 py-2 border border-slate-300 text-sm font-medium rounded-r-lg text-slate-500 bg-white hover:bg-slate-50 transition-colors duration-200">
          <span class="hidden sm:inline">Next</span>
          <svg class="h-4 w-4 ml-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </nav>
    </div>
  </div>
</Layout>