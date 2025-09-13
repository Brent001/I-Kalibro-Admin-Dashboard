<script lang="ts">
  import Layout from "$lib/components/ui/layout.svelte";
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';

  // Types
  interface Overview {
    totalVisits: number;
    totalTransactions: number;
    activeBorrowings: number;
    overdueBooks: number;
    totalPenalties: number;
    availableBooks: number;
  }

  interface ChartData {
    dailyVisits: Array<{date: string; count: number}>;
    transactionTypes: Array<{type: string; count: number}>;
    categoryDistribution: Array<{category: string; count: number; percentage: number}>;
    penaltyTrends: Array<{date: string; amount: number}>;
    memberActivity: Array<{type: string; active: number; new: number}>;
  }

  interface TableData {
    topBooks: Array<{title: string; author: string; borrowCount: number}>;
    overdueList: Array<{bookTitle: string; borrowerName: string; daysOverdue: number; fine: number}>;
  }

  interface DashboardData {
    overview: Overview;
    charts: ChartData;
    tables: TableData;
  }

  // Reactive stores
  const loading = writable(true);
  const error = writable<string>('');
  const dashboardData = writable<DashboardData>({
    overview: {
      totalVisits: 0, totalTransactions: 0, activeBorrowings: 0,
      overdueBooks: 0, totalPenalties: 0, availableBooks: 0
    },
    charts: {
      dailyVisits: [], transactionTypes: [], categoryDistribution: [],
      penaltyTrends: [], memberActivity: []
    },
    tables: { topBooks: [], overdueList: [] }
  });

  // Configuration
  const PERIOD_OPTIONS = [
    { value: "week", label: "Last 7 Days" },
    { value: "month", label: "Last 30 Days" },
    { value: "quarter", label: "Last 3 Months" },
    { value: "year", label: "Last 12 Months" }
  ] as const;

  const METRIC_CONFIGS = [
    { key: 'totalVisits', label: 'Total Visits', icon: 'users', color: 'blue' },
    { key: 'totalTransactions', label: 'Transactions', icon: 'check', color: 'green' },
    { key: 'activeBorrowings', label: 'Active Borrowings', icon: 'book', color: 'yellow' },
    { key: 'overdueBooks', label: 'Overdue Books', icon: 'clock', color: 'red' },
    { key: 'totalPenalties', label: 'Total Penalties', icon: 'dollar', color: 'purple', format: 'currency' },
    { key: 'availableBooks', label: 'Available Books', icon: 'library', color: 'indigo' }
  ] as const;

  const ICON_PATHS = {
    users: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
    check: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    book: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
    clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    dollar: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1",
    library: "M8 14v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
  } as const;

  const COLOR_CLASSES = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    red: 'bg-red-100 text-red-600',
    purple: 'bg-purple-100 text-purple-600',
    indigo: 'bg-indigo-100 text-indigo-600'
  } as const;

  // State
  let selectedPeriod = 'month';
  let chartInstances: Record<string, any> = {};

  // Utils
  const formatCurrency = (amount: number): string => `₱${(amount / 100).toFixed(2)}`;
  const formatNumber = (num: number): string => num.toLocaleString();
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatValue = (value: number, format?: string): string => {
    return format === 'currency' ? formatCurrency(value) : formatNumber(value);
  };

  // API functions
  async function fetchDashboardData(period: string): Promise<DashboardData> {
    const response = await fetch(`/api/reports?period=${period}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'API request failed');
    }
    return result.data;
  }

  async function exportReport(): Promise<void> {
    const response = await fetch(`/api/reports/export?period=${selectedPeriod}`);
    if (!response.ok) throw new Error('Export failed');
    
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `library_report_${selectedPeriod}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Chart functions
  async function loadChartJS() {
    if (typeof window !== 'undefined' && !window.Chart) {
      return new Promise<void>((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js';
        script.onload = () => resolve();
        document.head.appendChild(script);
      });
    }
  }

  function createChart(canvasId: string, config: any): any {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) return null;
    
    // Destroy existing chart
    if (chartInstances[canvasId]) {
      chartInstances[canvasId].destroy();
    }
    
    chartInstances[canvasId] = new (window as any).Chart(canvas, config);
    return chartInstances[canvasId];
  }

  function createGradient(canvas: HTMLCanvasElement, colorStops: [number, string][]): CanvasGradient {
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    colorStops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
    return gradient;
  }

  function initializeCharts(data: DashboardData): void {
    // Daily Visits Chart
    const visitsCanvas = document.getElementById('visitsChart') as HTMLCanvasElement;
    if (visitsCanvas) {
      createChart('visitsChart', {
        type: 'line',
        data: {
          labels: data.charts.dailyVisits.map(d => formatDate(d.date)),
          datasets: [{
            label: 'Daily Visits',
            data: data.charts.dailyVisits.map(d => d.count),
            borderColor: '#3B82F6',
            backgroundColor: createGradient(visitsCanvas, [[0, 'rgba(59, 130, 246, 0.3)'], [1, 'rgba(59, 130, 246, 0.05)']]),
            borderWidth: 3,
            pointBackgroundColor: '#3B82F6',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 5,
            tension: 0.4,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: true }
          }
        }
      });
    }

    // Transaction Types Chart
    createChart('transactionsChart', {
      type: 'doughnut',
      data: {
        labels: data.charts.transactionTypes.map(d => d.type),
        datasets: [{
          data: data.charts.transactionTypes.map(d => d.count),
          backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });

    // Categories Chart
    createChart('categoriesChart', {
      type: 'bar',
      data: {
        labels: data.charts.categoryDistribution.map(d => d.category.length > 12 ? d.category.slice(0, 12) + '...' : d.category),
        datasets: [{
          data: data.charts.categoryDistribution.map(d => d.count),
          backgroundColor: '#6366F1',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true },
          y: { grid: { display: false } }
        }
      }
    });

    // Penalties Chart
    const penaltiesCanvas = document.getElementById('penaltiesChart') as HTMLCanvasElement;
    if (penaltiesCanvas) {
      createChart('penaltiesChart', {
        type: 'line',
        data: {
          labels: data.charts.penaltyTrends.map(d => formatDate(d.date)),
          datasets: [{
            label: 'Penalties (₱)',
            data: data.charts.penaltyTrends.map(d => d.amount / 100),
            borderColor: '#EF4444',
            backgroundColor: createGradient(penaltiesCanvas, [[0, 'rgba(239, 68, 68, 0.3)'], [1, 'rgba(239, 68, 68, 0.05)']]),
            borderWidth: 3,
            tension: 0.4,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false } },
            y: { 
              beginAtZero: true,
              ticks: { callback: (value: any) => '₱' + value }
            }
          }
        }
      });
    }
  }

  // Event handlers
  async function handlePeriodChange(): Promise<void> {
    await loadData();
  }

  async function handleExport(): Promise<void> {
    try {
      await exportReport();
    } catch (err) {
      error.set('Export failed. Please try again.');
    }
  }

  // Main data loading function
  async function loadData(): Promise<void> {
    loading.set(true);
    error.set('');
    
    try {
      const data = await fetchDashboardData(selectedPeriod);
      dashboardData.set(data);
      
      // Initialize charts after data is loaded
      if (typeof window !== 'undefined' && (window as any).Chart) {
        setTimeout(() => initializeCharts(data), 100);
      }
    } catch (err) {
      error.set(err instanceof Error ? err.message : 'Failed to load dashboard data');
      console.error('Dashboard load error:', err);
    } finally {
      loading.set(false);
    }
  }

  // Component lifecycle
  onMount(async () => {
    await loadChartJS();
    await loadData();
  });

  // Reactive statements for chart updates
  $: if ($dashboardData && typeof window !== 'undefined' && (window as any).Chart) {
    initializeCharts($dashboardData);
  }
</script>

<Layout>
  <div class="space-y-6 px-0 lg:px-6">
    <!-- Header Controls -->
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-end space-y-3 sm:space-y-0 sm:space-x-3">
      <select
        bind:value={selectedPeriod}
        on:change={handlePeriodChange}
        class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
        disabled={$loading}
      >
        {#each PERIOD_OPTIONS as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
      
      <button 
        on:click={handleExport}
        disabled={$loading}
        class="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
      >
        <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        Export Report
      </button>
      
      <button
        on:click={() => window.location.href = '/dashboard/reports/visits'}
        class="inline-flex items-center justify-center px-4 py-2 border border-indigo-300 text-sm font-medium rounded-lg text-indigo-700 bg-white hover:bg-indigo-50 transition-colors"
      >
        <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
        </svg>
        Visit Logs
      </button>
    </div>

    <!-- Error Display -->
    {#if $error}
      <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        {$error}
      </div>
    {/if}

    <!-- Loading State -->
    {#if $loading}
      <div class="text-center py-16">
        <div class="inline-flex items-center">
          <svg class="animate-spin -ml-1 mr-3 h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="text-lg font-medium text-gray-700">Loading analytics...</span>
        </div>
      </div>
    {:else}
      <!-- Metrics Cards -->
      <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {#each METRIC_CONFIGS as config}
          <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div class="flex items-center space-x-3">
              <div class="p-3 {COLOR_CLASSES[config.color]} rounded-xl">
                <svg class="h-5 w-5 lg:h-6 lg:w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="{ICON_PATHS[config.icon]}"/>
                </svg>
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-xs lg:text-sm font-medium text-gray-600">{config.label}</p>
                <p class="text-xl lg:text-2xl font-bold text-gray-900">
                  {formatValue($dashboardData.overview[config.key], config.format)}
                </p>
              </div>
            </div>
          </div>
        {/each}
      </div>

      <!-- Main Chart -->
      <div class="bg-white p-6 lg:p-8 rounded-xl shadow-sm border border-gray-200">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="text-xl font-bold text-gray-900">Daily Visits Trend</h3>
            <p class="text-sm text-gray-500 mt-1">Visitor activity over the selected period</p>
          </div>
        </div>
        <div class="h-72">
          <canvas id="visitsChart"></canvas>
        </div>
      </div>

      <!-- Secondary Charts -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 class="text-lg font-bold text-gray-900 mb-4">Transaction Types</h3>
          <div class="h-64">
            <canvas id="transactionsChart"></canvas>
          </div>
        </div>

        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 class="text-lg font-bold text-gray-900 mb-4">Book Categories</h3>
          <div class="h-64">
            <canvas id="categoriesChart"></canvas>
          </div>
        </div>
      </div>

      <!-- Penalties Chart -->
      <div class="bg-white p-6 lg:p-8 rounded-xl shadow-sm border border-gray-200">
        <h3 class="text-xl font-bold text-gray-900 mb-6">Penalty Collections</h3>
        <div class="h-72">
          <canvas id="penaltiesChart"></canvas>
        </div>
      </div>

      <!-- Member Activity -->
      <div class="bg-white p-6 lg:p-8 rounded-xl shadow-sm border border-gray-200">
        <h3 class="text-xl font-bold text-gray-900 mb-6">Member Activity Summary</h3>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {#each $dashboardData.charts.memberActivity as activity}
            <div class="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-xl border border-gray-200">
              <div class="flex flex-col space-y-2">
                <span class="text-sm font-medium text-gray-900">{activity.type}</span>
                <div class="flex items-end justify-between">
                  <div>
                    <p class="text-3xl font-bold text-gray-900">{activity.active}</p>
                    <p class="text-xs text-gray-600">Active</p>
                  </div>
                  <div class="text-right">
                    <p class="text-lg font-semibold text-green-600">+{activity.new}</p>
                    <p class="text-xs text-gray-500">New</p>
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Data Tables -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <!-- Top Books -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200">
          <div class="p-6 border-b border-gray-200">
            <h3 class="text-lg font-bold text-gray-900">Most Popular Books</h3>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Rank</th>
                  <th class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Book Details</th>
                  <th class="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Borrows</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {#each $dashboardData.tables.topBooks as book, index}
                  <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-6 py-4">
                      <div class="flex items-center justify-center w-8 h-8 rounded-full {index < 3 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'} text-sm font-bold">
                        {index + 1}
                      </div>
                    </td>
                    <td class="px-6 py-4">
                      <div>
                        <div class="text-sm font-semibold text-gray-900 truncate max-w-xs">{book.title}</div>
                        <div class="text-sm text-gray-500">by {book.author}</div>
                      </div>
                    </td>
                    <td class="px-6 py-4 text-center">
                      <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {book.borrowCount} times
                      </span>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Overdue Books -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200">
          <div class="p-6 border-b border-gray-200">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-bold text-gray-900">Overdue Books</h3>
              <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {$dashboardData.tables.overdueList.length} items
              </span>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Book & Borrower</th>
                  <th class="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Days Overdue</th>
                  <th class="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Fine</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {#each $dashboardData.tables.overdueList as overdue}
                  <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-6 py-4">
                      <div>
                        <div class="text-sm font-semibold text-gray-900 truncate max-w-xs">{overdue.bookTitle}</div>
                        <div class="text-sm text-gray-500">Borrowed by {overdue.borrowerName}</div>
                      </div>
                    </td>
                    <td class="px-6 py-4 text-center">
                      <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium {overdue.daysOverdue <= 3 ? 'bg-yellow-100 text-yellow-800' : overdue.daysOverdue <= 7 ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'}">
                        {overdue.daysOverdue} days
                      </span>
                    </td>
                    <td class="px-6 py-4 text-right">
                      <span class="text-sm font-semibold text-gray-900">{formatCurrency(overdue.fine)}</span>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    {/if}
  </div>
</Layout>