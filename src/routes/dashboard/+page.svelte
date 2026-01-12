<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  export let data: {
    dashboard: {
      totalBooks: number;
      activeMembers: number;
      booksBorrowed: number;
      overdueBooks: number;
      recentActivity: RecentActivity[];
      overdueBooksList: OverdueBook[];
    }
  };

  interface RecentActivity {
    id: number;
    type: string;
    bookTitle: string;
    memberName: string;
    time: string;
  }

  interface OverdueBook {
    id: number;
    bookTitle: string;
    memberName: string;
    dueDate: string;
    daysOverdue: number;
  }

  let dashboardData: {
    totalBooks: number;
    activeMembers: number;
    booksBorrowed: number;
    overdueBooks: number;
    recentActivity: RecentActivity[];
    overdueBooksList: OverdueBook[];
  } = {
    totalBooks: 0,
    activeMembers: 0,
    booksBorrowed: 0,
    overdueBooks: 0,
    recentActivity: [],
    overdueBooksList: []
  };

  let loading: boolean = true;
  let error: string | null = null;

  async function loadDashboardData(): Promise<void> {
    try {
      loading = true;
      error = null;

      const response = await fetch('/api/dashboard', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        dashboardData = {
          totalBooks: result.data.totalBooks || 0,
          activeMembers: result.data.activeMembers || 0,
          booksBorrowed: result.data.booksBorrowed || 0,
          overdueBooks: result.data.overdueBooks || 0,
          recentActivity: result.data.recentActivity || [],
          overdueBooksList: result.data.overdueBooksList || []
        };
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  function formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  }

  function formatTime(timestamp: string): string {
    if (!timestamp) return 'N/A';
    try {
      return new Date(timestamp).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid time';
    }
  }

  function getActivityTypeDisplay(type: string): string {
    const typeMap: { [key: string]: string } = {
      'borrowed': 'Borrowed',
      'returned': 'Returned',
      'overdue': 'Overdue'
    };
    return typeMap[type] || type;
  }

  function getActivityIcon(type: string): string {
    switch(type) {
      case 'borrowed':
        return 'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5';
      case 'returned':
        return 'M16.5 3L21 7.5m0 0L16.5 12M21 7.5H7.5m0 13.5L3 16.5m0 0L7.5 12M3 16.5h13.5';
      default:
        return 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z';
    }
  }

  function getHoursOverdue(dueDate: string): number {
     if (!dueDate) return 0;
     try {
       const due = new Date(dueDate).getTime();
       if (isNaN(due)) return 0;
       const diffMs = Date.now() - due;
       if (diffMs <= 0) return 0;
       const hours = diffMs / (1000 * 60 * 60);
       return Math.ceil(hours);
     } catch {
       return 0;
     }
  }

  function getOverdueFine(dueDate: string): string {
   const hours = getHoursOverdue(dueDate);
   const fine = hours * 5;
   return fine.toFixed(2);
  }

  async function refreshData(): Promise<void> {
    await loadDashboardData();
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

<div class="min-h-screen">
  <!-- Header -->
  <div class="mb-4">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">Dashboard Overview</h2>
        <p class="text-slate-600">Monitor your library's performance and activity</p>
      </div>
      <button
        on:click={refreshData}
        class="inline-flex items-center justify-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors duration-200"
      >
        <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        Refresh Dashboard
      </button>
    </div>
  </div>

  <main class="space-y-4 -mx-2 sm:mx-0">

    {#if error}
      <!-- Error State -->
      <div class="bg-red-50 border-l-4 border-red-400 p-3 rounded-lg shadow-sm mb-3">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-6 w-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-800">Error loading dashboard</h3>
            <p class="mt-2 text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    {:else}
      <!-- Stats Grid -->
      <div class="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <!-- Total Books Card -->
        <div class="group relative bg-white rounded-xl shadow-sm border border-gray-200 p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          {#if loading}
            <div class="animate-pulse flex flex-col items-center">
              <div class="h-10 w-10 bg-gray-200 rounded-lg mb-3"></div>
              <div class="h-6 w-16 bg-gray-200 rounded mb-2"></div>
              <div class="h-3 w-20 bg-gray-200 rounded"></div>
            </div>
          {:else}
            <div class="flex flex-col items-center text-center">
              <div class="p-2.5 rounded-lg mb-3 bg-gradient-to-br from-green-400 to-green-600 shadow-sm">
                <svg class="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                </svg>
              </div>
              <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Total Books</p>
              <p class="text-lg sm:text-xl font-bold text-gray-900">
                {dashboardData.totalBooks.toLocaleString()}
              </p>
            </div>
          {/if}
        </div>

        <!-- Active Members Card -->
        <div class="group relative bg-white rounded-xl shadow-sm border border-gray-200 p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          {#if loading}
            <div class="animate-pulse flex flex-col items-center">
              <div class="h-10 w-10 bg-gray-200 rounded-lg mb-3"></div>
              <div class="h-6 w-16 bg-gray-200 rounded mb-2"></div>
              <div class="h-3 w-20 bg-gray-200 rounded"></div>
            </div>
          {:else}
            <div class="flex flex-col items-center text-center">
              <div class="p-2.5 rounded-lg mb-3 bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-sm">
                <svg class="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                </svg>
              </div>
              <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Active Members</p>
              <p class="text-lg sm:text-xl font-bold text-gray-900">
                {dashboardData.activeMembers.toLocaleString()}
              </p>
            </div>
          {/if}
        </div>

        <!-- Books Borrowed Card -->
        <div class="group relative bg-white rounded-xl shadow-sm border border-gray-200 p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          {#if loading}
            <div class="animate-pulse flex flex-col items-center">
              <div class="h-10 w-10 bg-gray-200 rounded-lg mb-3"></div>
              <div class="h-6 w-16 bg-gray-200 rounded mb-2"></div>
              <div class="h-3 w-20 bg-gray-200 rounded"></div>
            </div>
          {:else}
            <div class="flex flex-col items-center text-center">
              <div class="p-2.5 rounded-lg mb-3 bg-gradient-to-br from-green-400 to-green-600 shadow-sm">
                <svg class="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"></path>
                </svg>
              </div>
              <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Books Borrowed</p>
              <p class="text-lg sm:text-xl font-bold text-gray-900">
                {dashboardData.booksBorrowed.toLocaleString()}
              </p>
            </div>
          {/if}
        </div>

        <!-- Overdue Books Card -->
        <div class="group relative bg-white rounded-xl shadow-sm border border-gray-200 p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          {#if loading}
            <div class="animate-pulse flex flex-col items-center">
              <div class="h-10 w-10 bg-gray-200 rounded-lg mb-3"></div>
              <div class="h-6 w-16 bg-gray-200 rounded mb-2"></div>
              <div class="h-3 w-20 bg-gray-200 rounded"></div>
            </div>
          {:else}
            <div class="flex flex-col items-center text-center">
              <div class="p-2.5 rounded-lg mb-3 bg-gradient-to-br from-amber-400 to-amber-600 shadow-sm">
                <svg class="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
              </div>
              <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Overdue Books</p>
              <p class="text-lg sm:text-xl font-bold text-gray-900">
                {dashboardData.overdueBooks.toLocaleString()}
              </p>
            </div>
          {/if}
        </div>
      </div>

      <!-- Library Insights -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
        <div class="flex items-center justify-between mb-3">
          <div>
            <h3 class="text-lg font-semibold text-slate-900">Library Insights</h3>
            <p class="mt-1 text-sm text-slate-500">Key performance indicators and trends</p>
          </div>
          <div class="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>
          </div>
        </div>
        
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <!-- Borrowing Rate -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-slate-600">Borrowing Rate</span>
              <span class="text-sm text-slate-500">
                {#if dashboardData.totalBooks > 0}
                  {Math.round((dashboardData.booksBorrowed / dashboardData.totalBooks) * 100)}%
                {:else}
                  0%
                {/if}
              </span>
            </div>
            <div class="w-full bg-slate-200 rounded-full h-2">
              <div 
                class="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500"
                style="width: {dashboardData.totalBooks > 0 ? Math.min((dashboardData.booksBorrowed / dashboardData.totalBooks) * 100, 100) : 0}%"
              ></div>
            </div>
            <p class="text-xs text-slate-500">
              {dashboardData.booksBorrowed} of {dashboardData.totalBooks} books currently borrowed
            </p>
          </div>

          <!-- Overdue Rate -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-slate-600">Overdue Rate</span>
              <span class="text-sm text-slate-500">
                {#if dashboardData.booksBorrowed > 0}
                  {Math.round((dashboardData.overdueBooks / dashboardData.booksBorrowed) * 100)}%
                {:else}
                  0%
                {/if}
              </span>
            </div>
            <div class="w-full bg-slate-200 rounded-full h-2">
              <div 
                class="bg-gradient-to-r from-rose-500 to-rose-600 h-2 rounded-full transition-all duration-500"
                style="width: {dashboardData.booksBorrowed > 0 ? Math.min((dashboardData.overdueBooks / dashboardData.booksBorrowed) * 100, 100) : 0}%"
              ></div>
            </div>
            <p class="text-xs text-slate-500">
              {dashboardData.overdueBooks} overdue out of {dashboardData.booksBorrowed} borrowed books
            </p>
          </div>
        </div>

        <!-- Activity Summary -->
        <div class="mt-3 pt-3 border-t border-slate-200">
          <div class="flex flex-wrap gap-2 sm:grid sm:grid-cols-3">
            <div class="flex-1 text-center">
              <div class="text-2xl font-bold text-green-600">
                {#if dashboardData.recentActivity.length > 0}
                  {dashboardData.recentActivity.filter(a => a.type === 'returned').length}
                {:else}
                  0
                {/if}
              </div>
              <div class="text-sm text-slate-500">Returns Today</div>
            </div>
            <div class="flex-1 text-center">
              <div class="text-2xl font-bold text-amber-600">
                {#if dashboardData.recentActivity.length > 0}
                  {dashboardData.recentActivity.filter(a => a.type === 'borrowed').length}
                {:else}
                  0
                {/if}
              </div>
              <div class="text-sm text-slate-500">Borrows Today</div>
            </div>
            <div class="flex-1 text-center">
              <div class="text-2xl font-bold text-slate-600">
                {dashboardData.recentActivity.length}
              </div>
              <div class="text-sm text-slate-500">Total Activities</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Activity and Overdue Lists -->
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <!-- Recent Activity -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div class="px-3 sm:px-4 lg:px-5 py-3 border-b border-slate-200 bg-gradient-to-r from-green-50 to-white">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-lg font-semibold text-slate-900">Recent Activity</h3>
                <p class="mt-1 text-sm text-slate-500">Latest transactions and updates</p>
              </div>
              <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
              </div>
            </div>
          </div>
          <div class="overflow-y-auto max-h-96 divide-y divide-slate-100">
            {#if loading}
              {#each Array(5) as _}
                <div class="px-6 py-4 animate-pulse">
                  <div class="flex items-center space-x-4">
                    <div class="w-10 h-10 bg-slate-200 rounded-full"></div>
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
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                </svg>
                <p class="mt-4 text-sm font-medium text-slate-900">No recent activity</p>
                <p class="mt-1 text-sm text-slate-500">Activity will appear here when available</p>
              </div>
            {:else}
              {#each dashboardData.recentActivity as activity}
                <div class="px-6 py-4 hover:bg-slate-50 transition-colors duration-150">
                  <div class="flex items-center space-x-4">
                    <div class="flex-shrink-0">
                      <div class="w-10 h-10 rounded-full flex items-center justify-center
                        {activity.type === 'borrowed' ? 'bg-amber-100' : activity.type === 'returned' ? 'bg-green-100' : 'bg-red-100'}">
                        <svg class="w-5 h-5 {activity.type === 'borrowed' ? 'text-amber-600' : activity.type === 'returned' ? 'text-green-600' : 'text-red-600'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="{getActivityIcon(activity.type)}"></path>
                        </svg>
                      </div>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between">
                        <p class="text-sm font-semibold text-slate-900 truncate">{activity.bookTitle || 'Unknown Book'}</p>
                        <span class="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                          {activity.type === 'borrowed' ? 'bg-amber-100 text-amber-800' : activity.type === 'returned' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                          {getActivityTypeDisplay(activity.type)}
                        </span>
                      </div>
                      <div class="mt-1 flex items-center justify-between">
                        <p class="text-sm text-slate-600">{activity.memberName || 'Unknown Member'}</p>
                        <p class="text-xs text-slate-400">{formatTime(activity.time)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </div>

        <!-- Overdue Books -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div class="px-3 sm:px-4 lg:px-5 py-3 border-b border-slate-200 bg-gradient-to-r from-rose-50 to-white">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-lg font-semibold text-slate-900">Overdue Books</h3>
                <p class="mt-1 text-sm text-slate-500">Books requiring immediate attention</p>
              </div>
              <div class="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
            </div>
          </div>
          <div class="overflow-y-auto max-h-96 divide-y divide-slate-100">
            {#if loading}
              {#each Array(5) as _}
                <div class="px-6 py-4 animate-pulse">
                  <div class="space-y-3">
                    <div class="h-4 bg-slate-200 rounded w-3/4"></div>
                    <div class="h-3 bg-slate-200 rounded w-1/2"></div>
                    <div class="flex space-x-2">
                      <div class="h-6 bg-slate-200 rounded w-20"></div>
                      <div class="h-6 bg-slate-200 rounded w-24"></div>
                    </div>
                  </div>
                </div>
              {/each}
            {:else if dashboardData.overdueBooksList.length === 0}
              <div class="px-6 py-12 text-center">
                <svg class="mx-auto h-12 w-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p class="mt-4 text-sm font-medium text-slate-900">No overdue books</p>
                <p class="mt-1 text-sm text-slate-500">All books are returned on time!</p>
              </div>
            {:else}
              {#each dashboardData.overdueBooksList as book}
                <div class="px-6 py-4 hover:bg-rose-50/50 transition-colors duration-150">
                  <div class="flex items-start space-x-3">
                    <div class="flex-shrink-0 mt-1">
                      <div class="w-2 h-2 bg-rose-500 rounded-full"></div>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-semibold text-slate-900 mb-1">{book.bookTitle || 'Unknown Book'}</p>
                      <p class="text-sm text-slate-600 mb-3">{book.memberName || 'Unknown Member'}</p>
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
                          {book.daysOverdue} {book.daysOverdue === 1 ? 'day' : 'days'} overdue
                        </span>
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-600 text-white">
                          Fine: ₱{getOverdueFine(book.dueDate)}
                        </span>
                        <span class="text-xs text-slate-500">Due: {formatDate(book.dueDate)}</span>
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
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
  
  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  .overflow-y-auto::-webkit-scrollbar {
    width: 8px;
  }

  .overflow-y-auto::-webkit-scrollbar-track {
    background: #f8fafc;
    border-radius: 10px;
  }

  .overflow-y-auto::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 10px;
  }

  .overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }

  .overflow-y-auto {
    scrollbar-width: thin;
    scrollbar-color: #cbd5e1 #f8fafc;
  }
</style>