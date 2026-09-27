<script lang="ts">
  import ConfirmBorrowModal from "$lib/components/ui/transaction/ConfirmBorrowModal.svelte";
  import ReturnBookModal from "$lib/components/ui/transaction/ReturnBookModal.svelte";
  import CustomDateRangeModal from "$lib/components/ui/transaction/CustomDateRangeModal.svelte";
  import TransactionViewModal from "$lib/components/ui/transaction/TransactionViewModal.svelte";
  import { onMount } from "svelte";
  export let data: any = {};

  import { writable } from 'svelte/store';
  import { tweened } from 'svelte/motion';

  // pagination constant used by server/clientside helpers
  const ROWS_PER_PAGE = 100;

  let searchTerm = "";
  // status filter removed because tabs handle status
  let selectedItemType = 'all';

  // loading state for table
  let loading = false;

  // debounced search
  let debouncedSearchTerm = "";
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  // animated stats
  let totalAnimated = tweened(0, { duration: 1000 });
  let borrowedAnimated = tweened(0, { duration: 1000 });
  let returnedAnimated = tweened(0, { duration: 1000 });
  let overdueAnimated = tweened(0, { duration: 1000 });
  let reservedAnimated = tweened(0, { duration: 1000 });

  // Debounce search term
  $: if (searchTerm !== undefined) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debouncedSearchTerm = searchTerm;
    }, 300);
  }

  // export dropdown state (styled like reports page)
  const exportDropdownOpen = writable(false);
  const selectedExportFormat = writable('pdf');
  const EXPORT_FORMATS = [
    { v: 'pdf', label: 'PDF', icon: 'FileText', colorClass: 'text-red-500' },
    { v: 'excel', label: 'Excel', icon: 'FileSpreadsheet', colorClass: 'text-green-500' }
  ];

  async function handleExport() {
    try {
      // adjust endpoint as needed
      const format = $selectedExportFormat;
      const params = new URLSearchParams({
        format,
        search: searchTerm,
        tab: activeTab,
        period: selectedPeriod,
        customDays
      });
      const res = await fetch(`/api/transactions/export?${params}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `transactions_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      link.click();
    } catch (err) {
      alert('Export failed.');
    }
  }

  async function fetchTransactions(page = 1, limit = 500, params: Record<string, any> = {}) {
    const url = new URL('/api/transactions', window.location.origin);
    url.searchParams.set('page', page.toString());
    url.searchParams.set('limit', limit.toString());
    if (params.search) url.searchParams.set('search', params.search);
    if (params.tab) url.searchParams.set('tab', params.tab);
    if (params.period) url.searchParams.set('period', params.period);
    if (params.customDays) url.searchParams.set('customDays', params.customDays);
    if (params.itemType) url.searchParams.set('itemType', params.itemType);
    const res = await fetch(url);
    const json = await res.json();
    return json;
  }

  let activeTab = "all";
  let selectedPeriod = "all";
  let showFilters = false;
  let dropdownOpen = false;
  let itemTypeDropdownOpen = false;
  let customDays = "";
  let initializedFromUrl = false;

  // Custom date range modal states
  let showCustomDateModal = false;
  let customDaysLabel = "";

  // Modal states
  let showConfirmBorrowModal = false;
  let showReturnModal = false;
  let showViewModal = false;
  let selectedTransaction: Transaction | null = null;
  let viewTransaction: Transaction | null = null;
  let customDueDate = "";

  // Track modal verification
  let returnVerification = { method: "password", password: "", qrData: "", fine: 0 };

  // Use transactions from server data
  let transactions: any[] = [];
  let fineSettings: any | null = data.fineSettings || null;

  // server pagination info (initial values provided by +page.server)
  let serverPage = data.page || 1;
  let serverLimit = data.limit || ROWS_PER_PAGE;
  let totalCount: number | null = data.total ?? null;

  // client-side helpers formerly on server
  function isDateExemptClient(date: Date, settings: any | null) {
    if (!settings) return false;
    const ymd = date.toISOString().split('T')[0];
    if (settings.holidays && Array.isArray(settings.holidays)) {
      for (const h of settings.holidays) {
        if (h && h.date === ymd) return true;
      }
    }
    const wd = date.getDay();
    if (settings.closedWeekdays && Array.isArray(settings.closedWeekdays) && settings.closedWeekdays.includes(wd)) return true;
    if (settings.excludeSundays && wd === 0) return true;
    return false;
  }

  function calculateFineAmountClient(dueDate: Date, currentDate: Date = new Date(), settings: any | null = null) {
    if (currentDate <= dueDate) return 0;
    const end = new Date(currentDate);
    const diffMs = end.getTime() - dueDate.getTime();
    let totalHoursElapsed = Math.ceil(diffMs / (1000 * 60 * 60));
    let exemptHours = 0;
    const cursor = new Date(dueDate);
    while (cursor < end) {
      const dayStart = new Date(cursor);
      dayStart.setHours(0, 0, 0, 0);
      if (isDateExemptClient(dayStart, settings)) {
        exemptHours += 1;
      }
      cursor.setHours(cursor.getHours() + 1);
    }
    const totalNonExemptHours = Math.max(0, totalHoursElapsed - exemptHours);
    return totalNonExemptHours * 5;
  }

  function calculateDaysOverdueClient(dueDate: Date, currentDate: Date = new Date(), settings: any | null = null) {
    const normalizedDueDate = new Date(dueDate);
    normalizedDueDate.setUTCHours(0, 0, 0, 0);
    const normalizedCurrentDate = new Date(currentDate);
    normalizedCurrentDate.setUTCHours(0, 0, 0, 0);
    if (normalizedCurrentDate <= normalizedDueDate) return 0;
    const cursor = new Date(dueDate);
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
    let count = 0;
    const end = new Date(currentDate);
    while (cursor <= end) {
      if (!isDateExemptClient(cursor, settings)) count++;
      cursor.setDate(cursor.getDate() + 1);
    }
    return count;
  }

  async function loadMore() {
    if (totalCount !== null && transactions.length >= totalCount) return;
    loading = true;
    try {
      const nextPage = serverPage + 1;
      const json = await fetchTransactions(nextPage, 500, {
        search: debouncedSearchTerm,
        tab: activeTab,
        period: selectedPeriod,
        customDays,
        itemType: selectedItemType
      });
      const more: Transaction[] = json.transactions || [];
      transactions.push(...more);
      serverPage = nextPage;
      if (json.total != null) totalCount = json.total;
    } catch (err) {
      console.error('Load more error:', err);
    } finally {
      loading = false;
    }
  }

  const tabs = [
    { id: 'all', label: 'All Transactions', icon: 'list' },
    { id: 'borrow', label: 'Borrow', icon: 'download' },
    { id: 'return', label: 'Return', icon: 'upload' },
    { id: 'reserve', label: 'Reserve', icon: 'bookmark' },
    { id: 'fulfilled', label: 'Fulfilled', icon: 'check' },
    { id: 'cancelled', label: 'Cancelled', icon: 'x' },
    // new filter for items that have gone past their due date
    { id: 'overdue', label: 'Overdue', icon: 'clock' }
  ];
  const itemTypeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'book', label: 'Book' },
    { value: 'magazine', label: 'Magazine' },
    { value: 'thesis', label: 'Thesis' },
    { value: 'journal', label: 'Journal' }
  ];
  const periodOptions = [
    { value: 'all', label: 'All Time' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 3 Months' },
    { value: '365d', label: 'Last 12 Months' },
    { value: 'custom', label: 'Custom Days' }
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
  }

  function getDaysAgo(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }

  function calculateWorkingDays(fromDate: string, toDate: string): number {
    const start = new Date(fromDate);
    const end = new Date(toDate);
    let workingDays = 0;
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) workingDays++;
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return workingDays;
  }

  function calculateDaysUntilDue(dueDate: string): number {
    if (!dueDate) return 0;
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  function isDateInPeriod(dateStr: string | undefined, period: string, customDaysValue?: number): boolean {
    if (!dateStr) return period === 'all' || period === 'custom';
    if (period === 'all') return true;
    try {
      const date = new Date(dateStr);
      if (period === 'custom') {
        if (!customDaysValue || customDaysValue <= 0) return false;
        return date >= getDaysAgo(customDaysValue);
      }
      const daysMap: { [key: string]: number } = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 };
      const days = daysMap[period];
      if (!days) return true;
      return date >= getDaysAgo(days);
    } catch {
      return true;
    }
  }

  $: filteredTransactions = transactions;

  function toggleDropdown() { dropdownOpen = !dropdownOpen; }

  function updateUrlParams() {
    try {
      const params = new URLSearchParams();
      if (activeTab && activeTab !== 'all') params.set('tab', activeTab);
      if (selectedItemType && selectedItemType !== 'all') params.set('type', selectedItemType);
      if (selectedPeriod && selectedPeriod !== 'all') params.set('period', selectedPeriod);
      if (customDays) params.set('days', customDays);
      if (searchTerm) params.set('q', searchTerm);
      const newUrl = `${location.pathname}${params.toString() ? '?' + params.toString() : ''}${location.hash || ''}`;
      history.replaceState(null, '', newUrl);
    } catch (err) {
      // ignore URL update errors in non-browser contexts
    }
  }

  function selectPeriod(period: string) {
    selectedPeriod = period;
    dropdownOpen = false;
    if (period === 'custom') showCustomDateModal = true;
  }


  function selectItemType(val: string) {
    selectedItemType = val;
    itemTypeDropdownOpen = false;
  }

  function closeCustomDateModal() { showCustomDateModal = false; }

  function handleDateRangeApply(e: CustomEvent) {
    const { label, daysCount } = e.detail;
    customDaysLabel = label;
    customDays = String(daysCount);
  }

  function getStatusColor(status: string) {
    const s = status?.toLowerCase() || '';
    switch (s) {
      case 'borrowed':   return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'returned':   return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'overdue':    return 'bg-red-100 text-red-800 border-red-200';
      case 'active':     return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'fulfilled':  return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':  return 'bg-gray-100 text-gray-800 border-gray-200';
      default:           return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  function getStatusDot(status: string) {
    const s = status?.toLowerCase() || '';
    switch (s) {
      case 'borrowed':   return 'bg-blue-500';
      case 'returned':   return 'bg-emerald-500';
      case 'overdue':    return 'bg-red-500';
      case 'active':     return 'bg-amber-500';
      case 'fulfilled':  return 'bg-green-500';
      case 'cancelled':  return 'bg-gray-400';
      default:           return 'bg-gray-400';
    }
  }

  // determine whether a returned transaction is still within the 1‑hour reversal window
  function canRevert(transaction: Transaction) {
    if (!transaction.returnDate) return false;
    const s = transaction.status?.toLowerCase();
    // only items still marked returned are eligible; they will stay returned until
    // staff manually fulfil them (no automatic expiry)
    if (s !== 'returned') return false;
    return true;
  }

  async function revertReturn(transaction: Transaction) {
    if (!confirm('Are you sure you want to undo this return?')) return;
    let password = '';
    if (!transaction || !transaction.id) return;
    // ask for staff/admin password; empty allowed for admins
    // prompt returns string|null so normalize to empty string
    password = prompt('Enter your password (leave blank if you are an admin)') || '';
    try {
      const res = await fetch(`/api/transactions/${transaction.id}/return/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to revert');
      alert('Return successfully reverted.');
      // reload to refresh transactions
      location.reload();
    } catch (err: any) {
      alert(err.message || 'Unable to revert return.');
    }
  }

  function getTypeColor(type: string) {
    const t = type?.toLowerCase() || '';
    switch (t) {
      case 'borrow':  return 'bg-slate-100 text-slate-800 border-slate-200';
      case 'return':  return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'reserve': return 'bg-amber-100 text-amber-800 border-amber-200';
      default:        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  function formatDate(dateString: string) {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateString;
    }
  }

  function formatDateForInput(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function formatFineCentavos(cents: number) {
    // `transaction.fine` and DB store fine as pesos (decimal). Format directly.
    return `₱${Number(cents || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function calculateDaysRemaining(dueDate: string) {
    if (!dueDate) return null;
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  async function handleDelete(transactionId: number) {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    try {
      const res = await fetch(`/api/transactions/${transactionId}`, { method: "DELETE", credentials: 'include' });
      if (res.ok) { alert("Transaction deleted successfully!"); location.reload(); }
      else alert("Failed to delete transaction.");
    } catch (err) { alert("Error deleting transaction."); }
  }

  function openReturnModal(transaction: Transaction) {
    selectedTransaction = transaction;
    showReturnModal = true;
    returnVerification = { method: "password", password: "", qrData: "", fine: 0 };
  }

  function openViewModal(transaction: Transaction) {
    viewTransaction = transaction;
    showViewModal = true;
  }

  function closeViewModal() {
    showViewModal = false;
    viewTransaction = null;
  }

  function closeReturnModal() {
    showReturnModal = false;
    selectedTransaction = null;
    returnVerification = { method: "password", password: "", qrData: "", fine: 0 };
  }

  function handleReturnModalConfirm(e: CustomEvent<any>) {
    returnVerification = e.detail;
    confirmReturn();
  }

  async function confirmReturn() {
    if (!selectedTransaction) return;
    try {
      const isAdminCall = returnVerification.method === 'admin' || data?.user?.role === 'admin' || data?.user?.role === 'super_admin';
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
          body: JSON.stringify({ method: returnVerification.method, password: returnVerification.password, qrData: returnVerification.qrData, fine: returnVerification.fine }),
          credentials: 'include'
        });
      }
      const resData = await res.json();
      if (res.ok) {
        let msg = "Book returned successfully!";
        if (resData.data?.callNumber) {
          msg += `\n\nCall No: ${resData.data.callNumber}`;
        }
        if (resData.data?.fine > 0) {
          msg += `\n\nOverdue Fine: ₱${resData.data.fine}\n\nPlease collect the fine from the member.`;
        }
        alert(msg);
        closeReturnModal();
        location.reload();
      } else {
        if (res.status === 401) { alert("Session expired or not authenticated. Please log in again."); window.location.href = '/'; return; }
        alert(resData.message || "Failed to return book.");
      }
    } catch (err) { console.error('Return error:', err); alert("Error returning book. Please try again."); }
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
        body: JSON.stringify({ dueDate: customDueDate }),
        credentials: 'include'
      });
      if (res.ok) { alert("Reservation confirmed as borrow!"); closeConfirmBorrowModal(); location.reload(); }
      else { const d = await res.json(); alert(d.message || "Failed to confirm borrow."); }
    } catch (err) { alert("Error confirming borrow."); }
  }

  onMount(async () => {
    // Read initial filters from URL query params
    try {
      const p = new URLSearchParams(window.location.search);
      activeTab = p.get('tab') || activeTab;
      selectedItemType = p.get('type') || selectedItemType;
      selectedPeriod = p.get('period') || selectedPeriod;
      customDays = p.get('days') || customDays;
      searchTerm = p.get('q') || searchTerm;
    } catch (err) {
      // ignore
    }

    // Fetch initial transactions
    const initial = await fetchTransactions(1, 200, {
      search: searchTerm,
      tab: activeTab,
      period: selectedPeriod,
      customDays,
      itemType: selectedItemType
    });
    transactions = initial.transactions || [];
    totalCount = initial.total || 0;
    fineSettings = initial.fineSettings || fineSettings;

    // Mark initialized so reactive updates will push changes to the URL
    initializedFromUrl = true;

    const res = await fetch('/api/auth/session', { credentials: 'include' });
    if (!res.ok) { alert("Session expired. Please log in again."); window.location.href = '/'; }
  });

  // Update the URL whenever filter/tab/search state changes after initial read
  // Include the reactive variables inside the block so Svelte re-runs this
  // whenever any of them change.
  $: if (initializedFromUrl) {
    activeTab;
    selectedItemType;
    selectedPeriod;
    customDays;
    debouncedSearchTerm;
    updateUrlParams();
    // Refetch transactions with new filters
    (async () => {
      loading = true;
      currentPage = 1;
      serverPage = 1;
      transactions = [];
      totalCount = null;
      try {
        const json = await fetchTransactions(1, 500, {
          search: debouncedSearchTerm,
          tab: activeTab,
          period: selectedPeriod,
          customDays,
          itemType: selectedItemType
        });
        transactions = json.transactions || [];
        totalCount = json.total || 0;
      } catch (err) {
        console.error('Error fetching transactions:', err);
      } finally {
        loading = false;
      }
    })();
  }

  // pagination helpers (limit rendered rows to improve load speed)
  let currentPage = 1;

  $: totalPages = Math.ceil(filteredTransactions.length / ROWS_PER_PAGE) || 1;
  // reset to first page whenever filters/search update
  $: if (searchTerm !== undefined || activeTab !== undefined || selectedItemType !== undefined || selectedPeriod !== undefined || customDays !== undefined) {
    currentPage = 1;
  }
  $: if (currentPage > totalPages) currentPage = totalPages;
  $: pagedTransactions = filteredTransactions.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  $: stats = {
    total: filteredTransactions.length,
    borrowed: transactions.filter((t: Transaction) => t.status?.toLowerCase() === 'borrowed').length,
    returned: transactions.filter((t: Transaction) => t.status?.toLowerCase() === 'returned').length,
    overdue:  transactions.filter((t: Transaction) => Number((t as any).daysOverdue || 0) > 0 || Number((t as any).hoursOverdue || 0) > 0).length,
    reserved: transactions.filter((t: Transaction) => t.status?.toLowerCase() === 'active' && t.type?.toLowerCase() === 'reserve').length,
  };

  // animate stats
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
    <!-- Search + quick filters (desktop) -->
    <div class="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div class="relative flex-1">
        <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/>
          <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="text"
          placeholder="Search by book title, member name, ID..."
          bind:value={searchTerm}
          class="pl-10 pr-4 py-2.5 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 text-sm"
        />
      </div>
      <!-- moved selectors (visible on sm+ only) -->
      <div class="hidden sm:flex items-center gap-2">
        <div class="relative sm:w-auto">
          <button
            on:click={toggleDropdown}
            class="w-full sm:w-auto px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 text-sm bg-white text-gray-700 flex items-center justify-between"
          >
            <span>{selectedPeriod === 'custom' ? customDaysLabel || 'Select Dates' : periodOptions.find(p => p.value === selectedPeriod)?.label || 'All Time'}</span>
            <svg class={`h-4 w-4 ml-2 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          {#if dropdownOpen}
            <div class="absolute z-10 mt-1 w-full sm:w-auto bg-white border border-gray-300 rounded-lg shadow-lg">
              {#each periodOptions as option}
                <button
                  on:click={() => selectPeriod(option.value)}
                  class={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg transition-colors duration-150 ${
                    selectedPeriod === option.value ? 'bg-slate-100 text-slate-900 font-medium' : 'text-gray-700'
                  }`}
                >{option.label}</button>
              {/each}
            </div>
          {/if}
        </div>
        <div class="relative">
          <button
            on:click={() => { itemTypeDropdownOpen = !itemTypeDropdownOpen; }}
            class="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 text-sm bg-white text-gray-700 flex items-center justify-between"
          >
            <span>{(itemTypeOptions.find(o => o.value === selectedItemType)?.label) || 'All Types'}</span>
            <svg class={`h-4 w-4 ml-2 transition-transform duration-200 ${itemTypeDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
          </button>
          {#if itemTypeDropdownOpen}
            <div class="absolute z-10 mt-1 w-full sm:w-auto bg-white border border-gray-300 rounded-lg shadow-lg">
              {#each itemTypeOptions as opt}
                <button
                  on:click={() => selectItemType(opt.value)}
                  class={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg transition-colors duration-150 ${selectedItemType === opt.value ? 'bg-slate-100 text-slate-900 font-medium' : 'text-gray-700'}`}
                >{opt.label}</button>
              {/each}
            </div>
          {/if}
        </div>
        <!-- export dropdown like reports -->
        <div class="relative export-dd">
          <button on:click={() => exportDropdownOpen.update(v => !v)}
            class="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-sm rounded-lg shadow-sm hover:bg-gray-50 disabled:opacity-60 transition-colors"
          >
            <svg class="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 16v4m0 0l-3-3m3 3l3-3M4 12h16M4 8h16"/></svg>
            Export {$selectedExportFormat.toUpperCase()}
            <svg class="h-4 w-4 text-gray-400 transition-transform {$exportDropdownOpen ? 'rotate-180' : ''}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
          </button>
          {#if $exportDropdownOpen}
            <div class="absolute right-0 z-20 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg">
              {#each EXPORT_FORMATS as fmt}
                  <button on:click={() => { selectedExportFormat.set(fmt.v); exportDropdownOpen.set(false); handleExport(); }}
                    class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg flex items-center gap-2 {$selectedExportFormat === fmt.v ? 'bg-indigo-50 text-indigo-700' : ''}">
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
          <button
            on:click={() => activeTab = tab.id}
            class={`px-4 py-3 font-medium text-sm border-b-2 transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
              activeTab === tab.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
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
              <!-- simple clock icon for overdue tab -->
              <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M12 6v6l3 3" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            {/if}
            {tab.label}
          </button>
        {/each}
      </div>
    </div>

    <!-- Mobile Filter Toggle -->
    <div class="sm:hidden mb-3">
      <button
        on:click={() => showFilters = !showFilters}
        class="w-full flex items-center justify-between px-3 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 text-sm"
      >
        <span class="flex items-center font-medium text-gray-700">
          <svg class="h-5 w-5 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z"/>
          </svg>
          Filters
        </span>
        <svg class={`h-5 w-5 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
    </div>

    <!-- Filters -->
    <div class={`${showFilters ? 'block' : 'hidden'} sm:block`}>
      <div class="flex flex-col sm:flex-row gap-2">
        <div class="relative sm:hidden">
          <button
            on:click={toggleDropdown}
            class="w-full sm:w-auto px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 text-sm bg-white text-gray-700 flex items-center justify-between"
          >
            <span>{selectedPeriod === 'custom' ? customDaysLabel || 'Select Dates' : periodOptions.find(p => p.value === selectedPeriod)?.label || 'All Time'}</span>
            <svg class={`h-4 w-4 ml-2 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          {#if dropdownOpen}
            <div class="absolute z-10 mt-1 w-full sm:w-auto bg-white border border-gray-300 rounded-lg shadow-lg">
              {#each periodOptions as option}
                <button
                  on:click={() => selectPeriod(option.value)}
                  class={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg transition-colors duration-150 ${
                    selectedPeriod === option.value ? 'bg-slate-100 text-slate-900 font-medium' : 'text-gray-700'
                  }`}
                >{option.label}</button>
              {/each}
            </div>
          {/if}
        </div>


        <!-- Custom Item Type Dropdown (hidden on desktop, moved above) -->
        <div class="relative sm:hidden">
          <button
            on:click={() => { itemTypeDropdownOpen = !itemTypeDropdownOpen; }}
            class="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 text-sm bg-white text-gray-700 flex items-center justify-between"
          >
            <span>{(itemTypeOptions.find(o => o.value === selectedItemType)?.label) || 'All Types'}</span>
            <svg class={`h-4 w-4 ml-2 transition-transform duration-200 ${itemTypeDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
          </button>
          {#if itemTypeDropdownOpen}
            <div class="absolute z-10 mt-1 w-full sm:w-auto bg-white border border-gray-300 rounded-lg shadow-lg">
              {#each itemTypeOptions as opt}
                <button
                  on:click={() => selectItemType(opt.value)}
                  class={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg transition-colors duration-150 ${selectedItemType === opt.value ? 'bg-slate-100 text-slate-900 font-medium' : 'text-gray-700'}`}
                >{opt.label}</button>
              {/each}
            </div>
          {/if}
        </div>

      </div>
    </div>
  </div>

  <!-- ===================== DESKTOP TABLE VIEW ===================== -->
  <div class="hidden lg:block mb-2">
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

      <!-- Table top bar -->
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
              <th class="pl-6 pr-3 py-3.5 text-left">
                <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">ID / Type</span>
              </th>
              <th class="px-3 py-3.5 text-left">
                <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Item</span>
              </th>
              <th class="px-3 py-3.5 text-left">
                <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Member</span>
              </th>
              <th class="px-4 py-3.5 text-left">
                <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Timeline</span>
              </th>
              <th class="px-2.5 py-3.5 text-left">
                <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Status</span>
              </th>
              <th class="pl-3 pr-6 py-3.5 text-right">
                <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Actions</span>
              </th>
            </tr>
          </thead>

          <tbody class="divide-y divide-gray-50">
            {#if loading}
              {#each Array(10) as _}
                <tr class="animate-pulse">
                  <td class="pl-6 pr-3 py-4">
                    <div class="flex flex-col gap-1.5">
                      <div class="h-4 bg-gray-200 rounded w-16"></div>
                      <div class="h-3 bg-gray-200 rounded w-12"></div>
                    </div>
                  </td>
                  <td class="px-3 py-4">
                    <div class="flex items-center gap-3">
                      <div class="h-9 w-9 bg-gray-200 rounded-xl"></div>
                      <div class="flex-1">
                        <div class="h-4 bg-gray-200 rounded w-32 mb-1"></div>
                        <div class="h-3 bg-gray-200 rounded w-20"></div>
                      </div>
                    </div>
                  </td>
                  <td class="px-3 py-4">
                    <div class="h-4 bg-gray-200 rounded w-24 mb-1"></div>
                    <div class="h-3 bg-gray-200 rounded w-16"></div>
                  </td>
                  <td class="px-4 py-4">
                    <div class="h-3 bg-gray-200 rounded w-20 mb-1"></div>
                    <div class="h-3 bg-gray-200 rounded w-16"></div>
                  </td>
                  <td class="px-2.5 py-4">
                    <div class="h-5 bg-gray-200 rounded w-14"></div>
                  </td>
                  <td class="pl-3 pr-6 py-4">
                    <div class="flex justify-end gap-1.5">
                      <div class="h-7 w-16 bg-gray-200 rounded"></div>
                      <div class="h-7 w-7 bg-gray-200 rounded"></div>
                      <div class="h-7 w-7 bg-gray-200 rounded"></div>
                    </div>
                  </td>
                </tr>
              {/each}
            {:else}
              {#each pagedTransactions as transaction}
              {@const daysLeft = calculateDaysRemaining(transaction.dueDate)}
              {@const daysOverdue = Number((transaction as any).daysOverdue || 0)}
              {@const hoursOverdue = Number((transaction as any).hoursOverdue || 0) || Math.ceil(Number((transaction as any).fine || 0) / 5)}
              {@const isOverdue = daysOverdue > 0 || hoursOverdue > 0 || (daysLeft !== null && daysLeft < 0)}

              <tr class="group hover:bg-slate-50/70 transition-colors duration-150 {isOverdue ? 'bg-red-50/30' : ''}">

                <!-- ID + Type -->
                <td class="pl-6 pr-3 py-4 whitespace-nowrap">
                  <div class="flex flex-col gap-1.5">
                    <span class="font-mono text-sm font-bold text-gray-800 tracking-tight">
                      #{transaction.id.toString().padStart(6, '0')}
                    </span>
                    <span class={`inline-flex w-fit items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wide border ${getTypeColor(transaction.type)}`}>
                      {#if transaction.type?.toLowerCase() === 'borrow'}
                        <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                        </svg>
                      {:else if transaction.type?.toLowerCase() === 'return'}
                        <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12"/>
                        </svg>
                      {:else}
                        <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
                        </svg>
                      {/if}
                      {transaction.type}
                    </span>
                  </div>
                </td>

                <!-- Item -->
                <td class="px-3 py-4 max-w-[220px]">
                  <div class="flex items-center gap-3">
                    <div class="flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-xl bg-slate-100 group-hover:bg-slate-200 transition-colors duration-150">
                      <svg class="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/>
                      </svg>
                    </div>
                    <div class="min-w-0">
                      <p class="text-sm font-semibold text-gray-900 truncate leading-tight" title={transaction.itemTitle}>
                        {transaction.itemTitle}
                      </p>
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
                      <span class="text-xs font-bold text-white">
                        {transaction.userName?.charAt(0).toUpperCase() || 'U'}
                      </span>
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

                    <!-- Start date -->
                    <div class="flex items-center gap-2">
                      <div class="h-1.5 w-1.5 rounded-full bg-slate-400 flex-shrink-0"></div>
                      <div class="flex items-baseline gap-1.5">
                        <span class="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Start</span>
                        <span class="text-xs text-gray-700 font-medium">{formatDate(transaction.borrowDate)}</span>
                      </div>
                    </div>

                    <!-- Due date — badge is now inline -->
                    {#if transaction.dueDate && !transaction.returnDate}
                      <div class="flex items-center gap-2 flex-wrap">
                        <div class="h-1.5 w-1.5 rounded-full {isOverdue ? 'bg-red-400' : 'bg-amber-400'} flex-shrink-0"></div>
                        <div class="flex items-center gap-1.5 flex-wrap">
                          <span class="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Due</span>
                          <span class="text-xs {isOverdue ? 'text-red-600 font-semibold' : 'text-gray-700 font-medium'}">{formatDate(transaction.dueDate)}</span>
                          <!-- Inline status badge -->
                          {#if hoursOverdue > 0}
                            <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200">
                              <svg class="h-2.5 w-2.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
                              </svg>
                              {hoursOverdue}h{daysOverdue>0?` (${daysOverdue}d)`:''} · {formatFineCentavos((transaction as any).fine || 0)}
                            </span>
                          {:else if transaction.status?.toLowerCase() === 'borrowed' && daysLeft !== null}
                            <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border
                              {daysLeft < 0
                                ? 'bg-red-100 text-red-700 border-red-200'
                                : daysLeft === 0
                                  ? 'bg-amber-100 text-amber-700 border-amber-200'
                                  : daysLeft <= 3
                                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'}">
                              {daysLeft < 0
                                ? `${Math.abs(daysLeft)}d overdue`
                                : daysLeft === 0
                                  ? 'Due today'
                                  : `${daysLeft}d left`}
                            </span>
                          {/if}
                        </div>
                      </div>
                    {/if}

                    <!-- Return date -->
                    {#if transaction.returnDate}
                      <div class="flex items-center gap-2">
                        <div class="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0"></div>
                        <div class="flex items-baseline gap-1.5">
                          <span class="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Returned</span>
                          <span class="text-xs text-emerald-600 font-semibold">{formatDate(transaction.returnDate)}</span>
                        </div>
                      </div>
                    {/if}

                  </div>
                </td>

                <!-- Status -->
                <td class="px-1.5 py-4 whitespace-nowrap">
                  <div class="flex items-center gap-0.5">
                    <span class="h-2 w-2 rounded-full flex-shrink-0 {getStatusDot(transaction.status)}"></span>
                    <span class={`inline-flex items-center px-1 py-1 rounded-lg text-xs font-semibold border ${getStatusColor(transaction.status)}`}>
                      {transaction.status?.charAt(0).toUpperCase() + transaction.status?.slice(1)}
                    </span>
                  </div>
                </td>

                <!-- Actions -->
                <td class="pl-3 pr-6 py-4 whitespace-nowrap text-right">
                  <div class="flex items-center justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity duration-150">
                    

                    {#if transaction.type?.toLowerCase() === 'borrow' && (transaction.status?.toLowerCase() === 'borrowed' || transaction.status?.toLowerCase() === 'overdue')}
                      <button
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold transition-all duration-150 shadow-sm"
                        on:click={() => openReturnModal(transaction)}
                      >
                        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"/>
                        </svg>
                        Return
                      </button>
                    {/if}

                    {#if transaction.type?.toLowerCase() === 'reserve' && transaction.status?.toLowerCase() === 'active'}
                      <button
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold transition-all duration-150 shadow-sm"
                        on:click={() => openConfirmBorrowModal(transaction)}
                      >
                        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        Confirm
                      </button>
                    {/if}

                    <button
                      title="View details"
                      aria-label="View details"
                      class="inline-flex items-center justify-center h-7 w-7 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 active:scale-95 transition-all duration-150"
                      on:click={() => openViewModal(transaction)}
                    >
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>

                    <button
                      title="Delete transaction"
                      aria-label="Delete transaction"
                      class="inline-flex items-center justify-center h-7 w-7 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 active:scale-95 transition-all duration-150"
                      on:click={() => handleDelete(transaction.id)}
                    >
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/>
                      </svg>
                    </button>
                  </div>
                </td>

              </tr>
            {/each}

            <!-- Empty state -->
            {#if filteredTransactions.length === 0}
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

      <!-- desktop pagination -->
      {#if totalPages > 1}
        <div class="px-6 py-2 flex justify-end items-center space-x-2">
          <button class="px-2 py-1 border rounded" on:click={() => currentPage = Math.max(1, currentPage-1)} disabled={currentPage === 1}>
            Prev
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button class="px-2 py-1 border rounded" on:click={() => currentPage = Math.min(totalPages, currentPage+1)} disabled={currentPage === totalPages}>
            Next
          </button>
        </div>
      {/if}
      {#if totalCount !== null && transactions.length < totalCount}
        <div class="px-6 py-2 flex justify-center">
          <button class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" on:click={loadMore}>
            Load more
          </button>
        </div>
      {/if}
      <!-- Table footer -->
      {#if filteredTransactions.length > 0}
        <div class="px-6 py-3 border-t border-gray-100 bg-gray-50/40 flex items-center justify-between">
          <p class="text-xs text-gray-400">
            Showing <span class="font-semibold text-gray-600">{pagedTransactions.length}</span> of <span class="font-semibold text-gray-600">{filteredTransactions.length}</span> loaded records
          </p>
          {#if totalCount !== null}
            <p class="text-xs text-gray-400 mt-1">
              {transactions.length} of {totalCount} total transactions loaded
            </p>
          {/if}
        </div>
      {/if}

    </div>
  </div>
  <!-- ===================== END DESKTOP TABLE ===================== -->

  <!-- Mobile Card View -->
  <div class="lg:hidden space-y-2 mb-2">
    {#if loading}
      {#each Array(5) as _}
        <div class="bg-white p-3 rounded-xl shadow-sm border border-gray-200 animate-pulse">
          <div class="flex items-start justify-between mb-4">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-2">
                <div class="h-4 bg-gray-200 rounded w-16"></div>
                <div class="h-5 bg-gray-200 rounded w-12"></div>
              </div>
              <div class="h-5 bg-gray-200 rounded w-32 mb-1"></div>
              <div class="h-3 bg-gray-200 rounded w-20"></div>
              <div class="h-3 bg-gray-200 rounded w-16 mt-1"></div>
            </div>
            <div class="h-6 bg-gray-200 rounded w-16"></div>
          </div>
          <div class="flex items-center mb-4 pb-4 border-b border-gray-100">
            <div class="h-10 w-10 bg-gray-200 rounded-full mr-3"></div>
            <div class="flex-1">
              <div class="h-4 bg-gray-200 rounded w-24 mb-1"></div>
              <div class="h-3 bg-gray-200 rounded w-16"></div>
            </div>
          </div>
          <div class="space-y-2 mb-4">
            <div class="flex items-center">
              <div class="h-4 w-4 bg-gray-200 rounded mr-2"></div>
              <div class="h-3 bg-gray-200 rounded w-20"></div>
            </div>
            <div class="flex items-center">
              <div class="h-4 w-4 bg-gray-200 rounded mr-2"></div>
              <div class="h-3 bg-gray-200 rounded w-16"></div>
            </div>
          </div>
          <div class="flex gap-2">
            <div class="h-8 bg-gray-200 rounded flex-1"></div>
            <div class="h-8 bg-gray-200 rounded w-16"></div>
          </div>
        </div>
      {/each}
    {:else}
      {#each pagedTransactions as transaction}
      <div class="bg-white p-3 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200 text-sm">
        <!-- Header -->
        <div class="flex items-start justify-between mb-4">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-sm font-bold text-gray-900">#{transaction.id.toString().padStart(6, '0')}</span>
              <span class={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getTypeColor(transaction.type)}`}>
                {transaction.type}
              </span>
            </div>
            <h3 class="text-base font-semibold text-gray-900 leading-snug mb-1">{transaction.itemTitle}</h3>
            <p class="text-xs text-gray-500">Item ID: {transaction.itemId || 'N/A'}</p>
            <p class="text-xs text-slate-500 mt-1">Type: {transaction.itemType ? transaction.itemType.charAt(0).toUpperCase() + transaction.itemType.slice(1) : 'N/A'}</p>
          </div>
          <span class={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border ${getStatusColor(transaction.status)}`}>
            {transaction.status?.charAt(0).toUpperCase() + transaction.status?.slice(1)}
          </span>
        </div>

        <!-- Member Info -->
        <div class="flex items-center mb-4 pb-4 border-b border-gray-100">
          <div class="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-slate-100 rounded-full mr-3">
            <span class="text-sm font-semibold text-slate-700">
              {transaction.userName?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 truncate">{transaction.userName}</p>
            {#if transaction.userIdentifier}
              <p class="text-xs text-gray-500">{transaction.userIdentifier}</p>
            {:else}
              <p class="text-xs text-gray-500">{transaction.userId || 'N/A'}</p>
            {/if}
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
          <!-- Due date + inline badge for mobile -->
          <div class="flex items-center gap-2 flex-wrap text-xs">
            <svg class="h-4 w-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>
            </svg>
            <span class="text-gray-600 font-medium">Due:</span>
            <span class="text-gray-900">{formatDate(transaction.dueDate)}</span>
            {#if transaction.status?.toLowerCase() === 'borrowed'}
              {@const daysLeft = calculateDaysRemaining(transaction.dueDate)}
              {#if daysLeft !== null}
                <span class={`px-2 py-0.5 rounded-md text-[10px] font-semibold border
                  ${daysLeft < 0 ? 'bg-red-100 text-red-700 border-red-200' :
                  daysLeft === 0 ? 'bg-amber-100 text-amber-700 border-amber-200' :
                  daysLeft <= 3 ? 'bg-amber-100 text-amber-700 border-amber-200' :
                  'bg-green-100 text-green-700 border-green-200'}`}>
                  {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`}
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

        <!-- Action Buttons -->
        <div class="flex flex-col gap-2">
          <button
            class="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm font-medium shadow-sm"
            on:click={() => openViewModal(transaction)}
          >View Details</button>
          {#if transaction.type?.toLowerCase() === 'borrow' && transaction.status?.toLowerCase() === 'borrowed'}
            <button
              class="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors duration-200 text-sm font-medium shadow-sm"
              on:click={() => openReturnModal(transaction)}
            >Return Book</button>
          {/if}
          {#if transaction.status?.toLowerCase() === 'returned' && canRevert(transaction)}
            <button
              class="w-full px-4 py-2.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors duration-200 text-sm font-medium shadow-sm"
              on:click={() => revertReturn(transaction)}
            >Revert Return</button>
            <!-- additional explicit revert button for convenience -->
            <button
              class="w-full px-4 py-2.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors duration-200 text-sm font-medium shadow-sm mt-1"
              on:click={() => revertReturn(transaction)}
            >Revert</button>
          {/if}
          {#if transaction.type?.toLowerCase() === 'reserve' && transaction.status?.toLowerCase() === 'active'}
            <button
              class="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm font-medium shadow-sm"
              on:click={() => openConfirmBorrowModal(transaction)}
            >Confirm Borrow</button>
          {/if}
          <button
            class="w-full px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 text-sm font-medium shadow-sm"
            on:click={() => handleDelete(transaction.id)}
          >Delete Transaction</button>
        </div>
      </div>
    {/each}
    {/if}

      <!-- mobile pagination -->
      <div class="flex justify-center items-center space-x-2 mt-2">
        <button class="px-2 py-1 border rounded" on:click={() => currentPage = Math.max(1, currentPage-1)} disabled={currentPage === 1}>
          Prev
        </button>
        <span>Page {currentPage} of {totalPages}</span>
        <button class="px-2 py-1 border rounded" on:click={() => currentPage = Math.min(totalPages, currentPage+1)} disabled={currentPage === totalPages}>
          Next
        </button>
      </div>
      {#if totalCount !== null && transactions.length < totalCount}
        <div class="flex justify-center mt-2">
          <button class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" on:click={loadMore}>
            Load more
          </button>
        </div>
      {/if}
    </div> <!-- end mobile card view -->
  </div> <!-- end outer space-y container -->

<!-- Modals -->
<CustomDateRangeModal
  bind:open={showCustomDateModal}
  on:apply={handleDateRangeApply}
/>

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