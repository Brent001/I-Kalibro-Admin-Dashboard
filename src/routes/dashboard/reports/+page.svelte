<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable, derived } from 'svelte/store';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';

  // --- Types ---
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

  type MetricConfig = {
    key: keyof Overview;
    label: string;
    icon: keyof typeof ICON_PATHS;
    gradient: string;
    bgClass: string;
    iconClass: string;
    format?: 'currency' | 'number';
  };

  // --- Store & State ---
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

  const transactionTypesForChart = derived(dashboardData, $dashboardData => {
    const apiTypes = $dashboardData.charts.transactionTypes.filter(t => t.type !== 'Overdue');
    const overdueCount = $dashboardData.tables.overdueList.length;
    return [...apiTypes, { type: 'Overdue', count: overdueCount }];
  });

  // --- Config ---
  const PERIOD_OPTIONS = [
    { value: "week", label: "Last 7 Days" },
    { value: "month", label: "Last 30 Days" },
    { value: "quarter", label: "Last 3 Months" },
    { value: "year", label: "Last 12 Months" }
  ] as const;

  // Map logs parameter to period value
  function parseLogsParam(logsParam: string | null): string {
    if (!logsParam) return 'month';
    
    const num = parseInt(logsParam);
    if (isNaN(num)) return 'month';
    
    if (logsParam.includes('d')) {
      if (num <= 7) return 'week';
      if (num <= 30) return 'month';
      if (num <= 90) return 'quarter';
      if (num <= 365) return 'year';
    }
    
    return 'month'; // default fallback
  }

  const ICON_PATHS = {
    users: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
    check: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    book: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
    clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    dollar: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1",
    library: "M8 14v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
  } as const;

  const METRIC_CONFIGS: MetricConfig[] = [
    { key: 'totalVisits', label: 'Total Visits', icon: 'users', gradient: 'from-blue-500 to-blue-600', bgClass: 'bg-blue-50', iconClass: 'text-blue-600' },
    { key: 'totalTransactions', label: 'Transactions', icon: 'check', gradient: 'from-green-500 to-green-600', bgClass: 'bg-emerald-50', iconClass: 'text-emerald-600' },
    { key: 'activeBorrowings', label: 'Active Loans', icon: 'book', gradient: 'from-yellow-500 to-yellow-600', bgClass: 'bg-amber-50', iconClass: 'text-amber-600' },
    { key: 'overdueBooks', label: 'Overdue', icon: 'clock', gradient: 'from-red-500 to-red-600', bgClass: 'bg-rose-50', iconClass: 'text-rose-600' },
    { key: 'totalPenalties', label: 'Fines Collected', icon: 'dollar', format: 'currency', gradient: 'from-purple-500 to-purple-600', bgClass: 'bg-purple-50', iconClass: 'text-purple-600' },
    { key: 'availableBooks', label: 'In Stock', icon: 'library', gradient: 'from-indigo-500 to-indigo-600', bgClass: 'bg-slate-50', iconClass: 'text-slate-600' }
  ];

  let selectedPeriod = writable('month');
  let chartInstances: Record<string, any> = {};
  let dropdownOpen = writable(false);
  let exportDropdownOpen = writable(false);
  let selectedExportFormat = writable('pdf');

  // Reactive selected period label
  $: selectedPeriodLabel = PERIOD_OPTIONS.find(option => option.value === $selectedPeriod)?.label || 'Select Period';
  const formatCurrency = (amount: number) => `₱${(amount / 100).toFixed(2)}`;
  const formatNumber = (num: number) => num.toLocaleString();
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  const formatValue = (value: number, format?: string) => 
    format === 'currency' ? formatCurrency(value) : formatNumber(value);

  function toggleDropdown() {
    dropdownOpen.update(open => !open);
  }

  function toggleExportDropdown() {
    exportDropdownOpen.update(open => !open);
  }

  function selectExportFormat(format: string) {
    selectedExportFormat.set(format);
    exportDropdownOpen.set(false);
    handleExport();
  }

  function selectPeriod(period: string) {
    selectedPeriod.set(period);
    dropdownOpen.set(false);
    
    // Update URL with logs parameter
    const logsParam = getLogsParamFromPeriod(period);
    const url = new URL(window.location.href);
    if (logsParam) {
      url.searchParams.set('logs', logsParam);
    } else {
      url.searchParams.delete('logs');
    }
    window.history.replaceState({}, '', url.toString());
    
    loadData();
  }

  // Helper function to convert period to logs parameter
  function getLogsParamFromPeriod(period: string): string | null {
    switch (period) {
      case 'week': return '7d';
      case 'month': return '30d';
      case 'quarter': return '90d';
      case 'year': return '365d';
      default: return null;
    }
  }

  // --- API ---
  async function fetchDashboardData(period: string): Promise<DashboardData> {
    const response = await fetch(`/api/reports?period=${period}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.message || 'API request failed');
    return result.data;
  }

  async function loadData() {
    loading.set(true);
    error.set('');
    try {
      const data = await fetchDashboardData($selectedPeriod);
      dashboardData.set(data);
      if ((window as any).Chart) setTimeout(() => initializeCharts(data), 100);
    } catch (err: any) {
      error.set(err.message || 'Failed to load dashboard data');
      console.error('Dashboard load error:', err);
    } finally {
      loading.set(false);
    }
  }

  async function handleExport() {
    try {
      const response = await fetch(`/api/reports/export?period=${$selectedPeriod}&format=${$selectedExportFormat}`);
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `library_report_${$selectedPeriod}_${new Date().toISOString().split('T')[0]}.${$selectedExportFormat === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      error.set('Export failed. Please try again.');
    }
  }

  // --- Charts ---
  async function loadChartJS() {
    if (typeof window !== 'undefined' && !(window as any).Chart) {
      return new Promise<void>((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js';
        script.onload = () => resolve();
        document.head.appendChild(script);
      });
    }
  }

  function createGradient(canvas: HTMLCanvasElement, colorStops: [number, string][]): CanvasGradient {
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    colorStops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
    return gradient;
  }

  function createChart(id: string, config: any) {
    const ctx = document.getElementById(id) as HTMLCanvasElement;
    if (!ctx) return;
    if (chartInstances[id]) chartInstances[id].destroy();
    
    const defaults = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { 
            legend: { 
                position: 'bottom',
                labels: { boxWidth: 10, usePointStyle: true, font: { family: "'Inter', sans-serif", size: 11 } } 
            },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                padding: 10,
                cornerRadius: 8,
                titleFont: { family: "'Inter', sans-serif", size: 13 },
                bodyFont: { family: "'Inter', sans-serif", size: 12 }
            }
        }
    };

    chartInstances[id] = new (window as any).Chart(ctx, {
        ...config,
        options: { ...defaults, ...config.options }
    });
  }

  function initializeCharts(data: DashboardData) {
    // 1. Visits Line Chart
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
          scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: true, border: { display: false }, grid: { color: '#f1f5f9' } }
          }
        }
      });
    }

    // 2. Transaction Doughnut
    let txData: any[] = [];
    transactionTypesForChart.subscribe(v => txData = v)();
    
    const allZero = txData.every(d => d.count === 0);

    createChart('transactionsChart', {
      type: 'doughnut',
      data: {
        labels: allZero ? ['No Data'] : txData.map(d => d.type),
        datasets: [{
          data: allZero ? [1] : txData.map(d => d.count),
          backgroundColor: allZero
            ? ['#E5E7EB']
            : txData.map(d =>
                d.type === 'Overdue' ? '#EF4444' :
                d.type === 'Reserved' ? '#F59E42' :
                d.type === 'Borrowed' ? '#10B981' :
                d.type === 'Returned' ? '#3B82F6' :
                '#A855F7'
              ),
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: { cutout: '70%' }
    });

    // 3. Categories Bar
    createChart('categoriesChart', {
      type: 'bar',
      data: {
        labels: data.charts.categoryDistribution.map(d => d.category.length > 12 ? d.category.slice(0, 12) + '...' : d.category),
        datasets: [{
            label: 'Books',
            data: data.charts.categoryDistribution.map(d => d.count),
            backgroundColor: '#6366F1',
            borderRadius: 6,
            barThickness: 20
        }]
      },
      options: {
        indexAxis: 'y',
        scales: {
            x: { beginAtZero: true, grid: { display: false } },
            y: { grid: { display: false } }
        },
        plugins: { legend: { display: false } }
      }
    });

    // 4. Penalties Area
    const penaltiesCanvas = document.getElementById('penaltiesChart') as HTMLCanvasElement;
    if (penaltiesCanvas) {
      createChart('penaltiesChart', {
        type: 'line',
        data: {
          labels: data.charts.penaltyTrends.map(d => formatDate(d.date)),
          datasets: [{
            label: 'Penalties (₱)',
            data: data.charts.penaltyTrends.map(d => d.amount / 100),
            borderColor: '#8B5CF6',
            backgroundColor: createGradient(penaltiesCanvas, [[0, 'rgba(139, 92, 246, 0.3)'], [1, 'rgba(139, 92, 246, 0.05)']]),
            borderWidth: 3,
            pointRadius: 0,
            pointHoverRadius: 5,
            tension: 0.4,
            fill: true
          }]
        },
        options: {
          scales: {
            x: { grid: { display: false } },
            y: { 
              beginAtZero: true,
              ticks: { callback: (value: any) => '₱' + value }
            }
          },
          plugins: { legend: { display: false } }
        }
      });
    }
  }

  onMount(() => {
    // Check URL parameters for initial period selection
    const currentUrl = new URL(window.location.href);
    const logsParam = currentUrl.searchParams.get('logs');
    const initialPeriod = parseLogsParam(logsParam);
    selectedPeriod.set(initialPeriod);
    
    // If no logs parameter and using default period, add it to URL
    if (!logsParam && initialPeriod === 'month') {
      currentUrl.searchParams.set('logs', '30d');
      window.history.replaceState({}, '', currentUrl.toString());
    }
    
    (async () => {
      await loadChartJS();
      await loadData();
    })();
    
    // Add click outside handler for dropdowns
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.custom-dropdown')) {
        dropdownOpen.set(false);
      }
      if (!target.closest('.export-dropdown')) {
        exportDropdownOpen.set(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });

  onDestroy(() => {
    Object.values(chartInstances).forEach(chart => chart?.destroy());
  });

  $: if ($dashboardData && typeof window !== 'undefined' && (window as any).Chart) {
    initializeCharts($dashboardData);
  }
</script>

<div class="min-h-screen">
  <!-- Header -->
  <div class="mb-4">
    <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Library Analytics</h1>
        <p class="text-sm text-gray-600 mt-1">Real-time fine calculations at ₱5/hour • Auto-updated every hour</p>
      </div>
      
      <div class="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 w-full sm:w-auto">
        <div class="relative w-full sm:w-auto custom-dropdown">
          <!-- Custom Dropdown Button -->
          <button
            on:click={toggleDropdown}
            disabled={$loading}
            class="w-full sm:w-auto pl-4 pr-10 py-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-all disabled:opacity-60 flex items-center justify-between"
          >
            <span>{selectedPeriodLabel}</span>
            <svg 
              class="h-4 w-4 text-gray-500 transition-transform duration-200 {$dropdownOpen ? 'rotate-180' : ''}" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>

          <!-- Dropdown Options -->
          {#if $dropdownOpen}
            <div class="absolute z-10 mt-1 w-full sm:w-auto bg-white border border-gray-300 rounded-lg shadow-lg">
              {#each PERIOD_OPTIONS as option}
                <button
                  on:click={() => selectPeriod(option.value)}
                  class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none first:rounded-t-lg last:rounded-b-lg {$selectedPeriod === option.value ? 'bg-indigo-50 text-indigo-700' : ''}"
                >
                  {option.label}
                </button>
              {/each}
            </div>
          {/if}
        </div>
        
        <div class="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div class="relative w-full sm:w-auto export-dropdown">
            <button
              on:click={toggleExportDropdown}
              disabled={$loading}
              class="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50"
            >
              <svg class="h-4 w-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Export {$selectedExportFormat.toUpperCase()}
              <svg 
                class="h-4 w-4 ml-2 text-gray-500 transition-transform duration-200 {$exportDropdownOpen ? 'rotate-180' : ''}" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>

            {#if $exportDropdownOpen}
              <div class="absolute z-10 mt-1 w-full sm:w-auto bg-white border border-gray-300 rounded-lg shadow-lg">
                <button
                  on:click={() => selectExportFormat('pdf')}
                  class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none rounded-t-lg flex items-center {$selectedExportFormat === 'pdf' ? 'bg-indigo-50 text-indigo-700' : ''}"
                >
                  <svg class="h-4 w-4 mr-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  PDF Document
                </button>
                <button
                  on:click={() => selectExportFormat('excel')}
                  class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none rounded-b-lg flex items-center {$selectedExportFormat === 'excel' ? 'bg-indigo-50 text-indigo-700' : ''}"
                >
                  <svg class="h-4 w-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  Excel Spreadsheet
                </button>
              </div>
            {/if}
          </div>
          
          <button
            on:click={() => window.location.href = '/dashboard/reports/visits'}
            class="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-sm transition-all duration-200 w-full sm:w-auto"
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
  </div>

  <main class="space-y-2 -mx-2 sm:mx-0">

    {#if $error}
      <div class="rounded-lg bg-red-50 border border-red-200 p-4 flex items-start shadow-sm">
        <svg class="h-5 w-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>
        <div>
          <h3 class="text-sm font-medium text-red-800">Error Loading Data</h3>
          <p class="text-sm text-red-700 mt-1">{$error}</p>
        </div>
      </div>
    {/if}

    <!-- Metrics Grid -->
    <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-1 sm:gap-2">
      {#each METRIC_CONFIGS as config}
        <div class="group relative bg-white rounded-xl shadow-sm border border-gray-200 p-3 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          {#if $loading}
            <div class="animate-pulse flex flex-col items-center">
              <div class="h-10 w-10 bg-gray-200 rounded-lg mb-3"></div>
              <div class="h-6 w-16 bg-gray-200 rounded mb-2"></div>
              <div class="h-3 w-20 bg-gray-200 rounded"></div>
            </div>
          {:else}
            <div class="flex flex-col items-center text-center">
              <div class={`p-2.5 rounded-lg mb-3 bg-gradient-to-br ${config.gradient} shadow-sm`}>
                <svg class="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d={ICON_PATHS[config.icon]}/>
                </svg>
              </div>
              <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{config.label}</p>
              <p class="text-lg sm:text-xl font-bold text-gray-900">
                {formatValue($dashboardData.overview[config.key], config.format)}
              </p>
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Main Charts Section -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-2">
      
      <!-- Daily Visits -->
      <div class="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-3">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-lg font-bold text-gray-900">Daily Visits Trend</h3>
            <p class="text-sm text-gray-600 mt-1">Track visitor activity patterns over time</p>
          </div>
          <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Live Data
          </span>
        </div>
        <div class="relative h-72 w-full">
          {#if $loading}
            <div class="absolute inset-0 bg-gray-100 animate-pulse rounded-lg"></div>
          {:else}
            <canvas id="visitsChart"></canvas>
          {/if}
        </div>
      </div>

      <!-- Transaction Types -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
        <h3 class="text-lg font-bold text-gray-900 mb-4">Activity Breakdown</h3>
        <div class="relative h-72 w-full flex items-center justify-center">
          {#if $loading}
             <div class="h-48 w-48 rounded-full border-4 border-gray-200 animate-pulse"></div>
          {:else}
            <canvas id="transactionsChart"></canvas>
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div class="text-center">
                    <span class="block text-2xl font-bold text-gray-900">
                        {$dashboardData.overview.totalTransactions}
                    </span>
                    <span class="text-xs text-gray-500">Total</span>
                </div>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Secondary Charts -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
      
      <!-- Categories -->
      <div class="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-3">
        <h3 class="text-lg font-bold text-gray-900 mb-4">Book Categories</h3>
        <div class="h-56">
          {#if $loading}
            <div class="h-full bg-gray-100 animate-pulse rounded-lg"></div>
          {:else}
            <canvas id="categoriesChart"></canvas>
          {/if}
        </div>
      </div>

      <!-- Revenue Card -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-3 flex flex-col justify-between">
         <div>
             <h3 class="text-base font-semibold text-gray-900">Penalty Collections</h3>
             {#if $loading}
               <div class="h-8 w-24 bg-gray-200 rounded mt-2 animate-pulse"></div>
               <div class="h-4 w-32 bg-gray-200 rounded mt-2 animate-pulse"></div>
             {:else}
               <p class="text-2xl font-bold text-purple-600 mt-2">{formatCurrency($dashboardData.overview.totalPenalties)}</p>
               <p class="text-sm text-gray-500">Total fines collected</p>
             {/if}
         </div>
         <div class="h-24 mt-4">
           {#if !$loading}
             <canvas id="penaltiesChart"></canvas>
           {/if}
         </div>
      </div>

      <!-- Member Activity -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        <div class="p-3 pb-4">
            <h3 class="text-base font-semibold text-gray-900">Member Activity</h3>
        </div>
        <div class="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
            {#if $loading}
              {#each Array(4) as _}
                <div class="h-12 bg-gray-100 rounded animate-pulse"></div>
              {/each}
            {:else}
              {#each $dashboardData.charts.memberActivity as stat}
                  <div class="flex items-center justify-between">
                      <div class="flex items-center">
                          <div class="w-2 h-2 rounded-full bg-indigo-500 mr-3"></div>
                          <span class="text-sm text-gray-600">{stat.type}</span>
                      </div>
                      <div class="text-right">
                          <span class="block text-sm font-medium text-gray-900">{stat.active}</span>
                          <span class="text-xs text-emerald-600">+{stat.new} new</span>
                      </div>
                  </div>
              {/each}
            {/if}
        </div>
      </div>
    </div>

    <!-- Data Tables -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-2">
      
      <!-- Top Books -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div class="px-3 py-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <h3 class="text-lg font-bold text-gray-900">Most Popular Books</h3>
          <p class="text-sm text-gray-600 mt-1">Top borrowed titles this period</p>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Rank</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Book Details</th>
                <th class="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Borrows</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {#if $loading}
                 {#each Array(5) as _}
                    <tr><td colspan="3" class="px-3 py-3"><div class="h-10 bg-gray-100 rounded animate-pulse"></div></td></tr>
                 {/each}
              {:else}
                {#each $dashboardData.tables.topBooks as book, i}
                  <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-3 py-3 whitespace-nowrap">
                        <div class="flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm shadow-sm
                          {i === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-white' : 
                           i === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' :
                           i === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white' :
                           'bg-gray-100 text-gray-600'}">
                          {i + 1}
                        </div>
                    </td>
                    <td class="px-3 py-3">
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
                    <td class="px-3 py-3 whitespace-nowrap text-center">
                      <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                        {book.borrowCount}
                      </span>
                    </td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Overdue Books -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div class="px-3 py-3 border-b border-red-100 bg-gradient-to-r from-red-50 to-white">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
               <div class="h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>
               <div>
                 <h3 class="text-lg font-bold text-red-900">Overdue Books</h3>
                 <p class="text-sm text-gray-600 mt-1">Requires immediate attention • ₱5/hour</p>
               </div>
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
                <th class="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Book & Borrower</th>
                <th class="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Overdue</th>
                <th class="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Fine</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
               {#if $loading}
                 {#each Array(3) as _}
                    <tr><td colspan="3" class="px-3 py-3"><div class="h-10 bg-gray-100 rounded animate-pulse"></div></td></tr>
                 {/each}
              {:else}
                {#each $dashboardData.tables.overdueList as item}
                  <tr class="hover:bg-red-50/30 transition-colors group">
                    <td class="px-3 py-3">
                      <div class="flex items-center gap-3">
                        <div class="flex-shrink-0">
                          <div class="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center">
                            <svg class="h-5 w-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                          </div>
                        </div>
                        <div class="min-w-0">
                          <div class="text-sm font-semibold text-gray-900 truncate">{item.bookTitle}</div>
                          <div class="text-xs text-gray-500 truncate">{item.borrowerName}</div>
                        </div>
                      </div>
                    </td>
                    <td class="px-3 py-3 whitespace-nowrap text-center">
                      <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold
                        {item.daysOverdue <= 3 ? 'bg-yellow-100 text-yellow-800' : 
                         item.daysOverdue <= 7 ? 'bg-orange-100 text-orange-800' : 
                         'bg-red-100 text-red-800'}">
                        {item.daysOverdue}d
                      </span>
                    </td>
                    <td class="px-3 py-3 whitespace-nowrap text-right">
                      <div class="text-sm font-bold text-gray-900">
                        {formatCurrency(item.fine)}
                      </div>
                    </td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  </main>
</div>