<script lang="ts">
  import Layout from "$lib/components/ui/layout.svelte";
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation'; // Add this line

  // --- Add these interfaces ---
  interface PopularBook {
    title: string;
    author: string;
    borrowCount: number;
  }
  interface RecentActivity {
    type: string;
    description: string;
    timestamp: string;
  }
  interface VisitorType {
    type: string;
    count: number;
  }
  interface OverdueBook {
    bookTitle: string;
    bookAuthor: string;
    borrowerName: string;
    borrowerType: string;
    dueDate: string;
    daysOverdue: number;
    fine: number;
  }
  interface Penalty {
    memberName: string;
    memberType: string;
    type: string;
    amount: number;
    date: string;
    status: string;
  }
  interface TopBorrower {
    name: string;
    type: string;
    bookCount: number;
  }
  interface CategoryStat {
    name: string;
    count: number;
    percentage: number;
  }
  interface PopularAuthor {
    name: string;
    bookCount: number;
    borrowCount: number;
    popularity: number;
  }
  // --- End interfaces ---

  let loading = true;
  let errorMsg = "";
  let selectedPeriod = "month";
  let selectedReport = "overview";
  
  const periodOptions = [
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "quarter", label: "This Quarter" },
    { value: "year", label: "This Year" },
    { value: "custom", label: "Custom Range" }
  ];

  const reportTypes = [
    { value: "overview", label: "Overview" },
    { value: "visits", label: "Library Visits" },
    { value: "transactions", label: "Book Transactions" },
    { value: "penalties", label: "Penalties & Fines" },
    { value: "members", label: "Member Activity" },
    { value: "books", label: "Book Analytics" }
  ];

  // --- Add types to dashboardData ---
  let dashboardData: {
    overview: {
      totalVisits: number;
      totalTransactions: number;
      activeBorrowings: number;
      overdueBooks: number;
      totalPenalties: number;
      newMembers: number;
      popularBooks: PopularBook[];
      recentActivity: RecentActivity[];
    };
    visits: {
      totalVisits: number;
      dailyVisits: any[];
      visitorTypes: VisitorType[];
      peakHours: any[];
      averageDuration: string;
    };
    transactions: {
      totalTransactions: number;
      byType: any[];
      dailyTransactions: any[];
      topBooks: any[];
      overdueList: OverdueBook[];
    };
    penalties: {
      totalAmount: number;
      paidAmount: number;
      unpaidAmount: number;
      byType: any[];
      recentPenalties: Penalty[];
    };
    members: {
      activeMembers: number;
      newThisMonth: number;
      topBorrowers: TopBorrower[];
      memberActivity: any[];
    };
    books: {
      totalBooks: number;
      availableBooks: number;
      issuedBooks: number;
      reservedBooks: number;
      categoryStats: CategoryStat[];
      popularAuthors: PopularAuthor[];
    };
  } = {
    overview: {
      totalVisits: 0,
      totalTransactions: 0,
      activeBorrowings: 0,
      overdueBooks: 0,
      totalPenalties: 0,
      newMembers: 0,
      popularBooks: [],
      recentActivity: []
    },
    visits: {
      totalVisits: 0,
      dailyVisits: [],
      visitorTypes: [],
      peakHours: [],
      averageDuration: "0:00"
    },
    transactions: {
      totalTransactions: 0,
      byType: [],
      dailyTransactions: [],
      topBooks: [],
      overdueList: []
    },
    penalties: {
      totalAmount: 0,
      paidAmount: 0,
      unpaidAmount: 0,
      byType: [],
      recentPenalties: []
    },
    members: {
      activeMembers: 0,
      newThisMonth: 0,
      topBorrowers: [],
      memberActivity: []
    },
    books: {
      totalBooks: 0,
      availableBooks: 0,
      issuedBooks: 0,
      reservedBooks: 0,
      categoryStats: [],
      popularAuthors: []
    }
  };
  // --- End dashboardData typing ---

  onMount(async () => {
    await loadReports();
  });

  async function loadReports() {
    loading = true;
    errorMsg = "";
    try {
      const res = await fetch(`/api/reports?period=${selectedPeriod}&type=${selectedReport}`);
      const data = await res.json();
      if (res.ok && data.success) {
        // Fix: Map recentActivity to show real data from the database
        if (data.data?.overview?.recentActivity && Array.isArray(data.data.overview.recentActivity)) {
          // If your backend now returns real activity, you can use it directly
          dashboardData = { ...dashboardData, ...data.data };
        } else {
          // fallback for old dummy data
          dashboardData = { ...dashboardData, ...data.data };
        }
      } else {
        errorMsg = data.message || "Failed to load reports.";
      }
    } catch (err) {
      errorMsg = "Network error. Please try again.";
    } finally {
      loading = false;
    }
  }

  async function handlePeriodChange() {
    await loadReports();
  }

  async function handleReportChange() {
    await loadReports();
  }

  function formatCurrency(amount: number) {
    return `₱${(amount / 100).toFixed(2)}`;
  }

  function formatDuration(duration: string) {
    return duration || "0:00";
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'active':
      case 'returned':
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'overdue':
      case 'unpaid':
        return 'bg-red-100 text-red-800';
      case 'partial':
      case 'renewed':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  }

  function exportReport() {
    // Implementation for exporting reports
    console.log("Exporting report for:", selectedReport, selectedPeriod);
  }

  function goToVisitLogs() {
    goto('/dashboard/reports/visits');
  }
