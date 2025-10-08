<script lang="ts">
  import Layout from "$lib/components/ui/layout.svelte";
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

<Layout>
  <div class="min-h-screen bg-gray-50">
    <div class="px-4 sm:px-6 lg:px-8 pb-8">
      {#if error}
        <!-- Error State -->
        <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div class="flex items-center">
            <svg class="w-5 h-5 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
            </svg>
            <div>
              <h3 class="text-sm font-medium text-red-800">Error loading dashboard</h3>
              <p class="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      {:else}
        <!-- Stats Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-8">
          <!-- Total Books -->
          <div class="bg-white overflow-hidden rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
            <div class="p-6">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                    </svg>
                  </div>
                </div>
                <div class="ml-4 flex-1">
                  <p class="text-sm font-medium text-gray-600">Total Books</p>
                  <p class="text-3xl font-bold text-gray-900">
                    {#if loading}
                      <div class="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                    {:else}
                      {dashboardData.totalBooks.toLocaleString()}
                    {/if}
                  </p>
                  <p class="text-xs text-gray-500 mt-1">In collection</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Active Members -->
          <div class="bg-white overflow-hidden rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
            <div class="p-6">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                    </svg>
                  </div>
                </div>
                <div class="ml-4 flex-1">
                  <p class="text-sm font-medium text-gray-600">Active Members</p>
                  <p class="text-3xl font-bold text-gray-900">
                    {#if loading}
                      <div class="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                    {:else}
                      {dashboardData.activeMembers.toLocaleString()}
                    {/if}
                  </p>
                  <p class="text-xs text-gray-500 mt-1">Registered users</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Books Borrowed -->
          <div class="bg-white overflow-hidden rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
            <div class="p-6">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"></path>
                    </svg>
                  </div>
                </div>
                <div class="ml-4 flex-1">
                  <p class="text-sm font-medium text-gray-600">Books Borrowed</p>
                  <p class="text-3xl font-bold text-gray-900">
                    {#if loading}
                      <div class="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                    {:else}
                      {dashboardData.booksBorrowed.toLocaleString()}
                    {/if}
                  </p>
                  <p class="text-xs text-gray-500 mt-1">Currently out</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Overdue Books -->
          <div class="bg-white overflow-hidden rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
            <div class="p-6">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                    </svg>
                  </div>
                </div>
                <div class="ml-4 flex-1">
                  <p class="text-sm font-medium text-gray-600">Overdue Books</p>
                  <p class="text-3xl font-bold text-red-600">
                    {#if loading}
                      <div class="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                    {:else}
                      {dashboardData.overdueBooks.toLocaleString()}
                    {/if}
                  </p>
                  <p class="text-xs text-red-600 mt-1">Need attention</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Activity and Overdue Lists -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-2">
          <!-- Recent Activity -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200">
            <div class="px-6 py-4 border-b border-gray-200">
              <h3 class="text-lg font-semibold text-gray-900">Recent Activity</h3>
              <p class="text-sm text-gray-600 mt-1">Latest borrowing and return transactions</p>
            </div>
            <div class="divide-y divide-gray-100">
              {#if loading}
                {#each Array(5) as _}
                  <div class="px-6 py-4 animate-pulse">
                    <div class="flex items-center space-x-3">
                      <div class="w-8 h-8 bg-gray-200 rounded-full"></div>
                      <div class="flex-1 space-y-2">
                        <div class="h-4 bg-gray-200 rounded w-1/2"></div>
                        <div class="h-3 bg-gray-200 rounded w-3/4"></div>
                      </div>
                    </div>
                  </div>
                {/each}
              {:else if dashboardData.recentActivity.length === 0}
                <div class="px-6 py-8 text-center text-gray-500">
                  <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                  </svg>
                  <p class="mt-2">No recent activity</p>
                </div>
              {:else}
                {#each dashboardData.recentActivity as activity, index}
                  <div class="px-6 py-4 hover:bg-gray-50 transition-colors duration-150">
                    <div class="flex items-center space-x-4">
                      <div class="flex-shrink-0">
                        <div class="w-8 h-8 rounded-full bg-{activity.type === 'borrowed' ? 'blue' : activity.type === 'returned' ? 'green' : 'red'}-100 flex items-center justify-center">
                          <svg class="w-4 h-4 text-{activity.type === 'borrowed' ? 'blue' : activity.type === 'returned' ? 'green' : 'red'}-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="{getActivityIcon(activity.type)}"></path>
                          </svg>
                        </div>
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-900">
                          {getActivityTypeDisplay(activity.type)}
                        </p>
                        <p class="text-sm text-gray-600 truncate">{activity.bookTitle || 'Unknown Book'}</p>
                        <div class="flex items-center justify-between mt-1">
                          <span class="text-sm font-medium text-gray-700">{activity.memberName || 'Unknown Member'}</span>
                          <span class="text-xs text-gray-500">{formatTime(activity.time)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                {/each}
              {/if}
            </div>
          </div>

          <!-- Overdue Books -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200">
            <div class="px-6 py-4 border-b border-gray-200">
              <h3 class="text-lg font-semibold text-gray-900">Overdue Books</h3>
              <p class="text-sm text-gray-600 mt-1">Books past their due date requiring attention</p>
            </div>
            <div class="divide-y divide-gray-100">
              {#if loading}
                {#each Array(5) as _}
                  <div class="px-6 py-4 animate-pulse">
                    <div class="flex items-center space-x-3">
                      <div class="w-2 h-2 bg-gray-200 rounded-full"></div>
                      <div class="flex-1 space-y-2">
                        <div class="h-4 bg-gray-200 rounded w-1/2"></div>
                        <div class="h-3 bg-gray-200 rounded w-3/4"></div>
                      </div>
                    </div>
                  </div>
                {/each}
              {:else if dashboardData.overdueBooksList.length === 0}
                <div class="px-6 py-8 text-center text-gray-500">
                  <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <p class="mt-2">No overdue books</p>
                  <p class="text-xs mt-1">All books are returned on time!</p>
                </div>
              {:else}
                {#each dashboardData.overdueBooksList as book, index}
                  <div class="px-6 py-4 hover:bg-red-50 transition-colors duration-150">
                    <div class="flex items-center space-x-4">
                      <div class="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-900 truncate">{book.bookTitle || 'Unknown Book'}</p>
                        <p class="text-sm text-gray-600 truncate">{book.memberName || 'Unknown Member'}</p>
                        <div class="flex items-center justify-between mt-2">
                          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            {book.daysOverdue} days overdue
                          </span>
                          <span class="text-xs text-gray-500">Due: {formatDate(book.dueDate)}</span>
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
    </div>
  </div>
</Layout>

<style>
  /* Custom loading animation for skeleton states */
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
</style>