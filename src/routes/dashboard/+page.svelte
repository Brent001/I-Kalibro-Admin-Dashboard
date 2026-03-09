<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY as string;
  if (!ENCRYPTION_KEY) throw new Error('VITE_ENCRYPTION_KEY environment variable is not set');

  export let data: { dashboard: DashboardData };

  interface BorrowedByType   { books: number; magazines: number; thesis: number; journals: number }
  interface OverdueByType    { books: number; magazines: number; thesis: number; journals: number }
  interface PendingByType    { books: number; magazines: number; thesis: number; journals: number }

  interface RecentActivity {
    id: number; type: string; itemTitle: string;
    memberName: string; time: string; returnDate: string | null; itemType: string;
  }
  interface OverdueItem {
    id: number; itemTitle: string; memberName: string;
    dueDate: string; daysOverdue: number; itemType: string;
  }
  interface DashboardData {
    totalItems: number; totalBooks: number; totalMagazines: number;
    totalThesis: number; totalJournals: number; activeMembers: number;
    totalBorrowed: number; borrowedByType: BorrowedByType;
    totalOverdue: number; overdueByType: OverdueByType;
    totalPendingReservations: number; pendingReservationsByType: PendingByType;
    overdueItemsList: OverdueItem[]; recentActivity: RecentActivity[];
  }

  let dashboardData: DashboardData = {
    totalItems: 0, totalBooks: 0, totalMagazines: 0, totalThesis: 0, totalJournals: 0,
    activeMembers: 0,
    totalBorrowed: 0, borrowedByType: { books: 0, magazines: 0, thesis: 0, journals: 0 },
    totalOverdue: 0, overdueByType: { books: 0, magazines: 0, thesis: 0, journals: 0 },
    totalPendingReservations: 0, pendingReservationsByType: { books: 0, magazines: 0, thesis: 0, journals: 0 },
    overdueItemsList: [], recentActivity: []
  };

  let loading = true;
  let errorMsg: string | null = null;

  async function decryptData(encryptedData: string): Promise<any> {
    if (!browser) throw new Error('Decryption only available in browser');
    const key = ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32);
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    const iv = combined.slice(0, 16);
    const authTag = combined.slice(-16);
    const encrypted = combined.slice(16, -16);
    const cryptoKey = await globalThis.crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'AES-GCM' }, false, ['decrypt']);
    const decrypted = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, new Uint8Array([...encrypted, ...authTag]));
    return JSON.parse(new TextDecoder().decode(decrypted));
  }

  async function loadDashboardData() {
    try {
      loading = true; errorMsg = null;
      // POST endpoint clears the cache before returning fresh data
      const response = await fetch('/api/dashboard', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const result = await response.json();
      if (result.success && result.data) {
        const d = result.encrypted ? await decryptData(result.data) : result.data;
        dashboardData = { ...dashboardData, ...d };
      }
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  function formatDate(d: string) {
    if (!d) return 'N/A';
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return 'Invalid date'; }
  }
  function formatTime(t: string) {
    if (!t) return 'N/A';
    try { return new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return 'Invalid time'; }
  }
  function getActivityBadge(type: string) {
    return { borrowed: 'bg-amber-100 text-amber-800', returned: 'bg-green-100 text-green-800', overdue: 'bg-red-100 text-red-800' }[type] ?? 'bg-slate-100 text-slate-800';
  }
  function getActivityIcon(type: string) {
    if (type === 'borrowed') return 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5';
    if (type === 'returned') return 'M16.5 3L21 7.5m0 0L16.5 12M21 7.5H7.5m0 13.5L3 16.5m0 0L7.5 12M3 16.5h13.5';
    return 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z';
  }
  function itemTypeLabel(t: string) {
    return { book: 'Book', magazine: 'Magazine', thesis: 'Thesis', journal: 'Journal' }[t] ?? t;
  }
  function itemTypeBadge(t: string) {
    return { book: 'bg-blue-100 text-blue-700', magazine: 'bg-purple-100 text-purple-700', thesis: 'bg-teal-100 text-teal-700', journal: 'bg-orange-100 text-orange-700' }[t] ?? 'bg-slate-100 text-slate-600';
  }
  function getOverdueFine(dueDate: string) {
    if (!dueDate) return '0.00';
    const hours = Math.max(0, Math.ceil((Date.now() - new Date(dueDate).getTime()) / 3600000));
    return (hours * 5).toFixed(2);
  }

  onMount(() => {
    if (browser) {
      if (data?.dashboard && Object.keys(data.dashboard).length > 0) {
        dashboardData = { ...dashboardData, ...data.dashboard };
        loading = false;
      } else {
        loadDashboardData();
      }
    }
  });
</script>

<svelte:head>
  <title>Dashboard | E-Kalibro Admin Portal</title>
</svelte:head>

<div class="min-h-screen">
  <!-- Header -->
  <div class="mb-3">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">Dashboard Overview</h2>
        <p class="text-slate-600">Monitor your library's performance and activity</p>
      </div>
      <button
        on:click={loadDashboardData}
        class="inline-flex items-center justify-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors duration-200"
      >
        <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        Refresh Dashboard
      </button>
    </div>
  </div>

  <main class="space-y-3">

    {#if errorMsg}
      <div class="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg shadow-sm">
        <div class="flex">
          <svg class="h-6 w-6 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/>
          </svg>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-800">Error loading dashboard</h3>
            <p class="mt-1 text-sm text-red-700">{errorMsg}</p>
          </div>
        </div>
      </div>
    {:else}

      <!-- ═══ ROW 1 — Collection stats ═══════════════════════════════════════════ -->
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {#each [
          { label: 'Total Books',     value: dashboardData.totalBooks,     color: 'from-blue-400 to-blue-600',   icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', link: '/dashboard/inventory/books' },
          { label: 'Total Magazines',       value: dashboardData.totalMagazines, color: 'from-purple-400 to-purple-600',icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z', link: '/dashboard/inventory/magazines' },
          { label: 'Total Thesis',          value: dashboardData.totalThesis,    color: 'from-teal-400 to-teal-600',   icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', link: '/dashboard/inventory/thesis' },
          { label: 'Total Journals',        value: dashboardData.totalJournals,  color: 'from-orange-400 to-orange-600',icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', link: '/dashboard/inventory/journals' },
        ] as stat}
          <a href="{stat.link}" class="block">
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              {#if loading}
                <div class="animate-pulse flex flex-col items-center gap-2">
                  <div class="h-10 w-10 bg-gray-200 rounded-lg"></div>
                  <div class="h-5 w-14 bg-gray-200 rounded"></div>
                  <div class="h-3 w-20 bg-gray-200 rounded"></div>
                </div>
              {:else}
                <div class="flex flex-col items-center text-center">
                  <div class="p-2.5 rounded-lg mb-2 bg-gradient-to-br {stat.color} shadow-sm">
                    <svg class="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="{stat.icon}"/>
                    </svg>
                  </div>
                  <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{stat.label}</p>
                  <p class="text-lg sm:text-xl font-bold text-gray-900">{stat.value.toLocaleString()}</p>
                </div>
              {/if}
            </div>
          </a>
        {/each}
      </div>

      <!-- ═══ ROW 2 — Key action stats ══════════════════════════════════════════ -->
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {#each [
          { label: 'Active Members',   value: dashboardData.activeMembers,           color: 'from-yellow-400 to-yellow-600', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' , link: '/dashboard/members' },
          { label: 'Currently Borrowed', value: dashboardData.totalBorrowed,         color: 'from-green-400 to-green-600',   icon: 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5', link: '/dashboard/transactions?tab=borrow' },
          { label: 'Total Overdue',    value: dashboardData.totalOverdue,            color: 'from-red-400 to-red-600',       icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z', link: '/dashboard/transactions?tab=overdue' },
          { label: 'Pending Reservations', value: dashboardData.totalPendingReservations, color: 'from-indigo-400 to-indigo-600', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', link: '/dashboard/transactions?tab=reserve' },
        ] as stat}
          <a href="{stat.link}" class="block">
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              {#if loading}
                <div class="animate-pulse flex flex-col items-center gap-2">
                  <div class="h-10 w-10 bg-gray-200 rounded-lg"></div>
                  <div class="h-5 w-14 bg-gray-200 rounded"></div>
                  <div class="h-3 w-20 bg-gray-200 rounded"></div>
                </div>
              {:else}
                <div class="flex flex-col items-center text-center">
                  <div class="p-2.5 rounded-lg mb-2 bg-gradient-to-br {stat.color} shadow-sm">
                    <svg class="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="{stat.icon}"/>
                    </svg>
                  </div>
                  <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{stat.label}</p>
                  <p class="text-lg sm:text-xl font-bold text-gray-900">{stat.value.toLocaleString()}</p>
                </div>
              {/if}
            </div>
          </a>
        {/each}
      </div>

      <!-- ═══ Library Insights ═══════════════════════════════════════════════════ -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-lg font-semibold text-slate-900">Library Insights</h3>
            <p class="text-sm text-slate-500">Breakdown across all item types</p>
          </div>
          <div class="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          </div>
        </div>

        <!-- Borrowed by type breakdown -->
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2 mb-4">
          <div>
            <p class="text-sm font-semibold text-slate-700 mb-2">Borrowed by Type</p>
            {#each [
              { label: 'Books',     value: dashboardData.borrowedByType?.books     ?? 0, color: 'bg-blue-500' },
              { label: 'Magazines', value: dashboardData.borrowedByType?.magazines ?? 0, color: 'bg-purple-500' },
              { label: 'Thesis',    value: dashboardData.borrowedByType?.thesis    ?? 0, color: 'bg-teal-500' },
              { label: 'Journals',  value: dashboardData.borrowedByType?.journals  ?? 0, color: 'bg-orange-500' },
            ] as row}
              <div class="flex items-center gap-2 mb-1.5">
                <span class="text-xs text-slate-500 w-16 shrink-0">{row.label}</span>
                <div class="flex-1 bg-slate-100 rounded-full h-2">
                  <div
                    class="{row.color} h-2 rounded-full transition-all duration-500"
                    style="width:{dashboardData.totalBorrowed > 0 ? Math.min((row.value / dashboardData.totalBorrowed) * 100, 100) : 0}%"
                  ></div>
                </div>
                <span class="text-xs font-medium text-slate-700 w-6 text-right">{row.value}</span>
              </div>
            {/each}
          </div>

          <div>
            <p class="text-sm font-semibold text-slate-700 mb-2">Overdue by Type</p>
            {#each [
              { label: 'Books',     value: dashboardData.overdueByType?.books     ?? 0, color: 'bg-blue-500' },
              { label: 'Magazines', value: dashboardData.overdueByType?.magazines ?? 0, color: 'bg-purple-500' },
              { label: 'Thesis',    value: dashboardData.overdueByType?.thesis    ?? 0, color: 'bg-teal-500' },
              { label: 'Journals',  value: dashboardData.overdueByType?.journals  ?? 0, color: 'bg-orange-500' },
            ] as row}
              <div class="flex items-center gap-2 mb-1.5">
                <span class="text-xs text-slate-500 w-16 shrink-0">{row.label}</span>
                <div class="flex-1 bg-slate-100 rounded-full h-2">
                  <div
                    class="{row.color} h-2 rounded-full transition-all duration-500"
                    style="width:{dashboardData.totalOverdue > 0 ? Math.min((row.value / dashboardData.totalOverdue) * 100, 100) : 0}%"
                  ></div>
                </div>
                <span class="text-xs font-medium text-slate-700 w-6 text-right">{row.value}</span>
              </div>
            {/each}
          </div>
        </div>

        <!-- Global borrowing / overdue rate -->
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2 pt-3 border-t border-slate-100">
          <div class="space-y-1.5">
            <div class="flex justify-between text-sm">
              <span class="font-medium text-slate-600">Overall Borrowing Rate</span>
              <span class="text-slate-500">
                {dashboardData.totalItems > 0 ? Math.round((dashboardData.totalBorrowed / dashboardData.totalItems) * 100) : 0}%
              </span>
            </div>
            <div class="w-full bg-slate-200 rounded-full h-2">
              <div class="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500"
                style="width:{dashboardData.totalItems > 0 ? Math.min((dashboardData.totalBorrowed / dashboardData.totalItems) * 100, 100) : 0}%"></div>
            </div>
            <p class="text-xs text-slate-500">{dashboardData.totalBorrowed} of {dashboardData.totalItems} items currently borrowed</p>
          </div>
          <div class="space-y-1.5">
            <div class="flex justify-between text-sm">
              <span class="font-medium text-slate-600">Overall Overdue Rate</span>
              <span class="text-slate-500">
                {dashboardData.totalBorrowed > 0 ? Math.round((dashboardData.totalOverdue / dashboardData.totalBorrowed) * 100) : 0}%
              </span>
            </div>
            <div class="w-full bg-slate-200 rounded-full h-2">
              <div class="bg-gradient-to-r from-rose-500 to-rose-600 h-2 rounded-full transition-all duration-500"
                style="width:{dashboardData.totalBorrowed > 0 ? Math.min((dashboardData.totalOverdue / dashboardData.totalBorrowed) * 100, 100) : 0}%"></div>
            </div>
            <p class="text-xs text-slate-500">{dashboardData.totalOverdue} overdue out of {dashboardData.totalBorrowed} borrowed</p>
          </div>
        </div>

        <!-- Activity summary row -->
        <div class="mt-4 pt-3 border-t border-slate-200 grid grid-cols-3 gap-2 text-center">
          <div>
            <div class="text-2xl font-bold text-green-600">
              {dashboardData.recentActivity.filter(a => a.type === 'returned').length}
            </div>
            <div class="text-xs text-slate-500">Recent Returns</div>
          </div>
          <div>
            <div class="text-2xl font-bold text-amber-600">
              {dashboardData.recentActivity.filter(a => a.type === 'borrowed').length}
            </div>
            <div class="text-xs text-slate-500">Recent Borrows</div>
          </div>
          <div>
            <div class="text-2xl font-bold text-indigo-600">{dashboardData.totalPendingReservations}</div>
            <div class="text-xs text-slate-500">Pending Requests</div>
          </div>
        </div>
      </div>

      <!-- ═══ Pending Reservations Breakdown ════════════════════════════════════ -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div class="flex items-center justify-between mb-3">
          <div>
            <h3 class="text-lg font-semibold text-slate-900">Pending Reservations</h3>
            <p class="text-sm text-slate-500">Items awaiting staff approval</p>
          </div>
          <div class="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          </div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {#each [
            { label: 'Books',     value: dashboardData.pendingReservationsByType?.books     ?? 0, badge: 'bg-blue-50 text-blue-700 border-blue-200' },
            { label: 'Magazines', value: dashboardData.pendingReservationsByType?.magazines ?? 0, badge: 'bg-purple-50 text-purple-700 border-purple-200' },
            { label: 'Thesis',    value: dashboardData.pendingReservationsByType?.thesis    ?? 0, badge: 'bg-teal-50 text-teal-700 border-teal-200' },
            { label: 'Journals',  value: dashboardData.pendingReservationsByType?.journals  ?? 0, badge: 'bg-orange-50 text-orange-700 border-orange-200' },
          ] as t}
            <div class="flex flex-col items-center p-3 rounded-lg border {t.badge}">
              <span class="text-2xl font-bold">{t.value}</span>
              <span class="text-xs font-medium mt-0.5">{t.label}</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- ═══ Activity + Overdue ═════════════════════════════════════════════════ -->
      <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">

        <!-- Recent Activity -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div class="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-green-50 to-white flex items-center justify-between">
            <div>
              <h3 class="text-lg font-semibold text-slate-900">Recent Activity</h3>
              <p class="text-sm text-slate-500">Latest transactions across all types</p>
            </div>
            <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
          </div>
          <div class="overflow-y-auto max-h-96 divide-y divide-slate-100">
            {#if loading}
              {#each Array(5) as _}
                <div class="px-5 py-4 animate-pulse">
                  <div class="flex items-center gap-4">
                    <div class="w-10 h-10 bg-slate-200 rounded-full shrink-0"></div>
                    <div class="flex-1 space-y-2">
                      <div class="h-4 bg-slate-200 rounded w-3/4"></div>
                      <div class="h-3 bg-slate-200 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              {/each}
            {:else if dashboardData.recentActivity.length === 0}
              <div class="px-6 py-12 text-center">
                <svg class="mx-auto h-12 w-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
                <p class="mt-4 text-sm font-medium text-slate-900">No recent activity</p>
              </div>
            {:else}
              {#each dashboardData.recentActivity as activity}
                <div class="px-5 py-3.5 hover:bg-slate-50 transition-colors duration-150">
                  <div class="flex items-center gap-3">
                    <div class="shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                      {activity.type === 'borrowed' ? 'bg-amber-100' : activity.type === 'returned' ? 'bg-green-100' : 'bg-red-100'}">
                      <svg class="w-5 h-5 {activity.type === 'borrowed' ? 'text-amber-600' : activity.type === 'returned' ? 'text-green-600' : 'text-red-600'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="{getActivityIcon(activity.type)}"/>
                      </svg>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between gap-2">
                        <p class="text-sm font-semibold text-slate-900 truncate">{activity.itemTitle}</p>
                        <div class="flex items-center gap-1 shrink-0">
                          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {itemTypeBadge(activity.itemType)}">
                            {itemTypeLabel(activity.itemType)}
                          </span>
                          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {getActivityBadge(activity.type)} capitalize">
                            {activity.type}
                          </span>
                        </div>
                      </div>
                      <div class="flex items-center justify-between mt-0.5">
                        <p class="text-sm text-slate-600">{activity.memberName}</p>
                        <p class="text-xs text-slate-400">{formatTime(activity.time)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </div>

        <!-- Overdue Items -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div class="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-rose-50 to-white flex items-center justify-between">
            <div>
              <h3 class="text-lg font-semibold text-slate-900">Overdue Items</h3>
              <p class="text-sm text-slate-500">All types — oldest overdue first</p>
            </div>
            <div class="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
          </div>
          <div class="overflow-y-auto max-h-96 divide-y divide-slate-100">
            {#if loading}
              {#each Array(5) as _}
                <div class="px-5 py-4 animate-pulse space-y-2">
                  <div class="h-4 bg-slate-200 rounded w-3/4"></div>
                  <div class="h-3 bg-slate-200 rounded w-1/2"></div>
                  <div class="flex gap-2"><div class="h-5 bg-slate-200 rounded w-20"></div><div class="h-5 bg-slate-200 rounded w-24"></div></div>
                </div>
              {/each}
            {:else if dashboardData.overdueItemsList.length === 0}
              <div class="px-6 py-12 text-center">
                <svg class="mx-auto h-12 w-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <p class="mt-4 text-sm font-medium text-slate-900">No overdue items</p>
                <p class="mt-1 text-sm text-slate-500">All items are returned on time!</p>
              </div>
            {:else}
              {#each dashboardData.overdueItemsList as item}
                <div class="px-5 py-3.5 hover:bg-rose-50/50 transition-colors duration-150">
                  <div class="flex items-start gap-3">
                    <div class="shrink-0 mt-1.5 w-2 h-2 bg-rose-500 rounded-full"></div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-0.5">
                        <p class="text-sm font-semibold text-slate-900 truncate">{item.itemTitle}</p>
                        <span class="inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-xs font-medium {itemTypeBadge(item.itemType)}">
                          {itemTypeLabel(item.itemType)}
                        </span>
                      </div>
                      <p class="text-sm text-slate-600 mb-2">{item.memberName}</p>
                      <div class="flex flex-wrap items-center gap-1.5">
                        <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
                          {item.daysOverdue} {item.daysOverdue === 1 ? 'day' : 'days'} overdue
                        </span>
                        <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-600 text-white">
                          Fine: ₱{getOverdueFine(item.dueDate)}
                        </span>
                        <span class="text-xs text-slate-500">Due: {formatDate(item.dueDate)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      </div>

    {/if}
  </main>
</div>

<style>
  .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
  .overflow-y-auto::-webkit-scrollbar { width: 6px; }
  .overflow-y-auto::-webkit-scrollbar-track { background: #f8fafc; border-radius: 10px; }
  .overflow-y-auto::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
  .overflow-y-auto::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
  .overflow-y-auto { scrollbar-width: thin; scrollbar-color: #cbd5e1 #f8fafc; }
</style>