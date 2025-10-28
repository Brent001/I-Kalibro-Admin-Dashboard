<script lang="ts">
  import Layout from "$lib/components/ui/layout.svelte";
  import ConfirmBorrowModal from "$lib/components/ui/ConfirmBorrowModal.svelte";
  import ReturnBookModal from "$lib/components/ui/ReturnBookModal.svelte";
  import { onMount } from "svelte";
  export let data;

  let searchTerm = "";
  let selectedStatus = "all";
  let selectedType = "all";
  let showFilters = false;

  // Modal states
  let showConfirmBorrowModal = false;
  let showReturnModal = false;
  let selectedTransaction: Transaction | null = null;
  let customDueDate = "";

  // Track modal verification
  let returnVerification = { method: "password", password: "", qrData: "", fine: 0 };

  // Use transactions from server data
  const transactions = data.transactions ?? [];

  const transactionTypes = ['all', 'Borrow', 'Return', 'Reserve'];
  const transactionStatuses = ['all', 'borrowed', 'returned', 'overdue', 'active', 'fulfilled', 'cancelled'];

  interface Transaction {
    id: number;
    bookTitle?: string;
    memberName?: string;
    bookId?: string;
    memberId?: string;
    type: string;
    status: string;
    borrowDate?: string;
    dueDate?: string;
    returnDate?: string;
  }

  $: filteredTransactions = transactions.filter((transaction: Transaction) => {
    const matchesSearch =
      (transaction.bookTitle?.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) ||
      (transaction.memberName?.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) ||
      (transaction.bookId?.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) ||
      (transaction.memberId?.toLowerCase() ?? '').includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || transaction.status?.toLowerCase() === selectedStatus.toLowerCase();
    const matchesType = selectedType === 'all' || transaction.type?.toLowerCase() === selectedType.toLowerCase();
    return matchesSearch && matchesStatus && matchesType;
  });

  function getStatusColor(status: string) {
    const s = status?.toLowerCase() || '';
    switch (s) {
      case 'borrowed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'returned':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'overdue':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'active':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'fulfilled':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  function getStatusIcon(status: string) {
    const s = status?.toLowerCase() || '';
    switch (s) {
      case 'borrowed':
        return 'book-open';
      case 'returned':
        return 'check-circle';
      case 'overdue':
        return 'alert-circle';
      case 'active':
        return 'bookmark';
      case 'fulfilled':
        return 'check-square';
      case 'cancelled':
        return 'x-circle';
      default:
        return 'circle';
    }
  }

  function getTypeColor(type: string) {
    const t = type?.toLowerCase() || '';
    switch (t) {
      case 'borrow':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      case 'return':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'reserve':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  function formatDate(dateString: string) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function formatDateForInput(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function calculateDaysRemaining(dueDate: string) {
    if (!dueDate) return null;
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  async function handleDelete(transactionId: number) {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    try {
      const res = await fetch(`/api/transactions/${transactionId}`, { 
        method: "DELETE",
        credentials: 'include'
      });
      if (res.ok) {
        alert("Transaction deleted successfully!");
        location.reload();
      } else {
        alert("Failed to delete transaction.");
      }
    } catch (err) {
      alert("Error deleting transaction.");
    }
  }

  function openReturnModal(transaction: Transaction) {
    selectedTransaction = transaction;
    showReturnModal = true;
    returnVerification = { method: "password", password: "", qrData: "", fine: 0 };
  }

  function closeReturnModal() {
    showReturnModal = false;
    selectedTransaction = null;
    returnVerification = { method: "password", password: "", qrData: "", fine: 0 };
  }

  function handleReturnModalConfirm(e) {
    returnVerification = e.detail;
    confirmReturn();
  }

  async function confirmReturn() {
    if (!selectedTransaction) return;
    try {
      const res = await fetch(`/api/transactions/${selectedTransaction.id}/return`, { 
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: returnVerification.method,
          password: returnVerification.password,
          qrData: returnVerification.qrData,
          fine: returnVerification.fine
        }),
        credentials: 'include'
      });
      
      const data = await res.json();
      
      if (res.ok) {
        if (data.data?.fine > 0) {
          alert(`Book returned successfully!\n\nOverdue Fine: ₱${data.data.fine}\n\nPlease collect the fine from the member.`);
        } else {
          alert("Book returned successfully!");
        }
        closeReturnModal();
        location.reload();
      } else {
        if (res.status === 401) {
          alert("Session expired or not authenticated. Please log in again.");
          window.location.href = '/';
          return;
        }
        alert(data.message || "Failed to return book.");
      }
    } catch (err) {
      console.error('Return error:', err);
      alert("Error returning book. Please try again.");
    }
  }

  function openConfirmBorrowModal(transaction: Transaction) {
    selectedTransaction = transaction;
    const defaultDue = new Date();
    defaultDue.setHours(defaultDue.getHours() + 24);
    customDueDate = formatDateForInput(defaultDue);
    showConfirmBorrowModal = true;
  }

  function closeConfirmBorrowModal() {
    showConfirmBorrowModal = false;
    selectedTransaction = null;
    customDueDate = "";
  }

  async function confirmBorrow() {
    if (!selectedTransaction) return;
    try {
      const res = await fetch(`/api/transactions/${selectedTransaction.id}/confirm-borrow`, { 
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          dueDate: customDueDate
        }),
        credentials: 'include'
      });
      if (res.ok) {
        alert("Reservation confirmed as borrow!");
        closeConfirmBorrowModal();
        location.reload();
      } else {
        const data = await res.json();
        alert(data.message || "Failed to confirm borrow.");
      }
    } catch (err) {
      alert("Error confirming borrow.");
    }
  }

  // Optional: Check session on mount
  onMount(async () => {
    const res = await fetch('/api/auth/session', { credentials: 'include' });
    if (!res.ok) {
      alert("Session expired. Please log in again.");
      window.location.href = '/';
    }
  });

  // Calculate stats
  $: stats = {
    active: transactions.filter((t: Transaction) => t.status?.toLowerCase() === 'borrowed').length,
    returned: transactions.filter((t: Transaction) => t.status?.toLowerCase() === 'returned').length,
    overdue: transactions.filter((t: Transaction) => {
      if (!t.dueDate) return false;
      const due = new Date(t.dueDate);
      const now = new Date();
      return due < now && (t.status?.toLowerCase() === 'borrowed' || t.status?.toLowerCase() === 'overdue');
    }).length,
    reserved: transactions.filter((t: Transaction) => t.status?.toLowerCase() === 'active' && t.type?.toLowerCase() === 'reserve').length,
  };
</script>

<Layout>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-2xl sm:text-3xl font-bold text-gray-900">Transaction Management</h2>
        <p class="text-sm sm:text-base text-gray-600 mt-1">Monitor and manage all library transactions</p>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
      <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <p class="text-sm font-medium text-gray-600 mb-1">Active Loans</p>
            <p class="text-3xl font-bold text-gray-900">{stats.active}</p>
            <p class="text-xs text-gray-500 mt-1">Currently borrowed</p>
          </div>
          <div class="p-3 bg-blue-100 rounded-lg">
            <svg class="h-6 w-6 text-blue-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/>
            </svg>
          </div>
        </div>
      </div>

      <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <p class="text-sm font-medium text-gray-600 mb-1">Returned</p>
            <p class="text-3xl font-bold text-gray-900">{stats.returned}</p>
            <p class="text-xs text-gray-500 mt-1">Successfully returned</p>
          </div>
          <div class="p-3 bg-emerald-100 rounded-lg">
            <svg class="h-6 w-6 text-emerald-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
        </div>
      </div>

      <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <p class="text-sm font-medium text-gray-600 mb-1">Overdue</p>
            <p class="text-3xl font-bold text-gray-900">{stats.overdue}</p>
            <p class="text-xs text-gray-500 mt-1">Need attention</p>
          </div>
          <div class="p-3 bg-red-100 rounded-lg">
            <svg class="h-6 w-6 text-red-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
            </svg>
          </div>
        </div>
      </div>

      <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <p class="text-sm font-medium text-gray-600 mb-1">Reserved</p>
            <p class="text-3xl font-bold text-gray-900">{stats.reserved}</p>
            <p class="text-xs text-gray-500 mt-1">Pending pickup</p>
          </div>
          <div class="p-3 bg-amber-100 rounded-lg">
            <svg class="h-6 w-6 text-amber-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"/>
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- Search and Filters -->
    <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <!-- Search Bar -->
      <div class="mb-4">
        <div class="relative">
          <svg class="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/>
            <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Search by book title, member name, ID..."
            bind:value={searchTerm}
            class="pl-12 pr-4 py-3 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200"
          />
        </div>
      </div>

      <!-- Mobile Filter Toggle -->
      <div class="sm:hidden mb-4">
        <button
          on:click={() => showFilters = !showFilters}
          class="w-full flex items-center justify-between px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
        >
          <span class="flex items-center font-medium text-gray-700">
            <svg class="h-5 w-5 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z"/>
            </svg>
            Filters & Actions
          </span>
          <svg class={`h-5 w-5 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
      </div>

      <!-- Filters -->
      <div class={`${showFilters ? 'block' : 'hidden'} sm:block`}>
        <div class="flex flex-col sm:flex-row gap-3">
          <select
            bind:value={selectedType}
            class="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 flex-1 sm:flex-none"
          >
            {#each transactionTypes as type}
              <option value={type}>
                {type === 'all' ? 'All Types' : type}
              </option>
            {/each}
          </select>
          <select
            bind:value={selectedStatus}
            class="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 flex-1 sm:flex-none"
          >
            {#each transactionStatuses as status}
              <option value={status}>
                {status === 'all' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            {/each}
          </select>
          <button class="px-5 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center transition-all duration-200 font-medium text-gray-700">
            <svg class="h-5 w-5 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>
            </svg>
            Export
          </button>
        </div>
      </div>
    </div>

    <!-- Desktop Table View -->
    <div class="hidden lg:block bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Transaction
              </th>
              <th class="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Book
              </th>
              <th class="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Member
              </th>
              <th class="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Timeline
              </th>
              <th class="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Status
              </th>
              <th class="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each filteredTransactions as transaction}
              <tr class="hover:bg-slate-50 transition-colors duration-150">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex flex-col">
                    <span class="text-sm font-semibold text-gray-900">#{transaction.id.toString().padStart(6, '0')}</span>
                    <span class={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border mt-2 w-fit ${getTypeColor(transaction.type)}`}>
                      {transaction.type}
                    </span>
                  </div>
                </td>
                <td class="px-6 py-4">
                  <div class="flex items-start">
                    <div class="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-slate-100 rounded-lg mr-3">
                      <svg class="h-6 w-6 text-slate-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/>
                      </svg>
                    </div>
                    <div>
                      <div class="text-sm font-medium text-gray-900">{transaction.bookTitle}</div>
                      <div class="text-xs text-gray-500">ID: {transaction.bookId || 'N/A'}</div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-slate-100 rounded-full mr-3">
                      <span class="text-sm font-semibold text-slate-700">
                        {transaction.memberName?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div>
                      <div class="text-sm font-medium text-gray-900">{transaction.memberName}</div>
                      <div class="text-xs text-gray-500">{transaction.memberId || 'N/A'}</div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4">
                  <div class="space-y-2">
                    <div class="flex items-center text-xs">
                      <svg class="h-4 w-4 mr-2 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>
                      </svg>
                      <span class="text-gray-600 font-medium">Start:</span>
                      <span class="ml-1 text-gray-900">{formatDate(transaction.borrowDate)}</span>
                    </div>
                    <div class="flex items-center text-xs">
                      <svg class="h-4 w-4 mr-2 text-amber-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>
                      </svg>
                      <span class="text-gray-600 font-medium">Due:</span>
                      <span class="ml-1 text-gray-900">{formatDate(transaction.dueDate)}</span>
                      {#if transaction.status?.toLowerCase() === 'borrowed'}
                        {@const daysLeft = calculateDaysRemaining(transaction.dueDate)}
                        {#if daysLeft !== null}
                          <span class={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium
                            ${daysLeft < 0 ? 'bg-red-100 text-red-700' :
                            daysLeft <= 3 ? 'bg-amber-100 text-amber-700' :
                            'bg-green-100 text-green-700'}`}>
                            {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                          </span>
                        {/if}
                      {/if}
                    </div>
                    {#if transaction.returnDate}
                      <div class="flex items-center text-xs">
                        <svg class="h-4 w-4 mr-2 text-emerald-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <span class="text-gray-600 font-medium">Returned:</span>
                        <span class="ml-1 text-emerald-600 font-medium">{formatDate(transaction.returnDate)}</span>
                      </div>
                    {/if}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border ${getStatusColor(transaction.status)}`}>
                    {transaction.status?.charAt(0).toUpperCase() + transaction.status?.slice(1)}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex gap-2">
                    {#if transaction.type?.toLowerCase() === 'borrow' && (transaction.status?.toLowerCase() === 'borrowed' || transaction.status?.toLowerCase() === 'overdue')}
                      <button
                        class="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-xs font-medium"
                        on:click={() => openReturnModal(transaction)}
                      >
                        Return
                      </button>
                    {/if}
                    {#if transaction.type?.toLowerCase() === 'reserve' && transaction.status?.toLowerCase() === 'active'}
                      <button
                        class="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium"
                        on:click={() => openConfirmBorrowModal(transaction)}
                      >
                        Confirm
                      </button>
                    {/if}
                    <button
                      class="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-medium"
                      on:click={() => handleDelete(transaction.id)}
                    >
                      Delete
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
    <div class="lg:hidden space-y-4">
      {#each filteredTransactions as transaction}
        <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
          <!-- Header -->
          <div class="flex items-start justify-between mb-4">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-sm font-bold text-gray-900">#{transaction.id.toString().padStart(6, '0')}</span>
                <span class={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getTypeColor(transaction.type)}`}>
                  {transaction.type}
                </span>
              </div>
              <h3 class="text-base font-semibold text-gray-900 leading-snug mb-1">{transaction.bookTitle}</h3>
              <p class="text-xs text-gray-500">Book ID: {transaction.bookId || 'N/A'}</p>
            </div>
            <span class={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border ${getStatusColor(transaction.status)}`}>
              {transaction.status?.charAt(0).toUpperCase() + transaction.status?.slice(1)}
            </span>
          </div>

          <!-- Member Info -->
          <div class="flex items-center mb-4 pb-4 border-b border-gray-100">
            <div class="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-slate-100 rounded-full mr-3">
              <span class="text-sm font-semibold text-slate-700">
                {transaction.memberName?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-900">{transaction.memberName}</p>
              <p class="text-xs text-gray-500">{transaction.memberId || 'N/A'}</p>
            </div>
          </div>

          <!-- Timeline -->
          <div class="space-y-2 mb-4">
            <div class="flex items-center text-xs">
              <svg class="h-4 w-4 mr-2 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>
              </svg>
              <span class="text-gray-600 font-medium">Start:</span>
              <span class="ml-1 text-gray-900">{formatDate(transaction.borrowDate)}</span>
            </div>
            <div class="flex items-center text-xs">
              <svg class="h-4 w-4 mr-2 text-amber-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>
              </svg>
              <span class="text-gray-600 font-medium">Due:</span>
              <span class="ml-1 text-gray-900">{formatDate(transaction.dueDate)}</span>
            </div>
            {#if transaction.status?.toLowerCase() === 'borrowed'}
              {@const daysLeft = calculateDaysRemaining(transaction.dueDate)}
              {#if daysLeft !== null}
                <div class="flex items-center">
                  <span class={`px-2.5 py-1 rounded-full text-xs font-medium
                    ${daysLeft < 0 ? 'bg-red-100 text-red-700' :
                    daysLeft <= 3 ? 'bg-amber-100 text-amber-700' :
                    'bg-green-100 text-green-700'}`}>
                    {daysLeft < 0 ? `${Math.abs(daysLeft)} days overdue` : `${daysLeft} days remaining`}
                  </span>
                </div>
              {/if}
            {/if}
            {#if transaction.returnDate}
              <div class="flex items-center text-xs">
                <svg class="h-4 w-4 mr-2 text-emerald-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span class="text-gray-600 font-medium">Returned:</span>
                <span class="ml-1 text-emerald-600 font-medium">{formatDate(transaction.returnDate)}</span>
              </div>
            {/if}
          </div>

          <!-- Action Buttons -->
          <div class="flex flex-col gap-2">
            {#if transaction.type?.toLowerCase() === 'borrow' && transaction.status?.toLowerCase() === 'borrowed'}
              <button
                class="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors duration-200 text-sm font-medium shadow-sm"
                on:click={() => openReturnModal(transaction)}
              >
                Return Book
              </button>
            {/if}
            {#if transaction.type?.toLowerCase() === 'reserve' && transaction.status?.toLowerCase() === 'active'}
              <button
                class="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm font-medium shadow-sm"
                on:click={() => openConfirmBorrowModal(transaction)}
              >
                Confirm Borrow
              </button>
            {/if}
            <button
              class="w-full px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 text-sm font-medium shadow-sm"
              on:click={() => handleDelete(transaction.id)}
            >
              Delete Transaction
            </button>
          </div>
        </div>
      {/each}
    </div>

    <!-- Pagination -->
    <div class="bg-white px-6 py-4 border border-gray-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
      <div class="text-sm text-gray-700 order-2 sm:order-1">
        Showing <span class="font-semibold">1</span> to <span class="font-semibold">{filteredTransactions.length}</span> of
        <span class="font-semibold">{filteredTransactions.length}</span> results
      </div>
      <nav class="relative z-0 inline-flex rounded-lg shadow-sm -space-x-px order-1 sm:order-2">
        <button class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-l-lg text-gray-500 bg-white hover:bg-slate-50 transition-colors duration-200">
          <svg class="h-5 w-5 sm:mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          <span class="hidden sm:inline">Previous</span>
        </button>
        <button class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800">
          1
        </button>
        <button class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-r-lg text-gray-500 bg-white hover:bg-slate-50 transition-colors duration-200">
          <span class="hidden sm:inline">Next</span>
          <svg class="h-5 w-5 sm:ml-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </nav>
    </div>
  </div>

  <!-- Confirm Borrow Modal as component -->
  <ConfirmBorrowModal
    open={showConfirmBorrowModal}
    transaction={selectedTransaction}
    bind:customDueDate
    on:close={closeConfirmBorrowModal}
    on:confirm={() => confirmBorrow()}
  />

  <!-- Return Book Modal as component -->
  <ReturnBookModal
    open={showReturnModal}
    transaction={selectedTransaction}
    on:close={closeReturnModal}
    on:confirm={handleReturnModalConfirm}
  />
</Layout>