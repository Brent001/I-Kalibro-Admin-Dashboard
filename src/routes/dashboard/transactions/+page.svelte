<script lang="ts">
  import Layout from "$lib/components/ui/layout.svelte";

  let searchTerm = "";
  let selectedStatus = "all";
  let selectedType = "all";
  let showFilters = false;

  const transactions = [
    {
      id: 1,
      type: 'Borrow',
      bookTitle: 'Introduction to Computer Science',
      bookId: 'CS-001',
      memberName: 'John Doe',
      memberId: 'MDC-2024-001',
      borrowDate: '2024-01-10',
      dueDate: '2024-01-24',
      returnDate: null,
      status: 'Active',
      fine: 0
    },
    {
      id: 2,
      type: 'Return',
      bookTitle: 'Calculus and Analytic Geometry',
      bookId: 'MATH-045',
      memberName: 'Jane Smith',
      memberId: 'MDC-2024-156',
      borrowDate: '2024-01-05',
      dueDate: '2024-01-19',
      returnDate: '2024-01-18',
      status: 'Returned',
      fine: 0
    },
    {
      id: 3,
      type: 'Borrow',
      bookTitle: 'Physics Principles and Problems',
      bookId: 'PHY-023',
      memberName: 'Michael Brown',
      memberId: 'MDC-STF-023',
      borrowDate: '2024-01-08',
      dueDate: '2024-01-22',
      returnDate: null,
      status: 'Overdue',
      fine: 150
    },
    {
      id: 4,
      type: 'Reserve',
      bookTitle: 'World History: Ancient Civilizations',
      bookId: 'HIST-089',
      memberName: 'Emily Davis',
      memberId: 'MDC-2024-298',
      borrowDate: '2024-01-12',
      dueDate: '2024-01-26',
      returnDate: null,
      status: 'Reserved',
      fine: 0
    },
    {
      id: 5,
      type: 'Return',
      bookTitle: 'English Literature Anthology',
      bookId: 'ENG-067',
      memberName: 'Dr. Sarah Johnson',
      memberId: 'MDC-FAC-045',
      borrowDate: '2024-01-03',
      dueDate: '2024-01-17',
      returnDate: '2024-01-16',
      status: 'Returned',
      fine: 0
    },
    {
      id: 6,
      type: 'Borrow',
      bookTitle: 'Business Management Fundamentals',
      bookId: 'BUS-134',
      memberName: 'Alex Wilson',
      memberId: 'MDC-2024-445',
      borrowDate: '2024-01-11',
      dueDate: '2024-01-25',
      returnDate: null,
      status: 'Active',
      fine: 0
    },
  ];

  const transactionTypes = ['all', 'Borrow', 'Return', 'Reserve'];
  const transactionStatuses = ['all', 'Active', 'Returned', 'Overdue', 'Reserved'];

  $: filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = transaction.bookTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.memberName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.bookId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.memberId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || transaction.status === selectedStatus;
    const matchesType = selectedType === 'all' || transaction.type === selectedType;
    return matchesSearch && matchesStatus && matchesType;
  });

  function getStatusColor(status: string) {
    switch (status) {
      case 'Active':
        return 'bg-slate-100 text-slate-800';
      case 'Returned':
        return 'bg-emerald-100 text-emerald-800';
      case 'Overdue':
        return 'bg-red-100 text-red-800';
      case 'Reserved':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'Active':
        return 'clock';
      case 'Returned':
        return 'check';
      case 'Overdue':
        return 'x';
      case 'Reserved':
        return 'bookmark';
      default:
        return 'clock';
    }
  }

  function getTypeColor(type: string) {
    switch (type) {
      case 'Borrow':
        return 'bg-slate-100 text-slate-800';
      case 'Return':
        return 'bg-emerald-100 text-emerald-800';
      case 'Reserve':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
</script>

<Layout>
  <div class="space-y-4 sm:space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-xl sm:text-2xl font-bold text-gray-900">Transaction Management</h2>
        <p class="text-sm sm:text-base text-gray-600">Track all library transactions and activities</p>
      </div>
      <button class="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors duration-200 w-full sm:w-auto">
        <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
        </svg>
        New Transaction
      </button>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <div class="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200">
        <div class="flex items-center">
          <div class="p-2 bg-slate-100 rounded-lg">
            <svg class="h-5 w-5 sm:h-6 sm:w-6 text-slate-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div class="ml-3 sm:ml-4">
            <p class="text-xs sm:text-sm font-medium text-gray-600">Active Loans</p>
            <p class="text-lg sm:text-2xl font-semibold text-gray-900">{transactions.filter(t => t.status === 'Active').length}</p>
          </div>
        </div>
      </div>
      <div class="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200">
        <div class="flex items-center">
          <div class="p-2 bg-emerald-100 rounded-lg">
            <svg class="h-5 w-5 sm:h-6 sm:w-6 text-emerald-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <div class="ml-3 sm:ml-4">
            <p class="text-xs sm:text-sm font-medium text-gray-600">Returned</p>
            <p class="text-lg sm:text-2xl font-semibold text-gray-900">{transactions.filter(t => t.status === 'Returned').length}</p>
          </div>
        </div>
      </div>
      <div class="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200">
        <div class="flex items-center">
          <div class="p-2 bg-red-100 rounded-lg">
            <svg class="h-5 w-5 sm:h-6 sm:w-6 text-red-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"/>
            </svg>
          </div>
          <div class="ml-3 sm:ml-4">
            <p class="text-xs sm:text-sm font-medium text-gray-600">Overdue</p>
            <p class="text-lg sm:text-2xl font-semibold text-gray-900">{transactions.filter(t => t.status === 'Overdue').length}</p>
          </div>
        </div>
      </div>
      <div class="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200">
        <div class="flex items-center">
          <div class="p-2 bg-amber-100 rounded-lg">
            <svg class="h-5 w-5 sm:h-6 sm:w-6 text-amber-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div class="ml-3 sm:ml-4">
            <p class="text-xs sm:text-sm font-medium text-gray-600">Total Fines</p>
            <p class="text-lg sm:text-2xl font-semibold text-gray-900">₱{transactions.reduce((acc, t) => acc + t.fine, 0)}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Search and Filters -->
    <div class="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
      <!-- Search Bar -->
      <div class="mb-4">
        <div class="relative">
          <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/>
            <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Search transactions..."
            bind:value={searchTerm}
            class="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors duration-200"
          />
        </div>
      </div>

      <!-- Mobile Filter Toggle -->
      <div class="sm:hidden mb-4">
        <button
          on:click={() => showFilters = !showFilters}
          class="w-full flex items-center justify-between px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
        >
          <span class="flex items-center">
            <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z"/>
            </svg>
            Filters
          </span>
          <svg class={`h-4 w-4 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
      </div>

      <!-- Filters -->
      <div class={`${showFilters ? 'block' : 'hidden'} sm:block`}>
        <div class="flex flex-col sm:flex-row gap-3 sm:gap-2">
          <select
            bind:value={selectedType}
            class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors duration-200 flex-1 sm:flex-none"
          >
            {#each transactionTypes as type}
              <option value={type}>
                {type === 'all' ? 'All Types' : type}
              </option>
            {/each}
          </select>
          <select
            bind:value={selectedStatus}
            class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors duration-200 flex-1 sm:flex-none"
          >
            {#each transactionStatuses as status}
              <option value={status}>
                {status === 'all' ? 'All Statuses' : status}
              </option>
            {/each}
          </select>
          <button class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center transition-colors duration-200">
            <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>
            </svg>
            Export
          </button>
        </div>
      </div>
    </div>

    <!-- Desktop Table View -->
    <div class="hidden lg:block bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Transaction ID
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Book Details
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Member Details
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Dates
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Status
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Fine
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each filteredTransactions as transaction}
              <tr class="hover:bg-slate-50 transition-colors duration-150">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div class="text-sm font-medium text-gray-900">#{transaction.id.toString().padStart(6, '0')}</div>
                    <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(transaction.type)}`}>
                      {transaction.type}
                    </span>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div class="text-sm font-medium text-gray-900">{transaction.bookTitle}</div>
                    <div class="text-sm text-gray-500">ID: {transaction.bookId}</div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div class="text-sm font-medium text-gray-900">{transaction.memberName}</div>
                    <div class="text-sm text-gray-500">{transaction.memberId}</div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div class="space-y-1">
                    <div class="flex items-center">
                      <svg class="h-3 w-3 mr-1.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      <span class="text-xs text-slate-500">Borrowed:</span>
                      <span class="ml-1 text-xs">{formatDate(transaction.borrowDate)}</span>
                    </div>
                    <div class="flex items-center">
                      <svg class="h-3 w-3 mr-1.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      <span class="text-xs text-slate-500">Due:</span>
                      <span class="ml-1 text-xs">{formatDate(transaction.dueDate)}</span>
                    </div>
                    {#if transaction.returnDate}
                      <div class="flex items-center">
                        <svg class="h-3 w-3 mr-1.5 text-emerald-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                          <line x1="16" y1="2" x2="16" y2="6"/>
                          <line x1="8" y1="2" x2="8" y2="6"/>
                          <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        <span class="text-xs text-slate-500">Returned:</span>
                        <span class="ml-1 text-xs">{formatDate(transaction.returnDate)}</span>
                      </div>
                    {/if}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                    <span class="mr-1.5">
                      {#if getStatusIcon(transaction.status) === 'clock'}
                        <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10"/>
                          <polyline points="12 6 12 12 16 14"/>
                        </svg>
                      {:else if getStatusIcon(transaction.status) === 'check'}
                        <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                        </svg>
                      {:else if getStatusIcon(transaction.status) === 'x'}
                        <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"/>
                        </svg>
                      {:else if getStatusIcon(transaction.status) === 'bookmark'}
                        <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"/>
                        </svg>
                      {/if}
                    </span>
                    {transaction.status}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {#if transaction.fine > 0}
                    <span class="text-red-600 font-semibold">₱{transaction.fine}</span>
                  {:else}
                    <span class="text-slate-500">₱0</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Mobile Card View -->
    <div class="lg:hidden space-y-3">
      {#each filteredTransactions as transaction}
        <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <!-- Header Row -->
          <div class="flex items-start justify-between mb-3">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-sm font-medium text-gray-900">#{transaction.id.toString().padStart(6, '0')}</span>
                <span class={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getTypeColor(transaction.type)}`}>
                  {transaction.type}
                </span>
              </div>
              <h3 class="text-sm font-medium text-gray-900 leading-5">{transaction.bookTitle}</h3>
              <p class="text-xs text-gray-500">ID: {transaction.bookId}</p>
            </div>
            <div class="flex flex-col items-end gap-1">
              <span class={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                <span class="mr-1">
                  {#if getStatusIcon(transaction.status) === 'clock'}
                    <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                  {:else if getStatusIcon(transaction.status) === 'check'}
                    <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                  {:else if getStatusIcon(transaction.status) === 'x'}
                    <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"/>
                    </svg>
                  {:else if getStatusIcon(transaction.status) === 'bookmark'}
                    <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"/>
                    </svg>
                  {/if}
                </span>
                {transaction.status}
              </span>
              {#if transaction.fine > 0}
                <span class="text-sm font-semibold text-red-600">₱{transaction.fine}</span>
              {/if}
            </div>
          </div>

          <!-- Member Info -->
          <div class="mb-3 pb-3 border-b border-gray-100">
            <p class="text-sm font-medium text-gray-900">{transaction.memberName}</p>
            <p class="text-xs text-gray-500">{transaction.memberId}</p>
          </div>

          <!-- Dates -->
          <div class="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p class="text-gray-500 mb-1">Borrowed</p>
              <p class="font-medium text-gray-900">{formatDate(transaction.borrowDate)}</p>
            </div>
            <div>
              <p class="text-gray-500 mb-1">Due Date</p>
              <p class="font-medium text-gray-900">{formatDate(transaction.dueDate)}</p>
            </div>
            {#if transaction.returnDate}
              <div class="col-span-2">
                <p class="text-gray-500 mb-1">Returned</p>
                <p class="font-medium text-emerald-600">{formatDate(transaction.returnDate)}</p>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    <!-- Pagination -->
    <div class="bg-white px-4 sm:px-6 py-3 border border-gray-200 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3">
      <div class="text-sm text-gray-700 order-2 sm:order-1">
        Showing <span class="font-medium">1</span> to <span class="font-medium">{filteredTransactions.length}</span> of
        <span class="font-medium">{filteredTransactions.length}</span> results
      </div>
      <nav class="relative z-0 inline-flex rounded-lg shadow-sm -space-x-px order-1 sm:order-2">
        <button class="relative inline-flex items-center px-3 sm:px-4 py-2 border border-gray-300 text-sm font-medium rounded-l-lg text-gray-500 bg-white hover:bg-slate-50 transition-colors duration-200">
          <svg class="h-4 w-4 sm:mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          <span class="hidden sm:inline">Previous</span>
        </button>
        <button class="relative inline-flex items-center px-3 sm:px-4 py-2 border border-gray-300 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800">
          1
        </button>
        <button class="relative inline-flex items-center px-3 sm:px-4 py-2 border border-gray-300 text-sm font-medium rounded-r-lg text-gray-500 bg-white hover:bg-slate-50 transition-colors duration-200">
          <span class="hidden sm:inline">Next</span>
          <svg class="h-4 w-4 sm:ml-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </nav>
    </div>
  </div>
</Layout>