</script>

<Layout>
  <div class="space-y-4 lg:space-y-6">
    <!-- Error Messages -->
    {#if errorMsg}
      <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
        {errorMsg}
      </div>
    {/if}

    <!-- Header -->
    <div class="flex flex-col space-y-3 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
      <div>
        <h2 class="text-xl lg:text-2xl font-bold text-gray-900">Reports & Analytics</h2>
        <p class="text-sm lg:text-base text-gray-600">Library performance and activity insights</p>
      </div>
      <div class="flex flex-col space-y-2 lg:flex-row lg:space-y-0 lg:space-x-3">
        <button on:click={exportReport} class="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors duration-200">
          <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          Export Report
        </button>
        <!-- Visit Logs Button -->
        <button class="inline-flex items-center justify-center px-4 py-2 border border-indigo-300 text-sm font-medium rounded-md text-indigo-700 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200" on:click={goToVisitLogs}>
          <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 4v16c0 .552.448 1 1 1h12a1 1 0 001-1V4M9 2h6a2 2 0 012 2v0a2 2 0 01-2 2H9A2 2 0 017 4v0a2 2 0 012-2z"/>
          </svg>
          Visit Logs
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-white p-4 lg:p-6 rounded-lg shadow-sm border">
      <div class="flex flex-col space-y-3 lg:flex-row lg:space-y-0 lg:gap-4">
        <div class="flex-1">
          <label class="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
          <select
            bind:value={selectedReport}
            on:change={handleReportChange}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm lg:text-base"
          >
            {#each reportTypes as type}
              <option value={type.value}>{type.label}</option>
            {/each}
          </select>
        </div>
        <div class="flex-1">
          <label class="block text-sm font-medium text-gray-700 mb-1">Time Period</label>
          <select
            bind:value={selectedPeriod}
            on:change={handlePeriodChange}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm lg:text-base"
          >
            {#each periodOptions as period}
              <option value={period.value}>{period.label}</option>
            {/each}
          </select>
        </div>
      </div>
    </div>

    {#if loading}
      <div class="text-center py-8 text-slate-500">Loading reports...</div>
    {:else}
      <!-- Overview Report -->
      {#if selectedReport === "overview"}
        {#if dashboardData.overview.totalVisits === 0 && dashboardData.overview.totalTransactions === 0}
          <div class="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md text-center my-6">
            No overview data available for the selected period.
          </div>
        {/if}

        <!-- Key Metrics Cards -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <div class="bg-white p-3 lg:p-4 rounded-lg shadow-sm border">
            <div class="flex items-center">
              <div class="p-2 bg-blue-100 rounded-lg">
                <svg class="h-4 w-4 lg:h-6 lg:w-6 text-blue-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                </svg>
              </div>
              <div class="ml-2 lg:ml-4">
                <p class="text-xs lg:text-sm font-medium text-gray-600">Library Visits</p>
                <p class="text-lg lg:text-2xl font-semibold text-gray-900">{dashboardData.overview.totalVisits.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div class="bg-white p-3 lg:p-4 rounded-lg shadow-sm border">
            <div class="flex items-center">
              <div class="p-2 bg-green-100 rounded-lg">
                <svg class="h-4 w-4 lg:h-6 lg:w-6 text-green-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                </svg>
              </div>
              <div class="ml-2 lg:ml-4">
                <p class="text-xs lg:text-sm font-medium text-gray-600">Transactions</p>
                <p class="text-lg lg:text-2xl font-semibold text-gray-900">{dashboardData.overview.totalTransactions.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div class="bg-white p-3 lg:p-4 rounded-lg shadow-sm border">
            <div class="flex items-center">
              <div class="p-2 bg-yellow-100 rounded-lg">
                <svg class="h-4 w-4 lg:h-6 lg:w-6 text-yellow-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div class="ml-2 lg:ml-4">
                <p class="text-xs lg:text-sm font-medium text-gray-600">Overdue Books</p>
                <p class="text-lg lg:text-2xl font-semibold text-gray-900">{dashboardData.overview.overdueBooks}</p>
              </div>
            </div>
          </div>

          <div class="bg-white p-3 lg:p-4 rounded-lg shadow-sm border">
            <div class="flex items-center">
              <div class="p-2 bg-red-100 rounded-lg">
                <svg class="h-4 w-4 lg:h-6 lg:w-6 text-red-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>
                </svg>
              </div>
              <div class="ml-2 lg:ml-4">
                <p class="text-xs lg:text-sm font-medium text-gray-600">Total Penalties</p>
                <p class="text-lg lg:text-2xl font-semibold text-gray-900">{formatCurrency(dashboardData.overview.totalPenalties)}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Popular Books and Recent Activity -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          <!-- Popular Books -->
          <div class="bg-white rounded-lg shadow-sm border">
            <div class="p-4 lg:p-6 border-b border-gray-200">
              <h3 class="text-lg font-semibold text-gray-900">Most Popular Books</h3>
            </div>
            <div class="p-4 lg:p-6">
              {#if dashboardData.overview.popularBooks.length === 0}
                <div class="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md text-center">
                  No popular books data available for the selected period.
                </div>
              {:else}
                <div class="space-y-4">
                  {#each dashboardData.overview.popularBooks.slice(0, 5) as book}
                    <div class="flex items-center justify-between">
                      <div class="flex-1">
                        <div class="font-medium text-gray-900 text-sm">{book.title}</div>
                        <div class="text-xs text-gray-500">{book.author}</div>
                      </div>
                      <div class="text-right">
                        <div class="font-medium text-slate-900">{book.borrowCount}</div>
                        <div class="text-xs text-gray-500">borrows</div>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </div>

          <!-- Recent Activity -->
          <div class="bg-white rounded-lg shadow-sm border">
            <div class="p-4 lg:p-6 border-b border-gray-200">
              <h3 class="text-lg font-semibold text-gray-900">Recent Activity</h3>
            </div>
            <div class="p-4 lg:p-6">
              {#if dashboardData.overview.recentActivity.length === 0}
                <div class="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md text-center">
                  No recent activity data available for the selected period.
                </div>
              {:else}
                <div class="space-y-4">
                  {#each dashboardData.overview.recentActivity.slice(0, 5) as activity}
                    <div class="flex items-center space-x-3">
                      <div class="flex-shrink-0">
                        <div class={`w-2 h-2 rounded-full ${activity.type === 'borrow' ? 'bg-green-500' : activity.type === 'return' ? 'bg-blue-500' : 'bg-gray-500'}`}></div>
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="text-sm text-gray-900">{activity.description}</div>
                        <div class="text-xs text-gray-500">
                          {new Date(activity.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/if}

      <!-- Library Visits Report -->
      {#if selectedReport === "visits"}
        {#if dashboardData.visits.totalVisits === 0}
          <div class="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md text-center my-6">
            No visit logs found for the selected period.
          </div>
        {/if}
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          <!-- Visit Statistics -->
          <div class="lg:col-span-1 space-y-4">
            <div class="bg-white p-4 lg:p-6 rounded-lg shadow-sm border">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Visit Statistics</h3>
              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-sm text-gray-600">Total Visits</span>
                  <span class="font-medium">{dashboardData.visits.totalVisits.toLocaleString()}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-600">Avg. Duration</span>
                  <span class="font-medium">{formatDuration(dashboardData.visits.averageDuration)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-600">Peak Hours</span>
                  <span class="font-medium">2:00 PM - 4:00 PM</span>
                </div>
              </div>
            </div>

            <!-- Visitor Types -->
            <div class="bg-white p-4 lg:p-6 rounded-lg shadow-sm border">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Visitor Types</h3>
              <div class="space-y-3">
                {#each dashboardData.visits.visitorTypes as type}
                  <div class="flex items-center justify-between">
                    <div class="flex items-center">
                      <div class={`w-3 h-3 rounded-full mr-2 ${type.type === 'student' ? 'bg-blue-500' : type.type === 'faculty' ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                      <span class="text-sm capitalize">{type.type}</span>
                    </div>
                    <span class="font-medium">{type.count}</span>
                  </div>
                {/each}
              </div>
            </div>
          </div>

          <!-- Daily Visits Chart Area -->
          <div class="lg:col-span-2">
            <div class="bg-white p-4 lg:p-6 rounded-lg shadow-sm border">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Daily Visits Trend</h3>
              <div class="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                <p class="text-gray-500">Chart visualization would be implemented here</p>
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Book Transactions Report -->
      {#if selectedReport === "transactions"}
        {#if dashboardData.transactions.totalTransactions === 0}
          <div class="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md text-center my-6">
            No book transactions found for the selected period.
          </div>
        {/if}
        <div class="space-y-4 lg:space-y-6">
          <!-- Transaction Statistics -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            <div class="bg-white p-3 lg:p-4 rounded-lg shadow-sm border">
              <div class="text-center">
                <p class="text-xs lg:text-sm font-medium text-gray-600">Total Transactions</p>
                <p class="text-lg lg:text-2xl font-semibold text-gray-900">{dashboardData.transactions.totalTransactions}</p>
              </div>
            </div>
            <div class="bg-white p-3 lg:p-4 rounded-lg shadow-sm border">
              <div class="text-center">
                <p class="text-xs lg:text-sm font-medium text-gray-600">Books Borrowed</p>
                <p class="text-lg lg:text-2xl font-semibold text-green-600">125</p>
              </div>
            </div>
            <div class="bg-white p-3 lg:p-4 rounded-lg shadow-sm border">
              <div class="text-center">
                <p class="text-xs lg:text-sm font-medium text-gray-600">Books Returned</p>
                <p class="text-lg lg:text-2xl font-semibold text-blue-600">98</p>
              </div>
            </div>
            <div class="bg-white p-3 lg:p-4 rounded-lg shadow-sm border">
              <div class="text-center">
                <p class="text-xs lg:text-sm font-medium text-gray-600">Renewals</p>
                <p class="text-lg lg:text-2xl font-semibold text-yellow-600">34</p>
              </div>
            </div>
          </div>

          <!-- Overdue Books List -->
          <div class="bg-white rounded-lg shadow-sm border">
            <div class="p-4 lg:p-6 border-b border-gray-200">
              <h3 class="text-lg font-semibold text-gray-900">Overdue Books</h3>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-slate-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Book</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Borrower</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Due Date</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Days Overdue</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Fine</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  {#each dashboardData.transactions.overdueList.slice(0, 10) as overdue}
                    <tr class="hover:bg-slate-50">
                      <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm font-medium text-gray-900">{overdue.bookTitle}</div>
                        <div class="text-sm text-gray-500">{overdue.bookAuthor}</div>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm text-gray-900">{overdue.borrowerName}</div>
                        <div class="text-sm text-gray-500">{overdue.borrowerType}</div>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {overdue.dueDate}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(penalty.status)}`}>
                          {penalty.status}
                        </span>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      {/if}

      <!-- Member Activity Report -->
      {#if selectedReport === "members"}
        {#if dashboardData.members.activeMembers === 0}
          <div class="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md text-center my-6">
            No member activity found for the selected period.
          </div>
        {/if}
        <div class="space-y-4 lg:space-y-6">
          <!-- Member Statistics -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            <div class="bg-white p-3 lg:p-4 rounded-lg shadow-sm border">
              <div class="text-center">
                <p class="text-xs lg:text-sm font-medium text-gray-600">Active Members</p>
                <p class="text-lg lg:text-2xl font-semibold text-gray-900">{dashboardData.members.activeMembers}</p>
              </div>
            </div>
            <div class="bg-white p-3 lg:p-4 rounded-lg shadow-sm border">
              <div class="text-center">
                <p class="text-xs lg:text-sm font-medium text-gray-600">New This Month</p>
                <p class="text-lg lg:text-2xl font-semibold text-green-600">{dashboardData.members.newThisMonth}</p>
              </div>
            </div>
            <div class="bg-white p-3 lg:p-4 rounded-lg shadow-sm border">
              <div class="text-center">
                <p class="text-xs lg:text-sm font-medium text-gray-600">Students</p>
                <p class="text-lg lg:text-2xl font-semibold text-blue-600">245</p>
              </div>
            </div>
            <div class="bg-white p-3 lg:p-4 rounded-lg shadow-sm border">
              <div class="text-center">
                <p class="text-xs lg:text-sm font-medium text-gray-600">Faculty</p>
                <p class="text-lg lg:text-2xl font-semibold text-slate-600">68</p>
              </div>
            </div>
          </div>

          <!-- Top Borrowers -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            <div class="bg-white rounded-lg shadow-sm border">
              <div class="p-4 lg:p-6 border-b border-gray-200">
                <h3 class="text-lg font-semibold text-gray-900">Top Borrowers This Month</h3>
              </div>
              <div class="p-4 lg:p-6">
                <div class="space-y-4">
                  {#each dashboardData.members.topBorrowers.slice(0, 5) as borrower}
                    <div class="flex items-center justify-between">
                      <div class="flex items-center">
                        <div class="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-sm font-medium text-slate-700">
                          {borrower.name.charAt(0)}
                        </div>
                        <div class="ml-3">
                          <div class="text-sm font-medium text-gray-900">{borrower.name}</div>
                          <div class="text-xs text-gray-500">{borrower.type}</div>
                        </div>
                      </div>
                      <div class="text-right">
                        <div class="text-sm font-medium text-slate-900">{borrower.bookCount}</div>
                        <div class="text-xs text-gray-500">books</div>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            </div>

            <!-- Member Activity Chart -->
            <div class="bg-white rounded-lg shadow-sm border">
              <div class="p-4 lg:p-6 border-b border-gray-200">
                <h3 class="text-lg font-semibold text-gray-900">Member Activity Trend</h3>
              </div>
              <div class="p-4 lg:p-6">
                <div class="h-48 bg-gray-50 rounded-lg flex items-center justify-center">
                  <p class="text-gray-500">Activity chart would be implemented here</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Book Analytics Report -->
      {#if selectedReport === "books"}
        {#if dashboardData.books.totalBooks === 0}
          <div class="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md text-center my-6">
            No book analytics data found for the selected period.
          </div>
        {/if}
        <div class="space-y-4 lg:space-y-6">
          <!-- Book Statistics -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            <div class="bg-white p-3 lg:p-4 rounded-lg shadow-sm border">
              <div class="text-center">
                <p class="text-xs lg:text-sm font-medium text-gray-600">Total Books</p>
                <p class="text-lg lg:text-2xl font-semibold text-gray-900">{dashboardData.books.totalBooks}</p>
              </div>
            </div>
            <div class="bg-white p-3 lg:p-4 rounded-lg shadow-sm border">
              <div class="text-center">
                <p class="text-xs lg:text-sm font-medium text-gray-600">Available</p>
                <p class="text-lg lg:text-2xl font-semibold text-green-600">{dashboardData.books.availableBooks}</p>
              </div>
            </div>
            <div class="bg-white p-3 lg:p-4 rounded-lg shadow-sm border">
              <div class="text-center">
                <p class="text-xs lg:text-sm font-medium text-gray-600">Issued</p>
                <p class="text-lg lg:text-2xl font-semibold text-yellow-600">{dashboardData.books.issuedBooks}</p>
              </div>
            </div>
            <div class="bg-white p-3 lg:p-4 rounded-lg shadow-sm border">
              <div class="text-center">
                <p class="text-xs lg:text-sm font-medium text-gray-600">Reserved</p>
                <p class="text-lg lg:text-2xl font-semibold text-blue-600">{dashboardData.books.reservedBooks}</p>
              </div>
            </div>
          </div>

          <!-- Category Statistics and Popular Authors -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            <!-- Category Statistics -->
            <div class="bg-white rounded-lg shadow-sm border">
              <div class="p-4 lg:p-6 border-b border-gray-200">
                <h3 class="text-lg font-semibold text-gray-900">Books by Category</h3>
              </div>
              <div class="p-4 lg:p-6">
                <div class="space-y-4">
                  {#each dashboardData.books.categoryStats.slice(0, 6) as category}
                    <div class="flex items-center justify-between">
                      <div class="flex-1">
                        <div class="flex items-center justify-between">
                          <span class="text-sm font-medium text-gray-900">{category.name}</span>
                          <span class="text-sm text-gray-500">{category.count} books</span>
                        </div>
                        <div class="mt-1 w-full bg-gray-200 rounded-full h-2">
                          <div class="bg-slate-600 h-2 rounded-full" style="width: {category.percentage}%"></div>
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            </div>

            <!-- Popular Authors -->
            <div class="bg-white rounded-lg shadow-sm border">
              <div class="p-4 lg:p-6 border-b border-gray-200">
                <h3 class="text-lg font-semibold text-gray-900">Popular Authors</h3>
              </div>
              <div class="p-4 lg:p-6">
                <div class="space-y-4">
                  {#each dashboardData.books.popularAuthors.slice(0, 6) as author}
                    <div class="flex items-center justify-between">
                      <div class="flex-1">
                        <div class="text-sm font-medium text-gray-900">{author.name}</div>
                        <div class="text-xs text-gray-500">{author.bookCount} books • {author.borrowCount} borrows</div>
                      </div>
                      <div class="text-right">
                        <div class="text-sm font-medium text-slate-900">{author.popularity}%</div>
                        <div class="text-xs text-gray-500">popularity</div>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            </div>
          </div>
        </div>
      {/if}
    {/if}

    <!-- Export and Print Options -->
    <div class="bg-white p-4 lg:p-6 rounded-lg shadow-sm border">
      <div class="flex flex-col space-y-3 lg:flex-row lg:space-y-0 lg:items-center lg:justify-between">
        <div>
          <h3 class="text-sm font-medium text-gray-900">Export Options</h3>
          <p class="text-xs text-gray-500">Download reports in various formats</p>
        </div>
        <div class="flex flex-col space-y-2 lg:flex-row lg:space-y-0 lg:space-x-3">
          <button class="inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors duration-200">
            <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a4 4 0 01-4-4V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            PDF Report
          </button>
          <button class="inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors duration-200">
            <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a4 4 0 01-4-4V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            Excel Export
          </button>
          <button class="inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors duration-200">
            <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
            </svg>
            Print
          </button>
        </div>
      </div>
    </div>
  </div>
</Layout>