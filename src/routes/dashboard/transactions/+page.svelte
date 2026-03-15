<script lang="ts">
  import ConfirmBorrowModal from "$lib/components/ui/transaction/ConfirmBorrowModal.svelte";
  import ReturnBookModal from "$lib/components/ui/transaction/ReturnBookModal.svelte";
  import CustomDateRangeModal from "$lib/components/ui/transaction/CustomDateRangeModal.svelte";
  import TransactionViewModal from "$lib/components/ui/transaction/TransactionViewModal.svelte";
  import { onMount } from "svelte";
  export let data: any = {};

  import { writable } from 'svelte/store';
  import { tweened } from 'svelte/motion';

  const ROWS_PER_PAGE = 20;
  const MAX_PAGE_BUTTONS = 5;

  // Must match FULFILLMENT_DELAY_MS in the API server
  const REVERSAL_WINDOW_MS = 60 * 60 * 1000; // 1 hour

  const RESERVATION_OPEN_STATUSES   = ['pending', 'approved'];
  const RESERVATION_CLOSED_STATUSES = ['fulfilled', 'cancelled', 'rejected', 'expired'];

  function isOpenReservation(t: Transaction) {
    return t.type === 'reserve' && RESERVATION_OPEN_STATUSES.includes(t.status?.toLowerCase() || '');
  }

  let searchTerm = "";
  let selectedItemType = 'all';
  let loading = false;

  let debouncedSearchTerm = "";
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  let totalAnimated    = tweened(0, { duration: 1000 });
  let borrowedAnimated = tweened(0, { duration: 1000 });
  let returnedAnimated = tweened(0, { duration: 1000 });
  let overdueAnimated  = tweened(0, { duration: 1000 });
  let reservedAnimated = tweened(0, { duration: 1000 });

  $: if (searchTerm !== undefined) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { debouncedSearchTerm = searchTerm; }, 300);
  }

  const exportDropdownOpen   = writable(false);
  const selectedExportFormat = writable('pdf');
  const EXPORT_FORMATS = [
    { v: 'pdf',   label: 'PDF',   icon: 'FileText',        colorClass: 'text-red-500'   },
    { v: 'excel', label: 'Excel', icon: 'FileSpreadsheet', colorClass: 'text-green-500' }
  ];

  async function handleExport() {
    try {
      const format = $selectedExportFormat;
      const params = new URLSearchParams({ format, search: searchTerm, tab: activeTab, period: selectedPeriod, customDays });
      const res = await fetch(`/api/transactions/export?${params}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `transactions_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      link.click();
    } catch { alert('Export failed.'); }
  }

  async function fetchTransactions(page = 1, limit = ROWS_PER_PAGE, params: Record<string, any> = {}) {
    const url = new URL('/api/transactions', window.location.origin);
    url.searchParams.set('page', page.toString());
    url.searchParams.set('limit', limit.toString());
    if (params.search)     url.searchParams.set('search',     params.search);
    if (params.tab)        url.searchParams.set('tab',        params.tab);
    if (params.period)     url.searchParams.set('period',     params.period);
    if (params.customDays) url.searchParams.set('customDays', params.customDays);
    if (params.itemType)   url.searchParams.set('itemType',   params.itemType);
    const res = await fetch(url.toString(), { credentials: 'include' });
    return res.json();
  }

  let activeTab        = "all";
  let selectedPeriod   = "all";
  let showFilters      = false;
  let dropdownOpen     = false;
  let itemTypeDropdownOpen = false;
  let customDays       = "";
  let initializedFromUrl = false;
  let highlightedTransactionId: number | null = null;

  let showCustomDateModal = false;
  let customDaysLabel     = "";

  let showConfirmBorrowModal = false;
  let showReturnModal        = false;
  let showViewModal          = false;
  let selectedTransaction: Transaction | null = null;
  let viewTransaction: Transaction | null     = null;
  let customDueDate = "";

  let returnVerification = { method: "password", password: "", qrData: "", fine: 0 };

  // ── Seed from server — eliminates the double-fetch on first load ─────────────
  let transactions: any[]      = data.transactions     || [];
  let statsTransactions: any[] = data.statsTransactions || data.transactions || [];
  let fineSettings: any | null = data.fineSettings     || null;
  let totalCount: number | null = data.totalCount      ?? null;

  let serverPage  = 1;
  let serverLimit = ROWS_PER_PAGE;

  async function loadPage(page = 1) {
    loading = true;
    try {
      const json = await fetchTransactions(page, serverLimit, {
        search: debouncedSearchTerm, tab: activeTab, period: selectedPeriod, customDays, itemType: selectedItemType
      });

      if (json.total != null) {
        totalCount = json.total;
      }

      const computedTotalPages = Math.max(1, Math.ceil((totalCount ?? 0) / ROWS_PER_PAGE));
      if (page > computedTotalPages) {
        // requested page is out of range after filter change (e.g. switched from 2 pages to 1)
        return loadPage(1);
      }

      transactions = json.transactions || [];
      serverPage = page;
      currentPage = page;

      if (activeTab !== 'all') {
        const statsJson = await fetchTransactions(1, serverLimit, {
          search: debouncedSearchTerm, period: selectedPeriod, customDays, itemType: selectedItemType
        });
        statsTransactions = statsJson.transactions || [];
      } else {
        statsTransactions = transactions;
      }
    } catch (err) {
      console.error('Load page error:', err);
    } finally {
      loading = false;
    }
  }

  async function loadMore() {
    if (totalCount !== null && serverPage >= totalPages) return;
    await loadPage(serverPage + 1);
  }

  function getPageNumbers(): number[] {
    const half = Math.floor(MAX_PAGE_BUTTONS / 2);
    let start = Math.max(1, currentPage - half);
    let end = start + MAX_PAGE_BUTTONS - 1;
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, totalPages - MAX_PAGE_BUTTONS + 1);
    }
    const pages: number[] = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  const tabs = [
    { id: 'all',       label: 'All Transactions', icon: 'list'     },
    { id: 'borrow',    label: 'Borrow',            icon: 'download' },
    { id: 'return',    label: 'Return',             icon: 'upload'   },
    { id: 'reserve',   label: 'Reserve',            icon: 'bookmark' },
    { id: 'fulfilled', label: 'Fulfilled',          icon: 'check'    },
    { id: 'cancelled', label: 'Cancelled',          icon: 'x'        },
    { id: 'overdue',   label: 'Overdue',            icon: 'clock'    }
  ];

  const itemTypeOptions = [
    { value: 'all',      label: 'All Types'  },
    { value: 'book',     label: 'Book'       },
    { value: 'magazine', label: 'Magazine'   },
    { value: 'thesis',   label: 'Thesis'     },
    { value: 'journal',  label: 'Journal'    }
  ];

  const periodOptions = [
    { value: 'all',    label: 'All Time'       },
    { value: '7d',     label: 'Last 7 Days'    },
    { value: '30d',    label: 'Last 30 Days'   },
    { value: '90d',    label: 'Last 3 Months'  },
    { value: '365d',   label: 'Last 12 Months' },
    { value: 'custom', label: 'Custom Days'    }
  ];

  interface Transaction {
    id: number;
    itemTitle?: string;
    callNumber?: string;
    userName?: string;
    itemId?: number;
    itemType?: string;
    userId?: number;
    userIdentifier?: string;
    type?: string;
    status: string;
    borrowDate?: string;
    dueDate?: string;
    returnDate?: string;
    createdAt?: string;
    recordKind?: 'borrowing' | 'reservation';
  }

  $: filteredTransactions = transactions;

  function toggleDropdown() { dropdownOpen = !dropdownOpen; }

  function updateUrlParams() {
    try {
      const params = new URLSearchParams();
      params.set('page', currentPage?.toString() || '1');
      if (activeTab        && activeTab        !== 'all') params.set('tab',    activeTab);
      if (selectedItemType && selectedItemType !== 'all') params.set('type',   selectedItemType);
      if (selectedPeriod   && selectedPeriod   !== 'all') params.set('period', selectedPeriod);
      if (customDays)  params.set('days', customDays);
      if (searchTerm)  params.set('q',    searchTerm);
      const newUrl = `${location.pathname}?${params.toString()}${location.hash || ''}`;
      history.replaceState(null, '', newUrl);
    } catch { /* ignore */ }
  }

  function selectPeriod(period: string) {
    selectedPeriod = period;
    dropdownOpen   = false;
    if (period === 'custom') showCustomDateModal = true;
  }

  function selectItemType(val: string) {
    selectedItemType     = val;
    itemTypeDropdownOpen = false;
  }

  function closeCustomDateModal() { showCustomDateModal = false; }

  function handleDateRangeApply(e: CustomEvent) {
    const { label, daysCount } = e.detail;
    customDaysLabel = label;
    customDays      = String(daysCount);
  }

  // ─── Status colour helpers ───────────────────────────────────────────────────

  function getStatusColor(status: string) {
    switch (status?.toLowerCase() || '') {
      case 'borrowed':  return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'returned':  return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'overdue':   return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':   return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'approved':  return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'fulfilled': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'rejected':  return 'bg-red-100 text-red-800 border-red-200';
      case 'expired':   return 'bg-gray-100 text-gray-600 border-gray-200';
      default:          return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  function getStatusDot(status: string) {
    switch (status?.toLowerCase() || '') {
      case 'borrowed':  return 'bg-blue-500';
      case 'returned':  return 'bg-emerald-500';
      case 'overdue':   return 'bg-red-500';
      case 'pending':   return 'bg-amber-400';
      case 'approved':  return 'bg-blue-400';
      case 'fulfilled': return 'bg-green-500';
      case 'cancelled': return 'bg-gray-400';
      case 'rejected':  return 'bg-red-400';
      case 'expired':   return 'bg-gray-300';
      default:          return 'bg-gray-400';
    }
  }

  function getTypeColor(type: string) {
    switch (type?.toLowerCase() || '') {
      case 'borrow':  return 'bg-slate-100 text-slate-800 border-slate-200';
      case 'return':  return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'reserve': return 'bg-amber-100 text-amber-800 border-amber-200';
      default:        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  function statusLabel(t: Transaction): string {
    const s = t.status?.toLowerCase() || '';
    if (t.recordKind === 'reservation' && s === 'approved') return 'Active';
    return (t.status?.charAt(0).toUpperCase() ?? '') + (t.status?.slice(1) ?? '');
  }

  function canRevert(transaction: Transaction) {
    if (!transaction.returnDate) return false;
    if (transaction.status?.toLowerCase() !== 'returned') return false;
    return (Date.now() - new Date(transaction.returnDate).getTime()) <= REVERSAL_WINDOW_MS;
  }

  async function revertReturn(transaction: Transaction) {
    if (!confirm('Are you sure you want to undo this return?')) return;
    if (!transaction?.id) return;
    const password = prompt('Enter your password (leave blank if you are an admin)') || '';
    try {
      const res = await fetch(`/api/transactions/${transaction.id}/return/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const resData = await res.json();
      if (!res.ok || !resData.success) throw new Error(resData.message || 'Failed to revert');
      alert('Return successfully reverted.');
      location.reload();
    } catch (err: any) { alert(err.message || 'Unable to revert return.'); }
  }

  function formatDate(dateString: string | undefined | null) {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true
      });
    } catch { return dateString; }
  }

  function formatDateForInput(date: Date) {
    const y  = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const d  = String(date.getDate()).padStart(2, '0');
    const h  = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${mo}-${d}T${h}:${mi}`;
  }

  function formatFinePesos(amount: number) {
    return `₱${Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function calculateDaysRemaining(dueDate: string | undefined | null) {
    if (!dueDate) return null;
    return Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }

  async function handleDelete(transactionId: number) {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    try {
      const res = await fetch(`/api/transactions/${transactionId}`, { method: "DELETE", credentials: 'include' });
      if (res.ok) { alert("Transaction deleted successfully!"); location.reload(); }
      else alert("Failed to delete transaction.");
    } catch { alert("Error deleting transaction."); }
  }

  function openReturnModal(transaction: Transaction) {
    selectedTransaction = transaction;
    showReturnModal     = true;
    returnVerification  = { method: "password", password: "", qrData: "", fine: 0 };
  }

  function openViewModal(transaction: Transaction) {
    viewTransaction = transaction;
    showViewModal   = true;
  }

  function closeViewModal() { showViewModal = false; viewTransaction = null; }

  function closeReturnModal() {
    showReturnModal     = false;
    selectedTransaction = null;
    returnVerification  = { method: "password", password: "", qrData: "", fine: 0 };
  }

  function handleReturnModalConfirm(e: CustomEvent<any>) {
    returnVerification = e.detail;
    confirmReturn();
  }

  async function confirmReturn() {
    if (!selectedTransaction) return;
    try {
      const isAdminCall = returnVerification.method === 'admin'
        || data?.user?.role === 'admin'
        || data?.user?.role === 'super_admin';

      let res;
      if (isAdminCall) {
        res = await fetch(`/api/transactions/return`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemType: selectedTransaction.itemType || 'book',
            borrowingId: selectedTransaction.id,
            copyId: (selectedTransaction as any).copyId ?? undefined,
            qrCodeScanned: returnVerification.qrData,
            condition: 'good', conditionNotes: '', remarks: ''
          }),
          credentials: 'include'
        });
      } else {
        res = await fetch(`/api/transactions/${selectedTransaction.id}/return`, {
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
      }
      const resData = await res.json();
      if (res.ok) {
        let msg = "Book returned successfully!";
        if (resData.data?.callNumber) msg += `\n\nCall No: ${resData.data.callNumber}`;
        if (resData.data?.fine > 0)   msg += `\n\nOverdue Fine: ₱${resData.data.fine}\n\nPlease collect the fine from the member.`;
        alert(msg);
        closeReturnModal();
        location.reload();
      } else {
        if (res.status === 401) { alert("Session expired. Please log in again."); window.location.href = '/'; return; }
        alert(resData.message || "Failed to return book.");
      }
    } catch (err) { console.error('Return error:', err); alert("Error returning book. Please try again."); }
  }

  function openConfirmBorrowModal(transaction: Transaction) {
    selectedTransaction    = transaction;
    const defaultDue       = new Date();
    defaultDue.setHours(defaultDue.getHours() + 24);
    customDueDate          = formatDateForInput(defaultDue);
    showConfirmBorrowModal = true;
  }

  function closeConfirmBorrowModal() {
    showConfirmBorrowModal = false;
    selectedTransaction    = null;
    customDueDate          = "";
  }

  async function confirmBorrow() {
    if (!selectedTransaction) return;
    try {
      const res = await fetch(`/api/transactions/${selectedTransaction.id}/confirm-borrow`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueDate: customDueDate }),
        credentials: 'include'
      });
      if (res.ok) { alert("Reservation confirmed as borrow!"); closeConfirmBorrowModal(); location.reload(); }
      else { const d = await res.json(); alert(d.message || "Failed to confirm borrow."); }
    } catch { alert("Error confirming borrow."); }
  }

  function scrollToHighlighted() {
    if (!highlightedTransactionId) return;
    setTimeout(() => {
      const el = document.querySelector(`[data-transaction-id="${highlightedTransactionId}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => { highlightedTransactionId = null; }, 5000);
    }, 400);
  }

  onMount(async () => {
    // ── Read URL params to sync filter state ──────────────────────────────────
    try {
      const p = new URLSearchParams(window.location.search);
      activeTab        = p.get('tab')    || activeTab;
      selectedItemType = p.get('type')   || selectedItemType;
      selectedPeriod   = p.get('period') || selectedPeriod;
      customDays       = p.get('days')   || customDays;
      searchTerm       = p.get('q')      || searchTerm;
      currentPage      = Number(p.get('page')) || 1;
      serverPage       = currentPage;
      const hId = p.get('highlight');
      if (hId) highlightedTransactionId = Number(hId);
    } catch { /* ignore */ }

    // ── Skip the initial fetch — server already sent data via SSR ────────────
    // `transactions`, `statsTransactions`, `totalCount`, and `fineSettings`
    // are all seeded from `data.*` at declaration time above, so there is
    // nothing to fetch here on first load.  The reactive $: block below will
    // fire whenever the user actually changes a filter.

    scrollToHighlighted();
    initializedFromUrl = true;

    // Session check (non-blocking)
    const res = await fetch('/api/auth/session', { credentials: 'include' });
    if (!res.ok) { alert("Session expired. Please log in again."); window.location.href = '/'; }
  });

  // ── Re-fetch whenever any filter changes (updated to page-based API pagination) ────────────
  $: if (initializedFromUrl) {
    activeTab; selectedItemType; selectedPeriod; customDays; debouncedSearchTerm;
    updateUrlParams();
    currentPage = 1;
    serverPage = 1;
    void loadPage(1);
  }

  let currentPage = 1;
  $: totalPages = Math.max(1, Math.ceil((totalCount ?? 0) / ROWS_PER_PAGE));
  $: pagedTransactions = transactions;

  // ── Stats always from statsTransactions (tab-agnostic) ───────────────────────
  $: stats = {
    total:    statsTransactions.length,
    borrowed: statsTransactions.filter((t: Transaction) => t.status?.toLowerCase() === 'borrowed').length,
    returned: statsTransactions.filter((t: Transaction) => t.status?.toLowerCase() === 'fulfilled').length,
    overdue:  statsTransactions.filter((t: Transaction) => Number((t as any).daysOverdue || 0) > 0 || Number((t as any).hoursOverdue || 0) > 0).length,
    reserved: statsTransactions.filter((t: Transaction) => t.recordKind === 'reservation' && RESERVATION_OPEN_STATUSES.includes(t.status?.toLowerCase() || '')).length,
  };

  $: totalAnimated.set(stats.total);
  $: borrowedAnimated.set(stats.borrowed);
  $: returnedAnimated.set(stats.returned);
  $: overdueAnimated.set(stats.overdue);
  $: reservedAnimated.set(stats.reserved);
</script>

<svelte:head>
  <title>Transactions | E-Kalibro Admin Portal</title>
</svelte:head>

<div class="space-y-2">

  <!-- Header -->
  <div class="mb-2">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">Transaction Management</h2>
        <p class="text-slate-600">Monitor and manage all library transactions</p>
      </div>
    </div>
  </div>

  <!-- Stats Cards -->
  <div class="grid grid-cols-2 gap-1 sm:gap-2 lg:grid-cols-4 mb-2">
    <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
      <div class="flex flex-col items-center text-center">
        <div class="p-2.5 rounded-lg mb-3 bg-gradient-to-br from-blue-400 to-blue-600 shadow-sm">
          <svg class="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/>
          </svg>
        </div>
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Borrowed</p>
        <p class="text-lg sm:text-xl font-bold text-gray-900">{Math.round($borrowedAnimated)}</p>
      </div>
    </div>

    <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
      <div class="flex flex-col items-center text-center">
        <div class="p-2.5 rounded-lg mb-3 bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-sm">
          <svg class="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Returned</p>
        <p class="text-lg sm:text-xl font-bold text-gray-900">{Math.round($returnedAnimated)}</p>
      </div>
    </div>

    <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
      <div class="flex flex-col items-center text-center">
        <div class="p-2.5 rounded-lg mb-3 bg-gradient-to-br from-red-400 to-red-600 shadow-sm">
          <svg class="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
          </svg>
        </div>
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Overdue</p>
        <p class="text-lg sm:text-xl font-bold text-gray-900">{stats.overdue}</p>
      </div>
    </div>

    <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
      <div class="flex flex-col items-center text-center">
        <div class="p-2.5 rounded-lg mb-3 bg-gradient-to-br from-amber-400 to-amber-600 shadow-sm">
          <svg class="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"/>
          </svg>
        </div>
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Reserved</p>
        <p class="text-lg sm:text-xl font-bold text-gray-900">{stats.reserved}</p>
      </div>
    </div>
  </div>

  <!-- Search and Filters -->
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-3 mb-2">

    <div class="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div class="relative flex-1">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="text"
          placeholder="Search by book title, member name, ID..."
          bind:value={searchTerm}
          class="pl-10 pr-4 py-2.5 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 text-sm"
        />
      </div>

      <!-- Desktop controls -->
      <div class="hidden sm:flex items-center gap-2">

        <!-- Period dropdown -->
        <div class="relative">
          <button on:click={toggleDropdown}
            class="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 flex items-center gap-2 hover:bg-gray-50 transition-colors">
            <span>{selectedPeriod === 'custom' ? customDaysLabel || 'Select Dates' : periodOptions.find(p => p.value === selectedPeriod)?.label || 'All Time'}</span>
            <svg class={`h-4 w-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
          </button>
          {#if dropdownOpen}
            <div class="absolute z-10 mt-1 w-48 bg-white border border-gray-300 rounded-lg shadow-lg">
              {#each periodOptions as option}
                <button on:click={() => selectPeriod(option.value)}
                  class={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg transition-colors ${selectedPeriod === option.value ? 'bg-slate-100 text-slate-900 font-medium' : 'text-gray-700'}`}
                >{option.label}</button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Item type dropdown -->
        <div class="relative">
          <button on:click={() => { itemTypeDropdownOpen = !itemTypeDropdownOpen; }}
            class="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 flex items-center gap-2 hover:bg-gray-50 transition-colors">
            <span>{itemTypeOptions.find(o => o.value === selectedItemType)?.label || 'All Types'}</span>
            <svg class={`h-4 w-4 transition-transform ${itemTypeDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
          </button>
          {#if itemTypeDropdownOpen}
            <div class="absolute z-10 mt-1 w-40 bg-white border border-gray-300 rounded-lg shadow-lg">
              {#each itemTypeOptions as opt}
                <button on:click={() => selectItemType(opt.value)}
                  class={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg transition-colors ${selectedItemType === opt.value ? 'bg-slate-100 text-slate-900 font-medium' : 'text-gray-700'}`}
                >{opt.label}</button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Export dropdown -->
        <div class="relative">
          <button on:click={() => exportDropdownOpen.update(v => !v)}
            class="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-sm rounded-lg shadow-sm hover:bg-gray-50 transition-colors">
            <svg class="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 16v4m0 0l-3-3m3 3l3-3M4 12h16M4 8h16"/></svg>
            Export {$selectedExportFormat.toUpperCase()}
            <svg class={`h-4 w-4 text-gray-400 transition-transform ${$exportDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
          </button>
          {#if $exportDropdownOpen}
            <div class="absolute right-0 z-20 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg">
              {#each EXPORT_FORMATS as fmt}
                <button on:click={() => { selectedExportFormat.set(fmt.v); exportDropdownOpen.set(false); handleExport(); }}
                  class={`w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg flex items-center gap-2 ${$selectedExportFormat === fmt.v ? 'bg-indigo-50 text-indigo-700' : ''}`}>
                  <svg class={`h-4 w-4 ${fmt.colorClass}`} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  {fmt.label}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="border-b border-gray-200 mb-4 -mx-3 px-3">
      <div class="flex gap-0 overflow-x-auto">
        {#each tabs as tab}
          <button on:click={() => activeTab = tab.id}
            class={`px-4 py-3 font-medium text-sm border-b-2 transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
            {#if tab.icon === 'list'}
              <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
            {:else if tab.icon === 'download'}
              <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            {:else if tab.icon === 'upload'}
              <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12"/></svg>
            {:else if tab.icon === 'bookmark'}
              <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
            {:else if tab.icon === 'check'}
              <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
            {:else if tab.icon === 'x'}
              <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            {:else if tab.icon === 'clock'}
              <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 6v6l3 3" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            {/if}
            {tab.label}
          </button>
        {/each}
      </div>
    </div>

    <!-- Mobile filter toggle -->
    <div class="sm:hidden mb-3">
      <button on:click={() => showFilters = !showFilters}
        class="w-full flex items-center justify-between px-3 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm">
        <span class="flex items-center font-medium text-gray-700">
          <svg class="h-5 w-5 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z"/>
          </svg>
          Filters
        </span>
        <svg class={`h-5 w-5 transition-transform ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
      </button>
    </div>

    <!-- Mobile filters panel -->
    <div class={`${showFilters ? 'block' : 'hidden'} sm:hidden`}>
      <div class="flex flex-col gap-2">
        <div class="relative">
          <button on:click={toggleDropdown}
            class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 flex items-center justify-between">
            <span>{selectedPeriod === 'custom' ? customDaysLabel || 'Select Dates' : periodOptions.find(p => p.value === selectedPeriod)?.label || 'All Time'}</span>
            <svg class={`h-4 w-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
          </button>
          {#if dropdownOpen}
            <div class="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg">
              {#each periodOptions as option}
                <button on:click={() => selectPeriod(option.value)}
                  class={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg transition-colors ${selectedPeriod === option.value ? 'bg-slate-100 text-slate-900 font-medium' : 'text-gray-700'}`}
                >{option.label}</button>
              {/each}
            </div>
          {/if}
        </div>

        <div class="relative">
          <button on:click={() => { itemTypeDropdownOpen = !itemTypeDropdownOpen; }}
            class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 flex items-center justify-between">
            <span>{itemTypeOptions.find(o => o.value === selectedItemType)?.label || 'All Types'}</span>
            <svg class={`h-4 w-4 transition-transform ${itemTypeDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
          </button>
          {#if itemTypeDropdownOpen}
            <div class="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg">
              {#each itemTypeOptions as opt}
                <button on:click={() => selectItemType(opt.value)}
                  class={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg transition-colors ${selectedItemType === opt.value ? 'bg-slate-100 text-slate-900 font-medium' : 'text-gray-700'}`}
                >{opt.label}</button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- ===================== DESKTOP TABLE ===================== -->
  <div class="hidden lg:block mb-2">
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

      <div class="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-gray-50/60">
        <p class="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
        </p>
        <div class="flex items-center gap-1.5">
          <span class="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span class="text-xs text-gray-400 font-medium">Live</span>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full">
          <thead>
            <tr class="border-b border-gray-100">
              <th class="pl-6 pr-3 py-3.5 text-left"><span class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">ID / Type</span></th>
              <th class="px-3 py-3.5 text-left"><span class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Item</span></th>
              <th class="px-3 py-3.5 text-left"><span class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Member</span></th>
              <th class="px-4 py-3.5 text-left"><span class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Timeline</span></th>
              <th class="px-2.5 py-3.5 text-left"><span class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Status</span></th>
              <th class="pl-3 pr-6 py-3.5 text-right"><span class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Actions</span></th>
            </tr>
          </thead>

          <tbody class="divide-y divide-gray-50">
            {#if loading && pagedTransactions.length === 0}
              {#each Array(10) as _}
                <tr class="animate-pulse">
                  <td class="pl-6 pr-3 py-4"><div class="h-4 bg-gray-200 rounded w-16 mb-1"></div><div class="h-3 bg-gray-200 rounded w-12"></div></td>
                  <td class="px-3 py-4"><div class="flex items-center gap-3"><div class="h-9 w-9 bg-gray-200 rounded-xl"></div><div><div class="h-4 bg-gray-200 rounded w-32 mb-1"></div><div class="h-3 bg-gray-200 rounded w-20"></div></div></div></td>
                  <td class="px-3 py-4"><div class="h-4 bg-gray-200 rounded w-24 mb-1"></div><div class="h-3 bg-gray-200 rounded w-16"></div></td>
                  <td class="px-4 py-4"><div class="h-3 bg-gray-200 rounded w-20 mb-1"></div><div class="h-3 bg-gray-200 rounded w-16"></div></td>
                  <td class="px-2.5 py-4"><div class="h-5 bg-gray-200 rounded w-14"></div></td>
                  <td class="pl-3 pr-6 py-4"><div class="flex justify-end gap-1.5"><div class="h-7 w-16 bg-gray-200 rounded"></div><div class="h-7 w-7 bg-gray-200 rounded"></div><div class="h-7 w-7 bg-gray-200 rounded"></div></div></td>
                </tr>
              {/each}
            {:else}
              {#each pagedTransactions as transaction}
                {@const daysLeft     = calculateDaysRemaining(transaction.dueDate)}
                {@const daysOverdue  = Number((transaction as any).daysOverdue  || 0)}
                {@const hoursOverdue = Number((transaction as any).hoursOverdue || 0) || Math.ceil(Number((transaction as any).fine || 0) / 5)}
                {@const isOverdue    = daysOverdue > 0 || hoursOverdue > 0 || (daysLeft !== null && daysLeft < 0)}
                {@const isReservation = transaction.recordKind === 'reservation'}

                <tr
                  data-transaction-id={transaction.id}
                  class="group hover:bg-slate-50/70 transition-colors duration-150
                    {isOverdue ? 'bg-red-50/30' : ''}
                    {highlightedTransactionId === transaction.id ? 'ring-2 ring-inset ring-[#E8B923] bg-amber-50/80' : ''}"
                >

                  <!-- ID + Type -->
                  <td class="pl-6 pr-3 py-4 whitespace-nowrap">
                    <div class="flex flex-col gap-1.5">
                      <span class="font-mono text-sm font-bold text-gray-800 tracking-tight">#{transaction.id.toString().padStart(6, '0')}</span>
                      <span class={`inline-flex w-fit items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wide border ${getTypeColor(transaction.type)}`}>
                        {#if transaction.type?.toLowerCase() === 'borrow'}
                          <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                        {:else if transaction.type?.toLowerCase() === 'return'}
                          <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12"/></svg>
                        {:else}
                          <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
                        {/if}
                        {transaction.type}
                      </span>
                    </div>
                  </td>

                  <!-- Item -->
                  <td class="px-3 py-4 max-w-[220px]">
                    <div class="flex items-center gap-3">
                      <div class="flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-xl bg-slate-100 group-hover:bg-slate-200 transition-colors">
                        <svg class="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/>
                        </svg>
                      </div>
                      <div class="min-w-0">
                        <p class="text-sm font-semibold text-gray-900 truncate leading-tight" title={transaction.itemTitle}>{transaction.itemTitle}</p>
                        <div class="flex items-center gap-2 mt-1">
                          <span class="text-[11px] text-gray-400">#{transaction.itemId || '—'}</span>
                          {#if transaction.itemType}
                            <span class="inline-block h-1 w-1 rounded-full bg-gray-300"></span>
                            <span class="text-[11px] text-gray-400 capitalize">{transaction.itemType}</span>
                          {/if}
                        </div>
                      </div>
                    </div>
                  </td>

                  <!-- Member -->
                  <td class="px-3 py-4 whitespace-nowrap max-w-[150px]">
                    <div class="flex items-center gap-3 min-w-0">
                      <div class="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow-sm">
                        <span class="text-xs font-bold text-white">{transaction.userName?.charAt(0).toUpperCase() || 'U'}</span>
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="text-sm font-medium text-gray-900 truncate max-w-[120px]">{transaction.userName}</p>
                        {#if transaction.userIdentifier}
                          <p class="text-[11px] text-gray-400 font-mono">{transaction.userIdentifier}</p>
                        {:else}
                          <p class="text-[11px] text-gray-400 font-mono">ID {transaction.userId || '—'}</p>
                        {/if}
                      </div>
                    </div>
                  </td>

                  <!-- Timeline -->
                  <td class="px-4 py-4 min-w-[190px]">
                    <div class="space-y-1.5">
                      <div class="flex items-center gap-2">
                        <div class="h-1.5 w-1.5 rounded-full bg-slate-400 flex-shrink-0"></div>
                        <div class="flex items-baseline gap-1.5">
                          <span class="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{isReservation ? 'Requested' : 'Start'}</span>
                          <span class="text-xs text-gray-700 font-medium">{formatDate(transaction.borrowDate)}</span>
                        </div>
                      </div>

                      {#if transaction.dueDate && !transaction.returnDate}
                        <div class="flex items-center gap-2 flex-wrap">
                          <div class="h-1.5 w-1.5 rounded-full {isOverdue ? 'bg-red-400' : 'bg-amber-400'} flex-shrink-0"></div>
                          <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Due</span>
                            <span class="text-xs {isOverdue ? 'text-red-600 font-semibold' : 'text-gray-700 font-medium'}">{formatDate(transaction.dueDate)}</span>
                            {#if hoursOverdue > 0}
                              <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200">
                                {hoursOverdue}h{daysOverdue > 0 ? ` (${daysOverdue}d)` : ''} · {formatFinePesos((transaction as any).fine || 0)}
                              </span>
                            {:else if transaction.status?.toLowerCase() === 'borrowed' && daysLeft !== null}
                              <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border
                                {daysLeft < 0 ? 'bg-red-100 text-red-700 border-red-200' : daysLeft === 0 ? 'bg-amber-100 text-amber-700 border-amber-200' : daysLeft <= 3 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}">
                                {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`}
                              </span>
                            {/if}
                          </div>
                        </div>
                      {/if}

                      {#if transaction.returnDate}
                        <div class="flex items-center gap-2">
                          <div class="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0"></div>
                          <div class="flex items-baseline gap-1.5">
                            <span class="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                              {transaction.status?.toLowerCase() === 'fulfilled' ? 'Fulfilled' : 'Returned'}
                            </span>
                            <span class="text-xs text-emerald-600 font-semibold">{formatDate(transaction.returnDate)}</span>
                          </div>
                        </div>
                      {/if}

                      {#if canRevert(transaction)}
                        {@const elapsed = Date.now() - new Date(transaction.returnDate!).getTime()}
                        {@const minLeft = Math.max(0, Math.ceil((REVERSAL_WINDOW_MS - elapsed) / 60000))}
                        <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <svg class="h-2.5 w-2.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l3 3" stroke-linecap="round"/></svg>
                          Revert window: {minLeft}m left
                        </span>
                      {/if}
                    </div>
                  </td>

                  <!-- Status -->
                  <td class="px-1.5 py-4 whitespace-nowrap">
                    <div class="flex items-center gap-0.5">
                      <span class="h-2 w-2 rounded-full flex-shrink-0 {getStatusDot(transaction.status)}"></span>
                      <span class={`inline-flex items-center px-1 py-1 rounded-lg text-xs font-semibold border ${getStatusColor(transaction.status)}`}>
                        {statusLabel(transaction)}
                      </span>
                    </div>
                  </td>

                  <!-- Actions -->
                  <td class="pl-3 pr-6 py-4 whitespace-nowrap text-right">
                    <div class="flex items-center justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity duration-150">

                      <!-- Return -->
                      {#if !isReservation && transaction.type?.toLowerCase() === 'borrow' && (transaction.status?.toLowerCase() === 'borrowed' || transaction.status?.toLowerCase() === 'overdue')}
                        <button
                          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold transition-all shadow-sm"
                          on:click={() => openReturnModal(transaction)}
                        >
                          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"/></svg>
                          Return
                        </button>
                      {/if}

                      <!-- Revert return (within 1-hour window) -->
                      {#if canRevert(transaction)}
                        <button
                          title="Undo this return (available for 1 hour)"
                          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-xs font-semibold transition-all shadow-sm"
                          on:click={() => revertReturn(transaction)}
                        >
                          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"/></svg>
                          Revert
                        </button>
                      {/if}

                      <!-- Confirm borrow: shown for approved OR pending reservations -->
                      {#if isReservation && RESERVATION_OPEN_STATUSES.includes(transaction.status?.toLowerCase() || '')}
                        <button
                          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold transition-all shadow-sm"
                          on:click={() => openConfirmBorrowModal(transaction)}
                        >
                          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                          Confirm
                        </button>
                      {/if}

                      <!-- View -->
                      <button title="View details"
                        class="inline-flex items-center justify-center h-7 w-7 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 active:scale-95 transition-all"
                        on:click={() => openViewModal(transaction)}>
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                          <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                      </button>

                      <!-- Delete -->
                      <button title="Delete transaction"
                        class="inline-flex items-center justify-center h-7 w-7 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 active:scale-95 transition-all"
                        on:click={() => handleDelete(transaction.id)}>
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/>
                        </svg>
                      </button>

                    </div>
                  </td>
                </tr>
              {/each}

              {#if !loading && filteredTransactions.length === 0}
                <tr>
                  <td colspan="6" class="px-6 py-16 text-center">
                    <div class="flex flex-col items-center gap-3">
                      <div class="h-14 w-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                        <svg class="h-7 w-7 text-gray-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
                        </svg>
                      </div>
                      <div>
                        <p class="text-sm font-semibold text-gray-500">No transactions found</p>
                        <p class="text-xs text-gray-400 mt-0.5">Try adjusting your filters or search term</p>
                      </div>
                    </div>
                  </td>
                </tr>
              {/if}
            {/if}
          </tbody>
        </table>
      </div>

      {#if totalPages > 1}
        <div class="px-6 py-2 flex justify-center items-center gap-1 flex-wrap">
          <button class="px-2 py-1 border rounded text-sm disabled:opacity-40" on:click={() => loadPage(1)} disabled={currentPage === 1}>&laquo;</button>
          <button class="px-2 py-1 border rounded text-sm disabled:opacity-40" on:click={() => loadPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>Prev</button>

          {#each getPageNumbers() as pageNum}
            <button
              class="px-2 py-1 border rounded text-sm min-w-[2rem] {pageNum === currentPage ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 hover:bg-gray-100'}"
              on:click={() => loadPage(pageNum)}
              aria-current={pageNum === currentPage ? 'page' : undefined}
            >
              {pageNum}
            </button>
          {/each}

          <button class="px-2 py-1 border rounded text-sm disabled:opacity-40" on:click={() => loadPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>Next</button>
          <button class="px-2 py-1 border rounded text-sm disabled:opacity-40" on:click={() => loadPage(totalPages)} disabled={currentPage === totalPages}>&raquo;</button>
        </div>
      {/if}

      {#if filteredTransactions.length > 0}
        <div class="px-6 py-3 border-t border-gray-100 bg-gray-50/40 flex items-center justify-between flex-wrap gap-2">
          <p class="text-xs text-gray-400">
            Showing <span class="font-semibold text-gray-600">{Math.min(totalCount ?? 0, (currentPage - 1) * ROWS_PER_PAGE + 1)}</span>
            - <span class="font-semibold text-gray-600">{Math.min(totalCount ?? 0, currentPage * ROWS_PER_PAGE)}</span>
            of <span class="font-semibold text-gray-600">{totalCount ?? 0}</span> total transactions
          </p>
          <p class="text-xs text-gray-400">Page <span class="font-semibold text-gray-600">{currentPage}</span> of <span class="font-semibold text-gray-600">{totalPages}</span></p>
        </div>
      {/if}

    </div>
  </div>
  <!-- ===================== END DESKTOP TABLE ===================== -->

  <!-- ===================== MOBILE CARD VIEW ===================== -->
  <div class="lg:hidden space-y-2 mb-2">
    {#if loading && pagedTransactions.length === 0}
      {#each Array(5) as _}
        <div class="bg-white p-3 rounded-xl shadow-sm border border-gray-200 animate-pulse">
          <div class="flex items-start justify-between mb-4">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-2"><div class="h-4 bg-gray-200 rounded w-16"></div><div class="h-5 bg-gray-200 rounded w-12"></div></div>
              <div class="h-5 bg-gray-200 rounded w-32 mb-1"></div>
              <div class="h-3 bg-gray-200 rounded w-20"></div>
            </div>
            <div class="h-6 bg-gray-200 rounded w-16"></div>
          </div>
          <div class="flex items-center mb-4 pb-4 border-b border-gray-100">
            <div class="h-10 w-10 bg-gray-200 rounded-full mr-3"></div>
            <div class="flex-1"><div class="h-4 bg-gray-200 rounded w-24 mb-1"></div><div class="h-3 bg-gray-200 rounded w-16"></div></div>
          </div>
          <div class="space-y-2 mb-4">
            <div class="flex items-center"><div class="h-4 w-4 bg-gray-200 rounded mr-2"></div><div class="h-3 bg-gray-200 rounded w-20"></div></div>
          </div>
          <div class="flex gap-2"><div class="h-8 bg-gray-200 rounded flex-1"></div></div>
        </div>
      {/each}
    {:else if pagedTransactions.length > 0}
      {#each pagedTransactions as transaction}
        {@const isReservation = transaction.recordKind === 'reservation'}
        <div
          data-transaction-id={transaction.id}
          class="bg-white p-3 rounded-xl shadow-sm border transition-shadow duration-200 text-sm
            {highlightedTransactionId === transaction.id
              ? 'border-[#E8B923] ring-2 ring-[#E8B923] bg-amber-50/60 shadow-md'
              : 'border-gray-200 hover:shadow-md'}"
        >
          <!-- Header -->
          <div class="flex items-start justify-between mb-4">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-sm font-bold text-gray-900">#{transaction.id.toString().padStart(6, '0')}</span>
                <span class={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getTypeColor(transaction.type)}`}>{transaction.type}</span>
              </div>
              <h3 class="text-base font-semibold text-gray-900 leading-snug mb-1">{transaction.itemTitle}</h3>
              <p class="text-xs text-gray-500">Item ID: {transaction.itemId || 'N/A'}</p>
              <p class="text-xs text-slate-500 mt-1">Type: {transaction.itemType ? transaction.itemType.charAt(0).toUpperCase() + transaction.itemType.slice(1) : 'N/A'}</p>
            </div>
            <span class={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border ${getStatusColor(transaction.status)}`}>
              {statusLabel(transaction)}
            </span>
          </div>

          <!-- Member -->
          <div class="flex items-center mb-4 pb-4 border-b border-gray-100">
            <div class="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-slate-100 rounded-full mr-3">
              <span class="text-sm font-semibold text-slate-700">{transaction.userName?.charAt(0).toUpperCase() || 'U'}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 truncate">{transaction.userName}</p>
              <p class="text-xs text-gray-500">{transaction.userIdentifier || transaction.userId || 'N/A'}</p>
            </div>
          </div>

          <!-- Timeline -->
          <div class="space-y-2 mb-4">
            <div class="flex items-center text-xs">
              <svg class="h-4 w-4 mr-2 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg>
              <span class="text-gray-600 font-medium">{isReservation ? 'Requested:' : 'Start:'}</span>
              <span class="ml-1 text-gray-900">{formatDate(transaction.borrowDate)}</span>
            </div>

            <div class="flex items-center gap-2 flex-wrap text-xs">
              <svg class="h-4 w-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg>
              <span class="text-gray-600 font-medium">Due:</span>
              <span class="text-gray-900">{formatDate(transaction.dueDate)}</span>
              {#if !isReservation && transaction.status?.toLowerCase() === 'borrowed'}
                {@const dl = calculateDaysRemaining(transaction.dueDate)}
                {#if dl !== null}
                  <span class={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${dl < 0 ? 'bg-red-100 text-red-700 border-red-200' : dl === 0 ? 'bg-amber-100 text-amber-700 border-amber-200' : dl <= 3 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-green-100 text-green-700 border-green-200'}`}>
                    {dl < 0 ? `${Math.abs(dl)}d overdue` : dl === 0 ? 'Due today' : `${dl}d left`}
                  </span>
                {/if}
              {/if}
            </div>

            {#if transaction.returnDate}
              <div class="flex items-center text-xs">
                <svg class="h-4 w-4 mr-2 text-emerald-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <span class="text-gray-600 font-medium">{transaction.status?.toLowerCase() === 'fulfilled' ? 'Fulfilled:' : 'Returned:'}</span>
                <span class="ml-1 text-emerald-600 font-medium">{formatDate(transaction.returnDate)}</span>
              </div>
            {/if}

            {#if canRevert(transaction)}
              {@const elapsed = Date.now() - new Date(transaction.returnDate!).getTime()}
              {@const minLeft = Math.max(0, Math.ceil((REVERSAL_WINDOW_MS - elapsed) / 60000))}
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l3 3" stroke-linecap="round"/></svg>
                Revert window: {minLeft}m left
              </span>
            {/if}
          </div>

          <!-- Actions -->
          <div class="flex flex-col gap-2">
            <button class="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
              on:click={() => openViewModal(transaction)}>View Details</button>

            {#if !isReservation && transaction.type?.toLowerCase() === 'borrow' && (transaction.status?.toLowerCase() === 'borrowed' || transaction.status?.toLowerCase() === 'overdue')}
              <button class="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium shadow-sm"
                on:click={() => openReturnModal(transaction)}>Return Book</button>
            {/if}

            {#if canRevert(transaction)}
              <button class="w-full px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium shadow-sm"
                on:click={() => revertReturn(transaction)}>Revert Return</button>
            {/if}

            <!-- Confirm borrow: pending or approved reservations -->
            {#if isReservation && RESERVATION_OPEN_STATUSES.includes(transaction.status?.toLowerCase() || '')}
              <button class="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
                on:click={() => openConfirmBorrowModal(transaction)}>Confirm Borrow</button>
            {/if}

            <button class="w-full px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium shadow-sm"
              on:click={() => handleDelete(transaction.id)}>Delete Transaction</button>
          </div>
        </div>
      {/each}
    {/if}

    {#if !loading && pagedTransactions.length === 0}
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center text-sm text-gray-500">
        <p class="font-semibold text-slate-600">No transactions found</p>
        <p class="text-xs text-slate-400">Try adjusting your filters or search term.</p>
      </div>
    {/if}

    <!-- Mobile pagination -->
    <div class="flex justify-center items-center gap-2 mt-2">
      <button class="px-2 py-1 border rounded text-sm disabled:opacity-40" on:click={() => currentPage = Math.max(1, currentPage - 1)} disabled={currentPage === 1}>Prev</button>
      <span class="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
      <button class="px-2 py-1 border rounded text-sm disabled:opacity-40" on:click={() => currentPage = Math.min(totalPages, currentPage + 1)} disabled={currentPage === totalPages}>Next</button>
    </div>

    {#if totalCount !== null && transactions.length < totalCount}
      <div class="flex justify-center mt-2">
        <button class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm" on:click={loadMore}>Load more</button>
      </div>
    {/if}
  </div>
  <!-- ===================== END MOBILE CARD VIEW ===================== -->

</div>

<!-- Modals -->
<CustomDateRangeModal bind:open={showCustomDateModal} on:apply={handleDateRangeApply} />

<ConfirmBorrowModal
  open={showConfirmBorrowModal}
  user={data?.user}
  transaction={selectedTransaction}
  bind:customDueDate
  on:close={closeConfirmBorrowModal}
  on:confirm={() => confirmBorrow()}
/>

<ReturnBookModal
  open={showReturnModal}
  user={data?.user}
  transaction={selectedTransaction}
  on:close={closeReturnModal}
  on:confirm={handleReturnModalConfirm}
/>

<TransactionViewModal
  open={showViewModal}
  transaction={viewTransaction}
  on:close={closeViewModal}
/>