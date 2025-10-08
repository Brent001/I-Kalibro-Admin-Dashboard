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
    { key: 'totalVisits', label: 'Total Visits', icon: 'users', color: 'blue', gradient: 'from-blue-500 to-blue-600' },
    { key: 'totalTransactions', label: 'Transactions', icon: 'check', color: 'green', gradient: 'from-green-500 to-green-600' },
    { key: 'activeBorrowings', label: 'Active Borrowings', icon: 'book', color: 'yellow', gradient: 'from-yellow-500 to-yellow-600' },
    { key: 'overdueBooks', label: 'Overdue Books', icon: 'clock', color: 'red', gradient: 'from-red-500 to-red-600' },
    { key: 'totalPenalties', label: 'Total Penalties', icon: 'dollar', color: 'purple', format: 'currency', gradient: 'from-purple-500 to-purple-600' },
    { key: 'availableBooks', label: 'Available Books', icon: 'library', color: 'indigo', gradient: 'from-indigo-500 to-indigo-600' }
  ] as const;

  const ICON_PATHS = {
    users: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
    check: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    book: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
    clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    dollar: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1",
    library: "M8 14v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
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

  // Reactive statements
  $: if ($dashboardData && typeof window !== 'undefined' && (window as any).Chart) {
    initializeCharts($dashboardData);
  }
</script>

<Layout>
  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
    <div class="max-w-7xl mx-auto px-0 sm:px-1 lg:px-2 py-3">
      <!-- Header -->
      <div class="mb-4">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">Library Analytics</h1>
            <p class="mt-0.5 text-sm text-gray-600">Comprehensive overview of library operations and statistics</p>
          </div>
          
          <div class="flex flex-col sm:flex-row gap-2">
            <select
              bind:value={selectedPeriod}
              on:change={handlePeriodChange}
              class="px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-medium bg-white shadow-sm"
              disabled={$loading}
            >
              {#each PERIOD_OPTIONS as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
            
            <button 
              on:click={handleExport}
              disabled={$loading}
              class="inline-flex items-center justify-center px-2 py-1.5 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 shadow-sm transition-all duration-200 hover:shadow"
            >
              <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              Export
            </button>
            
            <button
              on:click={() => window.location.href = '/dashboard/reports/visits'}
              class="inline-flex items-center justify-center px-2 py-1.5 text-sm font-medium rounded-lg text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 shadow-sm transition-all duration-200 hover:shadow"
            >
              <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
              Visit Logs
            </button>
          </div>
        </div>
      </div>

      <!-- Error Display -->
      {#if $error}
        <div class="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-start shadow-sm">
          <svg class="h-5 w-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
          </svg>
          <span class="text-sm font-medium">{$error}</span>
        </div>
      {/if}

      {#if $loading}
        <!-- Skeleton Loading -->
        <div class="space-y-6">
          <!-- Skeleton Metrics -->
          <div class="overflow-x-auto pb-2">
            <div class="flex gap-2 min-w-[400px] sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {#each METRIC_CONFIGS as config}
                <div class="min-w-[120px] bg-white rounded-xl shadow-sm border border-gray-200 p-2 flex flex-col items-center justify-center animate-pulse">
                  <!-- Icon Skeleton -->
                  <div class="p-1.5 bg-gray-200 rounded-full mb-1 w-9 h-9 sm:w-11 sm:h-11"></div>
                  <!-- Value Skeleton -->
                  <div class="h-5 sm:h-6 bg-gray-200 rounded w-16 mb-1"></div>
                  <!-- Label Skeleton (mobile) -->
                  <div class="block sm:hidden h-3 bg-gray-200 rounded w-20 mt-0.5"></div>
                </div>
              {/each}
            </div>
          </div>

          <!-- Skeleton Main Chart -->
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:p-8 animate-pulse">
            <div class="flex items-start justify-between mb-6">
              <div class="flex-1">
                <div class="h-6 bg-gray-200 rounded w-48 mb-2"></div>
                <div class="h-4 bg-gray-200 rounded w-64"></div>
              </div>
              <div class="h-6 bg-gray-200 rounded-full w-20"></div>
            </div>
            <div class="h-80 bg-gray-100 rounded-lg"></div>
          </div>

          <!-- Skeleton Three Column Charts -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {#each ['Transaction Types', 'Book Categories', 'Penalty Collections'] as title}
              <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
                <div class="h-5 bg-gray-200 rounded w-40 mb-4"></div>
                <div class="h-64 bg-gray-100 rounded-lg"></div>
              </div>
            {/each}
          </div>

          <!-- Skeleton Member Activity -->
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:p-8 animate-pulse">
            <div class="h-6 bg-gray-200 rounded w-56 mb-6"></div>
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {#each Array(4) as _}
                <div class="bg-gradient-to-br from-gray-50 via-white to-gray-50 p-6 rounded-xl border border-gray-200">
                  <div class="h-4 bg-gray-200 rounded w-20 mb-4"></div>
                  <div class="flex items-end justify-between">
                    <div class="space-y-2">
                      <div class="h-8 bg-gray-200 rounded w-12"></div>
                      <div class="h-3 bg-gray-200 rounded w-24"></div>
                    </div>
                    <div class="text-right space-y-2">
                      <div class="h-6 bg-gray-200 rounded w-10"></div>
                      <div class="h-3 bg-gray-200 rounded w-20"></div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <!-- Skeleton Data Tables -->
          <div class="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <!-- Top Books Skeleton -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-pulse">
              <div class="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                <div class="h-5 bg-gray-200 rounded w-48 mb-2"></div>
                <div class="h-4 bg-gray-200 rounded w-40"></div>
              </div>
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-6 py-3 text-left">
                        <div class="h-3 bg-gray-200 rounded w-12"></div>
                      </th>
                      <th class="px-6 py-3 text-left">
                        <div class="h-3 bg-gray-200 rounded w-24"></div>
                      </th>
                      <th class="px-6 py-3 text-center">
                        <div class="h-3 bg-gray-200 rounded w-16 mx-auto"></div>
                      </th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    {#each Array(5) as _, index}
                      <tr>
                        <td class="px-6 py-4">
                          <div class="w-10 h-10 bg-gray-200 rounded-full mx-auto"></div>
                        </td>
                        <td class="px-6 py-4">
                          <div class="flex items-center gap-3">
                            <div class="flex-shrink-0 w-10 h-14 bg-gray-200 rounded"></div>
                            <div class="flex-1 space-y-2">
                              <div class="h-4 bg-gray-200 rounded w-3/4"></div>
                              <div class="h-3 bg-gray-200 rounded w-1/2"></div>
                            </div>
                          </div>
                        </td>
                        <td class="px-6 py-4 text-center">
                          <div class="h-6 bg-gray-200 rounded-full w-12 mx-auto"></div>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Overdue Books Skeleton -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-pulse">
              <div class="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-red-50 to-white">
                <div class="flex items-center justify-between">
                  <div class="flex-1">
                    <div class="h-5 bg-gray-200 rounded w-32 mb-2"></div>
                    <div class="h-4 bg-gray-200 rounded w-40"></div>
                  </div>
                  <div class="h-6 bg-gray-200 rounded-full w-16"></div>
                </div>
              </div>
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-6 py-3 text-left">
                        <div class="h-3 bg-gray-200 rounded w-32"></div>
                      </th>
                      <th class="px-6 py-3 text-center">
                        <div class="h-3 bg-gray-200 rounded w-16 mx-auto"></div>
                      </th>
                      <th class="px-6 py-3 text-right">
                        <div class="h-3 bg-gray-200 rounded w-12 ml-auto"></div>
                      </th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    {#each Array(5) as _}
                      <tr>
                        <td class="px-6 py-4">
                          <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0"></div>
                            <div class="flex-1 space-y-2">
                              <div class="h-4 bg-gray-200 rounded w-3/4"></div>
                              <div class="h-3 bg-gray-200 rounded w-1/2"></div>
                            </div>
                          </div>
                        </td>
                        <td class="px-6 py-4 text-center">
                          <div class="h-6 bg-gray-200 rounded-full w-12 mx-auto"></div>
                        </td>
                        <td class="px-6 py-4 text-right">
                          <div class="h-4 bg-gray-200 rounded w-16 ml-auto"></div>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      {:else}
        <!-- Actual Content -->
        <div class="space-y-6">
          <!-- Metrics Grid -->
          <div class="overflow-x-auto pb-2">
            <div class="flex gap-2 min-w-[400px] sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {#each METRIC_CONFIGS as config}
                <div class="group min-w-[120px] bg-white rounded-xl shadow-sm border border-gray-200 p-2 flex flex-col items-center justify-center hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
                  <!-- Icon -->
                  <div class="p-1.5 bg-gradient-to-br {config.gradient} rounded-full shadow-sm mb-1">
                    <svg class="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="{ICON_PATHS[config.icon]}"/>
                    </svg>
                  </div>
                  <!-- Value -->
                  <div class="text-base sm:text-lg font-bold text-gray-900">
                    {formatValue($dashboardData.overview[config.key], config.format)}
                  </div>
                  <!-- Label always visible on mobile, tooltip on desktop -->
                  <div class="block sm:hidden text-[11px] text-gray-500 mt-0.5 text-center">
                    {config.label}
                  </div>
                  <div class="hidden sm:block absolute bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition bg-gray-900 text-white text-xs rounded px-2 py-1 z-10 whitespace-nowrap">
                    {config.label}
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <!-- Main Chart -->
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:p-8">
            <div class="flex items-start justify-between mb-6">
              <div>
                <h3 class="text-xl font-bold text-gray-900">Daily Visits Trend</h3>
                <p class="text-sm text-gray-600 mt-1">Track visitor activity patterns over time</p>
              </div>
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Live Data
                </span>
              </div>
            </div>
            <div class="h-80">
              <canvas id="visitsChart"></canvas>
            </div>
          </div>

          <!-- Three Column Charts -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 class="text-lg font-bold text-gray-900 mb-4">Transaction Types</h3>
              <div class="h-64">
                <canvas id="transactionsChart"></canvas>
              </div>
            </div>

            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 class="text-lg font-bold text-gray-900 mb-4">Book Categories</h3>
              <div class="h-64">
                <canvas id="categoriesChart"></canvas>
              </div>
            </div>

            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 class="text-lg font-bold text-gray-900 mb-4">Penalty Collections</h3>
              <div class="h-64">
                <canvas id="penaltiesChart"></canvas>
              </div>
            </div>
          </div>

          <!-- Member Activity -->
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:p-8">
            <h3 class="text-xl font-bold text-gray-900 mb-6">Member Activity Summary</h3>
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {#each $dashboardData.charts.memberActivity as activity}
                <div class="relative overflow-hidden bg-gradient-to-br from-gray-50 via-white to-gray-50 p-6 rounded-xl border border-gray-200 hover:shadow-md transition-all duration-200">
                  <div class="relative z-10">
                    <span class="text-sm font-semibold text-gray-700 uppercase tracking-wide">{activity.type}</span>
                    <div class="mt-4 flex items-end justify-between">
                      <div>
                        <p class="text-3xl font-bold text-gray-900">{activity.active}</p>
                        <p class="text-xs text-gray-500 mt-1">Active Members</p>
                      </div>
                      <div class="text-right">
                        <p class="text-xl font-bold text-green-600">+{activity.new}</p>
                        <p class="text-xs text-gray-500 mt-1">New This Period</p>
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <!-- Data Tables -->
          <div class="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <!-- Top Books -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div class="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                <h3 class="text-lg font-bold text-gray-900">Most Popular Books</h3>
                <p class="text-sm text-gray-600 mt-1">Top borrowed titles this period</p>
              </div>
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Rank</th>
                      <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Book Details</th>
                      <th class="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Borrows</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    {#each $dashboardData.tables.topBooks as book, index}
                      <tr class="hover:bg-gray-50 transition-colors">
                        <td class="px-6 py-4">
                          <div class="flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm shadow-sm
                            {index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-white' : 
                             index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' :
                             index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white' :
                             'bg-gray-100 text-gray-600'}">
                            {index + 1}
                          </div>
                        </td>
                        <td class="px-6 py-4">
                          <div class="flex items-center gap-3">
                            <div class="flex-shrink-0 w-10 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded shadow-sm flex items-center justify-center">
                              <svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                              </svg>
                            </div>
                            <div class="min-w-0">
                              <div class="text-sm font-semibold text-gray-900 truncate">{book.title}</div>
                              <div class="text-xs text-gray-500 truncate">by {book.author}</div>
                            </div>
                          </div>
                        </td>
                        <td class="px-6 py-4 text-center">
                          <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                            {book.borrowCount}
                          </span>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Overdue Books -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div class="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-red-50 to-white">
                <div class="flex items-center justify-between">
                  <div>
                    <h3 class="text-lg font-bold text-gray-900">Overdue Books</h3>
                    <p class="text-sm text-gray-600 mt-1">Requires immediate attention</p>
                  </div>
                  <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                    {$dashboardData.tables.overdueList.length} items
                  </span>
                </div>
              </div>
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Book & Borrower</th>
                      <th class="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Overdue</th>
                      <th class="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Fine</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    {#each $dashboardData.tables.overdueList as overdue}
                      <tr class="hover:bg-gray-50 transition-colors">
                        <td class="px-6 py-4">
                          <div class="flex items-center gap-3">
                            <div class="flex-shrink-0">
                              <div class="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center">
                                <svg class="h-5 w-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                              </div>
                            </div>
                            <div class="min-w-0">
                              <div class="text-sm font-semibold text-gray-900 truncate">{overdue.bookTitle}</div>
                              <div class="text-xs text-gray-500 truncate">{overdue.borrowerName}</div>
                            </div>
                          </div>
                        </td>
                        <td class="px-6 py-4 text-center">
                          <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold
                            {overdue.daysOverdue <= 3 ? 'bg-yellow-100 text-yellow-800' : 
                             overdue.daysOverdue <= 7 ? 'bg-orange-100 text-orange-800' : 
                             'bg-red-100 text-red-800'}">
                            {overdue.daysOverdue}d
                          </span>
                        </td>
                        <td class="px-6 py-4 text-right">
                          <span class="text-sm font-bold text-gray-900">{formatCurrency(overdue.fine)}</span>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</Layout>