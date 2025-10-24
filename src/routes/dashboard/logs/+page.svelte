<script lang="ts">
  import Layout from "$lib/components/ui/layout.svelte";
  import { onMount } from "svelte";

  let searchTerm = "";
  let selectedEventType = "all";
  let selectedUserType = "all";
  let dateFilter = "";
  let logs: any[] = [];
  let loading = false;
  let errorMsg = "";
  let selectedLog: any = null;
  let isDetailModalOpen = false;

  const eventTypes = ['all', 'login', 'logout', 'failed_login', 'password_change'];
  const userTypes = ['all', 'account', 'user'];

  // Fetch security logs from API
  async function fetchLogs() {
    loading = true;
    try {
      const res = await fetch('/api/security-logs');
      const data = await res.json();
      logs = data.data.logs || [];
    } catch (err) {
      errorMsg = "Failed to load security logs.";
    } finally {
      loading = false;
    }
  }

  onMount(fetchLogs);

  $: filteredLogs = logs.filter(log => {
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      log.ipAddress?.toLowerCase().includes(search) ||
      log.browser?.toLowerCase().includes(search) ||
      log.userName?.toLowerCase().includes(search) ||
      log.userEmail?.toLowerCase().includes(search);

    const matchesEventType = selectedEventType === 'all' || log.eventType === selectedEventType;
    
    const matchesUserType = selectedUserType === 'all' || 
      (selectedUserType === 'account' && log.accountId) ||
      (selectedUserType === 'user' && log.userId && !log.accountId);

    const matchesDate = !dateFilter || 
      new Date(log.eventTime).toISOString().split('T')[0] === dateFilter;

    return matchesSearch && matchesEventType && matchesUserType && matchesDate;
  });

  function getEventTypeColor(eventType: string) {
    switch (eventType) {
      case 'login':
        return 'bg-green-100 text-green-800';
      case 'logout':
        return 'bg-blue-100 text-blue-800';
      case 'failed_login':
        return 'bg-red-100 text-red-800';
      case 'password_change':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  }

  function getUserTypeColor(log: any) {
    if (log.accountId) {
      return 'bg-purple-100 text-purple-800';
    } else if (log.userId) {
      return 'bg-blue-100 text-blue-800';
    }
    return 'bg-slate-100 text-slate-800';
  }

  function getUserTypeLabel(log: any) {
    if (log.accountId) return 'Staff';
    if (log.userId) return 'User';
    return 'Unknown';
  }

  function formatDateTime(dateTimeString: string) {
    return new Date(dateTimeString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  function formatDateTimeMobile(dateTimeString: string) {
    return new Date(dateTimeString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function openDetailModal(log: any) {
    selectedLog = log;
    isDetailModalOpen = true;
  }

  function closeDetailModal() {
    selectedLog = null;
    isDetailModalOpen = false;
  }

  // Get statistics
  $: totalLogs = logs.length;
  $: loginAttempts = logs.filter(l => l.eventType === 'login' || l.eventType === 'failed_login').length;
  $: failedLogins = logs.filter(l => l.eventType === 'failed_login').length;
  $: uniqueUsers = new Set(logs.map(l => l.accountId || l.userId)).size;
</script>

<Layout>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">Security Logs</h2>
        <p class="text-slate-600">Monitor authentication and security events</p>
      </div>
      <button
        class="inline-flex items-center justify-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors duration-200"
        on:click={fetchLogs}
      >
        <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        Refresh Logs
      </button>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
      <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center">
          <div class="p-2 bg-slate-100 rounded-lg">
            <svg class="h-4 w-4 lg:h-6 lg:w-6 text-slate-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
          <div class="ml-2 lg:ml-4">
            <p class="text-xs lg:text-sm font-medium text-gray-600">Total Events</p>
            <p class="text-lg lg:text-2xl font-semibold text-gray-900">{totalLogs}</p>
          </div>
        </div>
      </div>
      <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center">
          <div class="p-2 bg-blue-50 rounded-lg">
            <svg class="h-4 w-4 lg:h-6 lg:w-6 text-blue-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
            </svg>
          </div>
          <div class="ml-2 lg:ml-4">
            <p class="text-xs lg:text-sm font-medium text-gray-600">Login Attempts</p>
            <p class="text-lg lg:text-2xl font-semibold text-gray-900">{loginAttempts}</p>
          </div>
        </div>
      </div>
      <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center">
          <div class="p-2 bg-red-50 rounded-lg">
            <svg class="h-4 w-4 lg:h-6 lg:w-6 text-red-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <div class="ml-2 lg:ml-4">
            <p class="text-xs lg:text-sm font-medium text-gray-600">Failed Logins</p>
            <p class="text-lg lg:text-2xl font-semibold text-gray-900">{failedLogins}</p>
          </div>
        </div>
      </div>
      <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center">
          <div class="p-2 bg-purple-50 rounded-lg">
            <svg class="h-4 w-4 lg:h-6 lg:w-6 text-purple-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
          </div>
          <div class="ml-2 lg:ml-4">
            <p class="text-xs lg:text-sm font-medium text-gray-600">Unique Users</p>
            <p class="text-lg lg:text-2xl font-semibold text-gray-900">{uniqueUsers}</p>
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
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search by IP, browser, user name, or email..."
              bind:value={searchTerm}
              class="pl-10 pr-4 py-3 w-full border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors duration-200"
            />
          </div>
        </div>
        <div class="flex flex-col sm:flex-row gap-2">
          <select
            bind:value={selectedEventType}
            class="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 bg-white text-slate-700 transition-colors duration-200"
          >
            {#each eventTypes as type}
              <option value={type}>
                {type === 'all' ? 'All Events' : type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </option>
            {/each}
          </select>
          <select
            bind:value={selectedUserType}
            class="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 bg-white text-slate-700 transition-colors duration-200"
          >
            {#each userTypes as type}
              <option value={type}>
                {type === 'all' ? 'All Users' : type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            {/each}
          </select>
          <input
            type="date"
            bind:value={dateFilter}
            class="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 bg-white text-slate-700 transition-colors duration-200"
          />
        </div>
      </div>
    </div>

    <!-- Skeleton Loading State -->
    {#if loading}
      <div class="bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-slate-50">
              <tr>
                <th class="px-6 py-4"></th>
                <th class="px-6 py-4"></th>
                <th class="px-6 py-4"></th>
                <th class="px-6 py-4"></th>
                <th class="px-6 py-4"></th>
                <th class="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {#each Array(6) as _, i}
                <tr>
                  {#each Array(6) as __}
                    <td class="px-6 py-4">
                      <div class="h-4 bg-slate-100 rounded w-full animate-pulse"></div>
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}

    <!-- Desktop Table View -->
    {#if !loading}
    <div class="hidden lg:block bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Event Time
              </th>
              <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                User
              </th>
              <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Role
              </th>
              <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Event Type
              </th>
              <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                IP Address
              </th>
              <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Browser
              </th>
              <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-slate-100">
            {#each filteredLogs as log}
              <tr class="hover:bg-slate-50 transition-colors duration-200">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-xs text-slate-700">{formatDateTime(log.eventTime)}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div class="text-sm font-semibold text-slate-900">{log.userName || 'Unknown'}</div>
                    <div class="text-xs text-slate-600">{log.userEmail || 'N/A'}</div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                    {log.role ? log.role.charAt(0).toUpperCase() + log.role.slice(1) : 'N/A'}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getEventTypeColor(log.eventType)}`}>
                    {log.eventType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-xs text-slate-700 font-mono">{log.ipAddress || 'N/A'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-xs text-slate-700 max-w-xs truncate" title={log.browser}>
                    {log.browser || 'N/A'}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button 
                    class="text-slate-600 hover:text-slate-900 transition-colors duration-200" 
                    title="View Details"
                    on:click={() => openDetailModal(log)}
                  >
                    View Details
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
    {/if}

    <!-- Mobile Card View -->
    <div class="lg:hidden grid grid-cols-1 gap-4">
      {#each filteredLogs as log}
        <div class="bg-white rounded-lg shadow-sm border p-4">
          <div class="flex items-start justify-between mb-3">
            <div class="flex-1">
              <h3 class="font-medium text-gray-900 text-sm">{log.userName || 'Unknown User'}</h3>
              <div class="flex items-center space-x-2 mt-1">
                <span class={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getEventTypeColor(log.eventType)}`}>
                  {log.eventType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </span>
                <span class={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getUserTypeColor(log)}`}>
                  {getUserTypeLabel(log)}
                </span>
              </div>
            </div>
            <button 
              class="p-1 text-slate-600 hover:text-slate-900 transition-colors duration-200 ml-2" 
              title="View Details"
              on:click={() => openDetailModal(log)}
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
            </button>
          </div>
          
          <div class="space-y-2 text-xs text-gray-600">
            <div class="flex items-center">
              <svg class="h-3 w-3 mr-2 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <rect width="20" height="14" x="2" y="5" rx="2"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M22 5 12 13 2 5"/>
              </svg>
              <span class="truncate">{log.userEmail || 'N/A'}</span>
            </div>
            <div class="flex items-center">
              <svg class="h-3 w-3 mr-2 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
              </svg>
              <span class="font-mono">{log.ipAddress || 'N/A'}</span>
            </div>
            <div class="flex items-start">
              <svg class="h-3 w-3 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
              <span class="truncate">{log.browser || 'N/A'}</span>
            </div>
          </div>

          <div class="mt-3 pt-3 border-t border-gray-100">
            <div class="text-xs text-gray-600">
              <div class="font-medium">{formatDateTimeMobile(log.eventTime)}</div>
            </div>
          </div>
        </div>
      {/each}
    </div>

    <!-- Pagination -->
    <div class="bg-white px-4 lg:px-6 py-4 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="text-sm text-slate-700 order-2 sm:order-1">
        Showing <span class="font-semibold">1</span> to <span class="font-semibold">{filteredLogs.length}</span> of
        <span class="font-semibold">{filteredLogs.length}</span> results
      </div>
      <nav class="relative z-0 inline-flex rounded-lg shadow-sm -space-x-px order-1 sm:order-2">
        <button class="relative inline-flex items-center px-3 py-2 border border-slate-300 text-sm font-medium rounded-l-lg text-slate-500 bg-white hover:bg-slate-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
          <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          <span class="hidden sm:inline">Previous</span>
        </button>
        <button class="relative inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium text-slate-700 bg-slate-50" disabled>
          1
        </button>
        <button class="relative inline-flex items-center px-3 py-2 border border-slate-300 text-sm font-medium rounded-r-lg text-slate-500 bg-white hover:bg-slate-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
          <span class="hidden sm:inline">Next</span>
          <svg class="h-4 w-4 ml-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </nav>
    </div>
  </div>

  <!-- Detail Modal -->
  {#if isDetailModalOpen && selectedLog}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div class="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h3 class="text-lg font-bold text-slate-900">Security Log Details</h3>
          <button 
            class="text-slate-400 hover:text-slate-600 transition-colors"
            on:click={closeDetailModal}
          >
            <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        <div class="p-6 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-semibold text-slate-600 uppercase tracking-wider">Event Type</label>
              <div class="mt-1">
                <span class={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getEventTypeColor(selectedLog.eventType)}`}>
                  {selectedLog.eventType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </span>
              </div>
            </div>
            <div>
              <label class="text-xs font-semibold text-slate-600 uppercase tracking-wider">User Type</label>
              <div class="mt-1">
                <span class={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getUserTypeColor(selectedLog)}`}>
                  {getUserTypeLabel(selectedLog)}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label class="text-xs font-semibold text-slate-600 uppercase tracking-wider">User Name</label>
            <p class="mt-1 text-sm text-slate-900">{selectedLog.userName || 'Unknown'}</p>
          </div>

          <div>
            <label class="text-xs font-semibold text-slate-600 uppercase tracking-wider">Email</label>
            <p class="mt-1 text-sm text-slate-900">{selectedLog.userEmail || 'N/A'}</p>
          </div>

          <div>
            <label class="text-xs font-semibold text-slate-600 uppercase tracking-wider">Event Time</label>
            <p class="mt-1 text-sm text-slate-900">{formatDateTime(selectedLog.eventTime)}</p>
          </div>

          <div>
            <label class="text-xs font-semibold text-slate-600 uppercase tracking-wider">IP Address</label>
            <p class="mt-1 text-sm text-slate-900 font-mono">{selectedLog.ipAddress || 'N/A'}</p>
          </div>

          <div>
            <label class="text-xs font-semibold text-slate-600 uppercase tracking-wider">Browser</label>
            <p class="mt-1 text-sm text-slate-900 break-words">{selectedLog.browser || 'N/A'}</p>
          </div>

          <div>
            <label class="text-xs font-semibold text-slate-600 uppercase tracking-wider">Role</label>
            <p class="mt-1 text-sm text-slate-900">{selectedLog.role ? selectedLog.role.charAt(0).toUpperCase() + selectedLog.role.slice(1) : 'N/A'}</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-semibold text-slate-600 uppercase tracking-wider">Account ID</label>
              <p class="mt-1 text-sm text-slate-900">{selectedLog.accountId || 'N/A'}</p>
            </div>
            <div>
              <label class="text-xs font-semibold text-slate-600 uppercase tracking-wider">User ID</label>
              <p class="mt-1 text-sm text-slate-900">{selectedLog.userId || 'N/A'}</p>
            </div>
          </div>

          <div>
            <label class="text-xs font-semibold text-slate-600 uppercase tracking-wider">Log ID</label>
            <p class="mt-1 text-sm text-slate-900 font-mono">#{selectedLog.id}</p>
          </div>

          <div>
            <label class="text-xs font-semibold text-slate-600 uppercase tracking-wider">Created At</label>
            <p class="mt-1 text-sm text-slate-900">{formatDateTime(selectedLog.createdAt)}</p>
          </div>
        </div>

        <div class="sticky bottom-0 bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end">
          <button 
            class="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors font-medium"
            on:click={closeDetailModal}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  {/if}
</Layout>