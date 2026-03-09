<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { writable, derived } from 'svelte/store';
  import * as Lucide from 'lucide-svelte';
  const Icons = Lucide as any;

  // ─── Types ─────────────────────────────────────────────────────────────────
  interface Overview {
    totalVisits: number; activeMembers: number; activeStudents: number; activeFaculty: number; newMembers: number;
    activeBorrowings: number; totalBorrowedPeriod: number; totalReturnedPeriod: number;
    totalOverdue: number; overdueByType: { books: number; magazines: number; thesis: number; journals: number };
    totalPendingReservations: number; totalReservationsPeriod: number; totalPendingReturnRequests: number;
    totalUnpaidFines: number; totalPaidFines: number; paymentsCount: number;
    totalItems: number; totalBooks: number; totalMagazines: number; totalThesis: number; totalJournals: number;
    totalBookCopies: number; availableBookCopies: number;
  }
  interface BorrowingByType { type: string; borrowed: number; returned: number; overdue: number }
  interface ChartData {
    dailyVisits: Array<{ date: string; count: number }>;
    dailyBorrowings: Array<{ date: string; books: number; magazines: number; thesis: number; journals: number; total: number }>;
    categoryDistribution: Array<{ category: string; count: number; percentage: number }>;
    penaltyTrends: Array<{ date: string; amount: number }>;
    paymentTrends: Array<{ date: string; amount: number; count: number }>;
    borrowingsByType: BorrowingByType[];
    transactionTypes: Array<{ type: string; count: number }>;
    reservationStatusBreakdown: Array<{ status: string; count: number }>;
    fineBreakdown: Array<{ status: string; count: number; total: number }>;
    memberActivity: Array<{ type: string; active: number; new: number }>;
    collectionBreakdown: Array<{ type: string; count: number }>;
  }
  interface TableData {
    topItems: Array<{ title: string; author: string; itemType: string; borrowCount: number }>;
    overdueList: Array<{ itemTitle: string; borrowerName: string; itemType: string; dueDate: string; daysOverdue: number; hoursOverdue?: number; fine: number }>;
    recentPayments: Array<{ transactionId: string; memberName: string; amount: number; paymentType: string; paymentMethod: string; paymentDate: string }>;
    topDebtors: Array<{ memberName: string; userType: string; totalFine: number; fineCount: number }>;
  }
  interface DashboardData { overview: Overview; charts: ChartData; tables: TableData }

  // ─── Stores ────────────────────────────────────────────────────────────────
  const loading = writable(true);
  const errorMsg = writable('');
  const dashboardData = writable<DashboardData | null>(null);
  const selectedPeriod = writable('month');
  const dropdownOpen = writable(false);
  const exportDropdownOpen = writable(false);
  const selectedExportFormat = writable('pdf');
  let activeTab: 'borrowings' | 'reservations' | 'fines' | 'collection' = 'borrowings';

  // ─── Config ────────────────────────────────────────────────────────────────
  const PERIOD_OPTIONS = [
    { value: 'week',    label: 'Last 7 Days' },
    { value: 'month',   label: 'Last 30 Days' },
    { value: 'quarter', label: 'Last 3 Months' },
    { value: 'year',    label: 'Last 12 Months' },
  ] as const;

  $: selectedPeriodLabel = PERIOD_OPTIONS.find(o => o.value === $selectedPeriod)?.label ?? 'Select Period';

  // KPI cards configuration (use lucide-svelte components)
  const KPI_CARDS = [
    { label: 'Total Visits',     value: () => $dashboardData?.overview.totalVisits ?? 0,              color: 'from-blue-500 to-blue-600',    icon: 'Users' },
    { label: 'Active Members',   value: () => $dashboardData?.overview.activeMembers ?? 0,            color: 'from-emerald-500 to-emerald-600', icon: 'User' },
    { label: 'Borrowed',         value: () => $dashboardData?.overview.activeBorrowings ?? 0,         color: 'from-amber-500 to-amber-600',   icon: 'BookOpen' },
    { label: 'Total Overdue',    value: () => $dashboardData?.overview.totalOverdue ?? 0,             color: 'from-red-500 to-red-600',      icon: 'Clock' },
    { label: 'Pending Requests', value: () => (($dashboardData?.overview.totalPendingReservations ?? 0) + ($dashboardData?.overview.totalPendingReturnRequests ?? 0)), color: 'from-indigo-500 to-indigo-600', icon: 'Calendar' },
    { label: 'Paid Fines',       value: () => $dashboardData?.overview.totalPaidFines ?? 0,           color: 'from-emerald-500 to-emerald-600', icon: 'Peso', format: 'currency' },
  ];

  const EXPORT_FORMATS = [
    { v: 'pdf', label: 'PDF Document', icon: 'FileText', colorClass: 'text-red-500' },
    { v: 'excel', label: 'Excel Spreadsheet', icon: 'FileSpreadsheet', colorClass: 'text-green-500' },
  ];

  // ─── Formatters ────────────────────────────────────────────────────────────
  const fc  = (v: number) => `₱${Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fn  = (v: number) => v.toLocaleString();
  const fd  = (s: string) => new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const fdt = (s: string) => new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  function itemTypeBadge(t: string) {
    return { Book: 'bg-blue-100 text-blue-700', Magazine: 'bg-purple-100 text-purple-700', Thesis: 'bg-teal-100 text-teal-700', Journal: 'bg-orange-100 text-orange-700' }[t] ?? 'bg-slate-100 text-slate-600';
  }
  function statusBadge(s: string) {
    const m: Record<string, string> = { pending: 'bg-amber-100 text-amber-800', approved: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800', fulfilled: 'bg-blue-100 text-blue-800', expired: 'bg-gray-100 text-gray-600', cancelled: 'bg-gray-100 text-gray-600', paid: 'bg-green-100 text-green-800', unpaid: 'bg-red-100 text-red-800', waived: 'bg-purple-100 text-purple-800' };
    return m[s] ?? 'bg-slate-100 text-slate-600';
  }

  // ─── Chart helpers ─────────────────────────────────────────────────────────
  let chartInstances: Record<string, any> = {};

  function destroyChart(id: string) {
    if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
  }

  function mkGradient(canvas: HTMLCanvasElement, color: string, alpha = 0.3): CanvasGradient {
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height || 300);

    // Helper: convert '#rrggbb' to 'r,g,b'
    function hexToRgb(hex: string) {
      const h = hex.replace('#', '');
      if (h.length === 3) {
        return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
      }
      return [parseInt(h.substring(0,2), 16), parseInt(h.substring(2,4), 16), parseInt(h.substring(4,6), 16)];
    }

    let base0 = color;
    let base1 = color;

    if (color.startsWith('#')) {
      const [r,g,b] = hexToRgb(color);
      base0 = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      base1 = `rgba(${r}, ${g}, ${b}, ${0.02})`;
    } else if (color.startsWith('rgb')) {
      // color like 'rgb(r,g,b)' or 'rgba(...)'
      const rgb = color.replace(/^rgba?\(/, '').replace(/\)$/, '');
      base0 = `rgba(${rgb}, ${alpha})`;
      base1 = `rgba(${rgb}, 0.02)`;
    }

    g.addColorStop(0, base0);
    g.addColorStop(1, base1);
    return g;
  }

  const CHART_DEFAULTS = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const, labels: { boxWidth: 10, usePointStyle: true, font: { size: 11 } } },
      tooltip: { backgroundColor: 'rgba(15,23,42,0.9)', padding: 10, cornerRadius: 8 },
    },
  };

  function createChart(id: string, config: any) {
    const el = document.getElementById(id) as HTMLCanvasElement;
    if (!el) return;
    destroyChart(id);
    chartInstances[id] = new (window as any).Chart(el, { ...config, options: { ...CHART_DEFAULTS, ...config.options } });
  }

  // Initialize charts for specific areas to avoid re-creating unrelated charts
  function initVisitsCharts(data: DashboardData) {
    if (!(window as any).Chart) return;
    const visitsEl = document.getElementById('visitsChart') as HTMLCanvasElement;
    if (visitsEl) createChart('visitsChart', {
      type: 'line',
      data: {
        labels: data.charts.dailyVisits.map(d => fd(d.date)),
        datasets: [{ label: 'Visits', data: data.charts.dailyVisits.map(d => d.count), borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.15)', borderWidth: 2.5, pointRadius: 4, tension: 0.4, fill: true }],
      },
      options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: '#f1f5f9' }, border: { display: false } } } },
    });
  }

  function initBorrowingsCharts(data: DashboardData) {
    if (!(window as any).Chart) return;
    const borrowEl = document.getElementById('borrowingsChart') as HTMLCanvasElement;
    if (borrowEl && data.charts.dailyBorrowings.length) createChart('borrowingsChart', {
      type: 'line',
      data: {
        labels: data.charts.dailyBorrowings.map(d => fd(d.date)),
        datasets: [
          { label: 'Books', data: data.charts.dailyBorrowings.map(d => d.books), borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.12)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3 },
          { label: 'Magazines', data: data.charts.dailyBorrowings.map(d => d.magazines), borderColor: '#8B5CF6', backgroundColor: 'rgba(139,92,246,0.12)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3 },
          { label: 'Thesis', data: data.charts.dailyBorrowings.map(d => d.thesis), borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.12)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3 },
          { label: 'Journals', data: data.charts.dailyBorrowings.map(d => d.journals), borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.12)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3 },
        ],
      },
      options: { scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: '#f1f5f9' }, border: { display: false }, ticks: { precision: 0 } } } },
    });

    const bbt = data.charts.borrowingsByType;
    const btEl = document.getElementById('borrowingsByTypeChart') as HTMLCanvasElement;
    if (btEl) createChart('borrowingsByTypeChart', {
      type: 'bar',
      data: { labels: bbt.map(d => d.type), datasets: [ { label: 'Borrowed', data: bbt.map(d => d.borrowed), backgroundColor: '#3B82F6', borderRadius: 3 }, { label: 'Returned', data: bbt.map(d => d.returned), backgroundColor: '#10B981', borderRadius: 3 }, { label: 'Overdue', data: bbt.map(d => d.overdue), backgroundColor: '#EF4444', borderRadius: 3 } ] },
      options: { scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { precision: 0 } } } },
    });
  }

  function initReservationsCharts(data: DashboardData) {
    if (!(window as any).Chart) return;
    const resStatus = data.charts.reservationStatusBreakdown;
    const resEl = document.getElementById('reservationStatusChart') as HTMLCanvasElement;
    if (resEl && resStatus.length) {
      const statusColors: Record<string, string> = { pending: '#F59E0B', approved: '#10B981', rejected: '#EF4444', fulfilled: '#3B82F6', expired: '#9CA3AF', cancelled: '#6B7280' };
      createChart('reservationStatusChart', {
        type: 'doughnut',
        data: { labels: resStatus.map(d => d.status.charAt(0).toUpperCase() + d.status.slice(1)), datasets: [{ data: resStatus.map(d => d.count), backgroundColor: resStatus.map(d => statusColors[d.status] ?? '#A855F7'), borderWidth: 0, hoverOffset: 4 }] },
        options: { cutout: '65%' },
      });
    }
  }

  function initFinesCharts(data: DashboardData) {
    if (!(window as any).Chart) return;
    const penEl = document.getElementById('penaltiesChart') as HTMLCanvasElement;
    if (penEl) createChart('penaltiesChart', {
      type: 'line',
      data: { labels: data.charts.penaltyTrends.map(d => fd(d.date)), datasets: [{ label: 'Fines (₱)', data: data.charts.penaltyTrends.map(d => Number(d.amount) || 0), borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 2, pointRadius: 3, tension: 0.4, fill: true }] },
      options: { scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { callback: (v: any) => v >= 1000 ? `₱${(v/1000).toFixed(1)}k` : `₱${v}` } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => `₱${ctx.parsed.y.toFixed(2)}` } } } },
    });

    const payEl = document.getElementById('paymentTrendsChart') as HTMLCanvasElement;
    if (payEl && data.charts.paymentTrends.length) createChart('paymentTrendsChart', {
      type: 'bar',
      data: { labels: data.charts.paymentTrends.map(d => fd(d.date)), datasets: [{ label: 'Payments (₱)', data: data.charts.paymentTrends.map(d => Number(d.amount) || 0), backgroundColor: 'rgba(16,185,129,0.7)', borderRadius: 4 }] },
      options: { scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { callback: (v: any) => `₱${v}` } } }, plugins: { legend: { display: false } } },
    });
  }

  function initCollectionCharts(data: DashboardData) {
    if (!(window as any).Chart) return;
    const col = data.charts.collectionBreakdown;
    const colEl = document.getElementById('collectionChart') as HTMLCanvasElement;
    if (colEl) createChart('collectionChart', { type: 'doughnut', data: { labels: col.map(d => d.type), datasets: [{ data: col.map(d => d.count), backgroundColor: ['#3B82F6','#8B5CF6','#10B981','#F59E0B'], borderWidth: 0, hoverOffset: 4 }] }, options: { cutout: '65%', plugins: { legend: { display: false } } } });

    const cats = data.charts.categoryDistribution.slice(0, 12);
    const catsEl = document.getElementById('categoriesChart') as HTMLCanvasElement;
    if (catsEl) createChart('categoriesChart', {
      type: 'bar',
      data: { labels: cats.map(d => d.category.length > 14 ? d.category.slice(0, 13) + '…' : d.category), datasets: [{ label: 'Items', data: cats.map(d => d.count), backgroundColor: cats.map((_, i) => {
            // cycle through some colors for visual variety
            const cols = ['#6366F1','#8B5CF6','#EC4899','#F59E0B','#10B981','#3B82F6','#EF4444','#6B7280','#06B6D4','#84CC16','#F97316','#A855F7'];
            return cols[i % cols.length];
          }), borderRadius: 4, borderSkipped: false }] },
      options: { scales: { x: { grid: { display: false }, ticks: { maxRotation: 45 } }, y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { precision: 0 } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { title: (ctx: any) => data.charts.categoryDistribution[ctx[0].dataIndex]?.category, label: (ctx: any) => {
              const c = data.charts.categoryDistribution[ctx.dataIndex];
              // return as array to override default dataset label entirely
              return [`${c.count} items (${c.percentage}%)`];
            } } } } },
    });
  }

  function initActivityMixChart(data: DashboardData) {
    if (!(window as any).Chart) return;
    const el = document.getElementById('transactionsChart') as HTMLCanvasElement;
    if (!el) return;

    // normalize server-provided transaction types to expected order
    const tx = data.charts.transactionTypes || [];
    const map: Record<string, number> = {};
    tx.forEach(t => { map[(t.type || '').toLowerCase()] = Number(t.count) || 0; });
    const types = ['borrowed', 'returned', 'overdue', 'reserved'];
    const labels = types.map(t => t.charAt(0).toUpperCase() + t.slice(1));
    const colors = ['#10B981', '#3B82F6', '#EF4444', '#F59E0B'];
    const dataValues = types.map(t => map[t] ?? 0);

    const empty = dataValues.every(v => v === 0);
    const chartLabels = empty ? ['No Data'] : labels;
    const chartData = empty ? [1] : dataValues;
    const chartColors = empty ? ['#E5E7EB'] : colors;

    createChart('transactionsChart', {
      type: 'doughnut',
      data: { labels: chartLabels, datasets: [{ data: chartData, backgroundColor: chartColors, borderWidth: 0, hoverOffset: 4 }] },
      options: { cutout: '70%', plugins: { legend: { display: false } } },
    });
  }

  // convenience: initialize everything (used on first load)
  function initCharts(data: DashboardData) {
    initVisitsCharts(data);
    initBorrowingsCharts(data);
    initReservationsCharts(data);
    initFinesCharts(data);
    initCollectionCharts(data);
    // activity mix sits alongside visits/collection and should be initialized on load
    initActivityMixChart(data);
  }

  // ─── Data loading ──────────────────────────────────────────────────────────
  async function loadChartJS() {
    if (typeof window !== 'undefined' && !(window as any).Chart) {
      await new Promise<void>(resolve => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js';
        s.onload = () => resolve();
        document.head.appendChild(s);
      });
    }
  }

  async function loadData() {
    loading.set(true); errorMsg.set('');
    try {
      const res = await fetch(`/api/reports?period=${$selectedPeriod}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (!result.success) throw new Error(result.message || 'API error');
      dashboardData.set(result.data);
      setTimeout(() => { if ($dashboardData) initCharts($dashboardData); }, 120);
    } catch (e: any) {
      errorMsg.set(e.message || 'Failed to load data');
    } finally {
      loading.set(false);
    }
  }

  function selectPeriod(p: string) {
    selectedPeriod.set(p); dropdownOpen.set(false);
    const u = new URL(window.location.href);
    const logsMap: Record<string, string> = { week: '7d', month: '30d', quarter: '90d', year: '365d' };
    u.searchParams.set('logs', logsMap[p] ?? '30d');
    window.history.replaceState({}, '', u.toString());
    loadData();
  }

  async function handleExport() {
    try {
      const res = await fetch(`/api/reports/export?period=${$selectedPeriod}&format=${$selectedExportFormat}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `library_report_${$selectedPeriod}_${new Date().toISOString().split('T')[0]}.${$selectedExportFormat === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(link); link.click();
      document.body.removeChild(link);
    } catch { errorMsg.set('Export failed. Please try again.'); }
  }

  onMount(() => {
    const u = new URL(window.location.href);
    const logs = u.searchParams.get('logs');
    if (logs) {
      const map: Record<string, string> = { '7d': 'week', '30d': 'month', '90d': 'quarter', '365d': 'year' };
      const p = Object.entries(map).find(([k]) => logs.startsWith(k.replace('d','')))?.[1] ?? 'month';
      selectedPeriod.set(p);
    }
    const outside = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.period-dd')) dropdownOpen.set(false);
      if (!t.closest('.export-dd')) exportDropdownOpen.set(false);
    };
    document.addEventListener('click', outside);
    (async () => { await loadChartJS(); await loadData(); })();
    return () => document.removeEventListener('click', outside);
  });

  onDestroy(() => Object.values(chartInstances).forEach(c => c?.destroy()));
</script>

<svelte:head>
  <title>Analytics & Reports | E-Kalibro Admin Portal</title>
</svelte:head>

<div class="min-h-screen">

  <!-- ── Header ─────────────────────────────────────────────────────────── -->
  <div class="mb-4">
    <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Library Analytics</h1>
        <p class="text-sm text-gray-500 mt-1">Full coverage across books, magazines, thesis & journals • ₱5/hour overdue rate</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <!-- Period picker -->
        <div class="relative period-dd">
          <button on:click={() => dropdownOpen.update(v => !v)} disabled={$loading}
            class="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-sm rounded-lg shadow-sm hover:bg-gray-50 disabled:opacity-60 transition-colors">
            <span>{selectedPeriodLabel}</span>
            <svelte:component this={Icons.ChevronDown} class="h-4 w-4 text-gray-400 transition-transform {$dropdownOpen ? 'rotate-180' : ''}" />
          </button>
          {#if $dropdownOpen}
            <div class="absolute z-20 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg">
              {#each PERIOD_OPTIONS as o}
                <button on:click={() => selectPeriod(o.value)}
                  class="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg {$selectedPeriod === o.value ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'}">
                  {o.label}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Export -->
        <div class="relative export-dd">
          <button on:click={() => exportDropdownOpen.update(v => !v)} disabled={$loading}
            class="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-sm rounded-lg shadow-sm hover:bg-gray-50 disabled:opacity-60 transition-colors">
            <svelte:component this={Icons.UploadCloud} class="h-4 w-4 text-gray-500" />
            Export {$selectedExportFormat.toUpperCase()}
            <svelte:component this={Icons.ChevronDown} class="h-4 w-4 text-gray-400 transition-transform {$exportDropdownOpen ? 'rotate-180' : ''}" />
          </button>
          {#if $exportDropdownOpen}
            <div class="absolute right-0 z-20 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg">
              {#each EXPORT_FORMATS as fmt}
                  <button on:click={() => { selectedExportFormat.set(fmt.v); exportDropdownOpen.set(false); handleExport(); }}
                    class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg flex items-center gap-2 {$selectedExportFormat === fmt.v ? 'bg-indigo-50 text-indigo-700' : ''}">
                      <svelte:component this={Icons[fmt.icon]} class={`h-4 w-4 ${fmt.colorClass}`} />
                    {fmt.label}
                  </button>
                {/each}
            </div>
          {/if}
        </div>

        <!-- Visit logs -->
        <button on:click={() => window.location.href = '/dashboard/reports/visits'}
          class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-lg shadow-sm transition-all">
          <svelte:component this={Icons.Eye} class="h-4 w-4" />
          Visit Logs
        </button>
      </div>
    </div>
  </div>

  <main class="space-y-3">
    {#if $errorMsg}
      <div class="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
        <svelte:component this={Icons.XCircle} class="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
        <div><p class="text-sm font-medium text-red-800">Error loading data</p><p class="text-sm text-red-700 mt-0.5">{$errorMsg}</p></div>
      </div>
    {/if}

    <!-- ══ ROW 1: Core KPIs ════════════════════════════════════════════════ -->
    <div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
      {#each KPI_CARDS as m}
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          {#if $loading}
            <div class="animate-pulse flex flex-col items-center gap-2"><div class="h-10 w-10 bg-gray-200 rounded-lg"></div><div class="h-5 w-14 bg-gray-200 rounded"></div><div class="h-3 w-20 bg-gray-200 rounded"></div></div>
          {:else}
            <div class="flex flex-col items-center text-center">
              <div class="p-2.5 rounded-lg mb-2 bg-gradient-to-br {m.color} shadow-sm">
                {#if m.icon === 'Peso'}
                  <span class="inline-flex items-center justify-center h-5 w-5 sm:h-6 sm:w-6 text-white font-semibold">₱</span>
                {:else}
                  <svelte:component this={Icons[m.icon]} class="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                {/if}
              </div>
              <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{m.label}</p>
              <p class="text-lg sm:text-xl font-bold text-gray-900">{m.format === 'currency' ? fc(m.value()) : fn(m.value())}</p>
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- ══ ROW 2: Collection snapshot ════════════════════════════════════════ -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {#each [
        { label: 'Books',     value: $dashboardData?.overview.totalBooks ?? 0,     color: 'bg-blue-50 border-blue-200 text-blue-700' },
        { label: 'Magazines', value: $dashboardData?.overview.totalMagazines ?? 0, color: 'bg-purple-50 border-purple-200 text-purple-700' },
        { label: 'Thesis',    value: $dashboardData?.overview.totalThesis ?? 0,    color: 'bg-teal-50 border-teal-200 text-teal-700' },
        { label: 'Journals',  value: $dashboardData?.overview.totalJournals ?? 0,  color: 'bg-orange-50 border-orange-200 text-orange-700' },
      ] as c}
        <div class="rounded-xl border {c.color} p-3 flex items-center justify-between">
          {#if $loading}
            <div class="animate-pulse h-8 w-full bg-white/60 rounded"></div>
          {:else}
            <span class="text-sm font-medium">{c.label} in Collection</span>
            <span class="text-2xl font-bold">{fn(c.value)}</span>
          {/if}
        </div>
      {/each}
    </div>

    <!-- ══ ROW 3: Main Charts ═════════════════════════════════════════════════ -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">

      <!-- Visits trend -->
      <div class="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div class="flex items-center justify-between mb-3">
          <div><h3 class="text-base font-semibold text-gray-900">Daily Visits</h3><p class="text-xs text-gray-500 mt-0.5">Library foot traffic over the period</p></div>
          <span class="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Live</span>
        </div>
        <div class="h-64">
          {#if $loading}<div class="h-full bg-gray-100 animate-pulse rounded-lg"></div>
          {:else}<canvas id="visitsChart" class="block w-full h-full"></canvas>{/if}
        </div>
      </div>

      <!-- Transaction doughnut + collection doughnut stacked -->
      <div class="flex flex-col gap-3">
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex-1">
          <h3 class="text-base font-semibold text-gray-900 mb-2">Activity Mix</h3>
          {#if $loading}
            <div class="flex justify-center"><div class="h-32 w-32 rounded-full border-4 border-gray-200 animate-pulse"></div></div>
          {:else}
            <!-- Canvas-only wrapper so overlay centers on the ring, not the legend -->
            <div class="relative h-40">
              <canvas id="transactionsChart" class="block w-full h-full"></canvas>
              <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div class="text-center leading-tight">
                  <span class="block text-xl font-bold text-gray-900">{fn($dashboardData?.overview.totalBorrowedPeriod ?? 0)}</span>
                  <span class="text-xs text-gray-400">transactions</span>
                </div>
              </div>
            </div>
            <!-- Custom HTML legend (replaces Chart.js built-in) -->
            <div class="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
              {#each [
                { label: 'Borrowed', color: '#10B981' },
                { label: 'Returned', color: '#3B82F6' },
                { label: 'Overdue',  color: '#EF4444' },
                { label: 'Reserved', color: '#F59E0B' },
              ] as item}
                <span class="flex items-center gap-1 text-xs text-gray-600">
                  <span class="inline-block w-2 h-2 rounded-full flex-shrink-0" style="background:{item.color}"></span>
                  {item.label}
                </span>
              {/each}
            </div>
          {/if}
        </div>
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex-1">
          <h3 class="text-base font-semibold text-gray-900 mb-2">Collection Split</h3>
          {#if $loading}
            <div class="flex justify-center"><div class="h-32 w-32 rounded-full border-4 border-gray-200 animate-pulse"></div></div>
          {:else}
            <!-- Canvas-only wrapper so overlay centers on the ring, not the legend -->
            <div class="relative h-40">
              <canvas id="collectionChart"></canvas>
              <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div class="text-center leading-tight">
                  <span class="block text-xl font-bold text-gray-900">{fn($dashboardData?.overview.totalItems ?? 0)}</span>
                  <span class="text-xs text-gray-400">total items</span>
                </div>
              </div>
            </div>
            <!-- Custom HTML legend (replaces Chart.js built-in) -->
            <div class="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
              {#each [
                { label: 'Books',     color: '#3B82F6' },
                { label: 'Magazines', color: '#8B5CF6' },
                { label: 'Thesis',    color: '#10B981' },
                { label: 'Journals',  color: '#F59E0B' },
              ] as item}
                <span class="flex items-center gap-1 text-xs text-gray-600">
                  <span class="inline-block w-2 h-2 rounded-full flex-shrink-0" style="background:{item.color}"></span>
                  {item.label}
                </span>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- ══ ROW 4: Tabbed analytics panel ═════════════════════════════════════ -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <!-- Tab bar -->
      <div class="flex border-b border-gray-200 bg-gray-50">
        {#each [
          { id: 'borrowings',   label: 'Borrowings by Type' },
          { id: 'reservations', label: 'Reservations' },
          { id: 'fines',        label: 'Fines & Payments' },
          { id: 'collection',   label: 'Category Distribution' },
        ] as tab}
          <button on:click={async () => {
              activeTab = tab.id as any;
              // wait for DOM update so canvases are present, then init only charts for the active tab
              await tick();
              if ($dashboardData) {
                if (activeTab === 'borrowings') initBorrowingsCharts($dashboardData);
                else if (activeTab === 'reservations') initReservationsCharts($dashboardData);
                else if (activeTab === 'fines') initFinesCharts($dashboardData);
                else if (activeTab === 'collection') initCollectionCharts($dashboardData);
              }
            }}
            class="px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
              {activeTab === tab.id ? 'border-indigo-500 text-indigo-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}">
            {tab.label}
          </button>
        {/each}
      </div>

      <div class="p-4">
        {#if activeTab === 'borrowings'}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 class="text-sm font-semibold text-gray-700 mb-3">Borrowed vs Returned vs Overdue</h4>
              <div class="h-56">{#if $loading}<div class="h-full bg-gray-100 animate-pulse rounded"></div>{:else}<canvas id="borrowingsByTypeChart"></canvas>{/if}</div>
            </div>
            <div>
              <h4 class="text-sm font-semibold text-gray-700 mb-3">Daily Borrowings Trend (All Types)</h4>
              <div class="h-56">{#if $loading}<div class="h-full bg-gray-100 animate-pulse rounded"></div>{:else}<canvas id="borrowingsChart"></canvas>{/if}</div>
            </div>
          </div>
          <!-- Overdue by type quick stats -->
          {#if $dashboardData}
            <div class="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {#each [
                { label: 'Books Overdue',     value: $dashboardData.overview.overdueByType.books,     color: 'bg-blue-50 text-blue-700' },
                { label: 'Magazines Overdue', value: $dashboardData.overview.overdueByType.magazines, color: 'bg-purple-50 text-purple-700' },
                { label: 'Thesis Overdue',    value: $dashboardData.overview.overdueByType.thesis,    color: 'bg-teal-50 text-teal-700' },
                { label: 'Journals Overdue',  value: $dashboardData.overview.overdueByType.journals,  color: 'bg-orange-50 text-orange-700' },
              ] as s}
                <div class="rounded-lg {s.color} px-3 py-2 flex items-center justify-between text-sm font-medium">
                  <span>{s.label}</span><span class="text-xl font-bold">{s.value}</span>
                </div>
              {/each}
            </div>
          {/if}

        {:else if activeTab === 'reservations'}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 class="text-sm font-semibold text-gray-700 mb-3">Reservation Status Breakdown</h4>
              <div class="h-56 flex items-center justify-center">
                {#if $loading}<div class="h-48 w-48 rounded-full border-4 border-gray-200 animate-pulse"></div>
                {:else}<canvas id="reservationStatusChart"></canvas>{/if}
              </div>
            </div>
            <div class="space-y-3">
              <h4 class="text-sm font-semibold text-gray-700">Pending by Type</h4>
              {#if $dashboardData}
                {#each [
                  { label: 'Books',     value: 0, pending: $dashboardData.overview.totalPendingReservations },
                  { label: 'Return Requests', value: $dashboardData.overview.totalPendingReturnRequests, pending: $dashboardData.overview.totalPendingReturnRequests },
                ] as r}
                  <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span class="text-sm text-gray-700">{r.label}</span>
                    <span class="px-3 py-1 text-sm font-semibold bg-amber-100 text-amber-800 rounded-full">{r.value} pending</span>
                  </div>
                {/each}
                <div class="p-3 bg-indigo-50 rounded-lg flex items-center justify-between">
                  <span class="text-sm font-medium text-indigo-800">Total Reservations This Period</span>
                  <span class="text-xl font-bold text-indigo-800">{fn($dashboardData.overview.totalReservationsPeriod)}</span>
                </div>
              {/if}
            </div>
          </div>

        {:else if activeTab === 'fines'}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 class="text-sm font-semibold text-gray-700 mb-3">Penalty Accumulation Trend</h4>
              <div class="h-56">{#if $loading}<div class="h-full bg-gray-100 animate-pulse rounded"></div>{:else}<canvas id="penaltiesChart"></canvas>{/if}</div>
            </div>
            <div>
              <h4 class="text-sm font-semibold text-gray-700 mb-3">Payments Received</h4>
              <div class="h-56">{#if $loading}<div class="h-full bg-gray-100 animate-pulse rounded"></div>{:else}<canvas id="paymentTrendsChart"></canvas>{/if}</div>
            </div>
          </div>
          {#if $dashboardData}
            <div class="mt-4 grid grid-cols-3 gap-3">
              <div class="bg-red-50 border border-red-100 rounded-lg p-3 text-center">
                <p class="text-xs text-red-600 font-medium uppercase tracking-wide mb-1">Total Unpaid</p>
                <p class="text-xl font-bold text-red-700">{fc($dashboardData.overview.totalUnpaidFines)}</p>
              </div>
              <div class="bg-green-50 border border-green-100 rounded-lg p-3 text-center">
                <p class="text-xs text-green-600 font-medium uppercase tracking-wide mb-1">Total Collected</p>
                <p class="text-xl font-bold text-green-700">{fc($dashboardData.overview.totalPaidFines)}</p>
              </div>
              <div class="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-center">
                <p class="text-xs text-indigo-600 font-medium uppercase tracking-wide mb-1">Payments This Period</p>
                <p class="text-xl font-bold text-indigo-700">{fn($dashboardData.overview.paymentsCount)}</p>
              </div>
            </div>
          {/if}

        {:else}
          <div>
            <h4 class="text-sm font-semibold text-gray-700 mb-3">Category Distribution</h4>
            <div class="h-64">{#if $loading}<div class="h-full bg-gray-100 animate-pulse rounded"></div>{:else}<canvas id="categoriesChart"></canvas>{/if}</div>
          </div>
        {/if}
      </div>
    </div>

    <!-- ══ ROW 5: Member stats ════════════════════════════════════════════════ -->
    {#if $dashboardData}
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {#each $dashboardData.charts.memberActivity as stat}
          <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center justify-between">
            <div>
              <p class="text-xs text-gray-500 font-medium uppercase tracking-wide">{stat.type}</p>
              <p class="text-2xl font-bold text-gray-900 mt-1">{fn(stat.active)}</p>
              <p class="text-xs text-emerald-600 mt-0.5 font-medium">+{stat.new} new this period</p>
            </div>
            <div class="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
              <svelte:component this={Icons.User} class="h-6 w-6 text-indigo-600" />
            </div>
          </div>
        {/each}
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center justify-between">
          <div>
            <p class="text-xs text-gray-500 font-medium uppercase tracking-wide">New Members</p>
            <p class="text-2xl font-bold text-gray-900 mt-1">{fn($dashboardData.overview.newMembers)}</p>
            <p class="text-xs text-gray-400 mt-0.5">Joined this period</p>
          </div>
          <div class="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
            <svelte:component this={Icons.UserPlus} class="h-6 w-6 text-green-600" />
          </div>
        </div>
      </div>
    {/if}

    <!-- ══ ROW 6: Data tables ══════════════════════════════════════════════════ -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-3">

      <!-- Top borrowed items (all types) -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <h3 class="text-base font-semibold text-gray-900">Most Popular Items</h3>
          <p class="text-xs text-gray-500 mt-0.5">Top borrowed across all types this period</p>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-100">
            <thead class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th class="px-4 py-2 text-left w-10">#</th>
                <th class="px-4 py-2 text-left">Item</th>
                <th class="px-4 py-2 text-center">Type</th>
                <th class="px-4 py-2 text-center">Borrows</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              {#if $loading}
                {#each Array(5) as _}<tr><td colspan="4" class="px-4 py-3"><div class="h-9 bg-gray-100 rounded animate-pulse"></div></td></tr>{/each}
              {:else if ($dashboardData?.tables.topItems.length ?? 0) === 0}
                <tr><td colspan="4" class="px-4 py-8 text-center text-sm text-gray-400">No borrowing data for this period</td></tr>
              {:else}
                {#each ($dashboardData?.tables.topItems ?? []) as item, i}
                  <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-4 py-3">
                      <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                        {i===0 ? 'bg-yellow-400 text-white' : i===1 ? 'bg-gray-300 text-white' : i===2 ? 'bg-orange-400 text-white' : 'bg-gray-100 text-gray-600'}">
                        {i+1}
                      </div>
                    </td>
                    <td class="px-4 py-3">
                      <p class="text-sm font-semibold text-gray-900 truncate max-w-xs">{item.title}</p>
                      <p class="text-xs text-gray-400 truncate">{item.author}</p>
                    </td>
                    <td class="px-4 py-3 text-center">
                      <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium {itemTypeBadge(item.itemType)}">{item.itemType}</span>
                    </td>
                    <td class="px-4 py-3 text-center">
                      <span class="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">{item.borrowCount}</span>
                    </td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Overdue items (all types) -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div class="px-4 py-3 border-b border-red-100 bg-gradient-to-r from-red-50 to-white flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>
            <div>
              <h3 class="text-base font-semibold text-red-900">Overdue Items</h3>
              <p class="text-xs text-gray-500 mt-0.5">All types — oldest first • ₱5/hour</p>
            </div>
          </div>
          <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
            {$dashboardData?.overview.totalOverdue ?? 0} total
          </span>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-100">
            <thead class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th class="px-4 py-2 text-left">Item / Borrower</th>
                <th class="px-4 py-2 text-center">Type</th>
                <th class="px-4 py-2 text-center">Days</th>
                <th class="px-4 py-2 text-center">Hours</th>
                <th class="px-4 py-2 text-right">Fine</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              {#if $loading}
                {#each Array(5) as _}<tr><td colspan="4" class="px-4 py-3"><div class="h-9 bg-gray-100 rounded animate-pulse"></div></td></tr>{/each}
              {:else if ($dashboardData?.tables.overdueList.length ?? 0) === 0}
                <tr><td colspan="4" class="px-4 py-8 text-center text-sm text-gray-400">No overdue items — great!</td></tr>
              {:else}
                {#each ($dashboardData?.tables.overdueList ?? []) as item}
                  <tr class="hover:bg-red-50/40 transition-colors">
                    <td class="px-4 py-3">
                      <p class="text-sm font-semibold text-gray-900 truncate max-w-xs">{item.itemTitle}</p>
                      <p class="text-xs text-gray-400">{item.borrowerName}</p>
                    </td>
                    <td class="px-4 py-3 text-center">
                      <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium {itemTypeBadge(item.itemType)}">{item.itemType}</span>
                    </td>
                    <td class="px-4 py-3 text-center">
                      <span class="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold
                        {item.daysOverdue <= 3 ? 'bg-yellow-100 text-yellow-800' : item.daysOverdue <= 7 ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'}">
                        {item.daysOverdue}d
                      </span>
                    </td>
                    <td class="px-4 py-3 text-center">
                      <span class="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold
                        {item.hoursOverdue && item.hoursOverdue <= 24 ? 'bg-yellow-100 text-yellow-800' : item.hoursOverdue && item.hoursOverdue <= 72 ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'}">
                        {item.hoursOverdue ?? 0}h
                      </span>
                    </td>
                    <td class="px-4 py-3 text-right text-sm font-bold text-gray-900">{fc(item.fine)}</td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ══ ROW 7: Payments + Top debtors ═════════════════════════════════════ -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-3">

      <!-- Recent payments -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-green-50 to-white">
          <h3 class="text-base font-semibold text-gray-900">Recent Payments</h3>
          <p class="text-xs text-gray-500 mt-0.5">Last transactions received this period</p>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-100">
            <thead class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th class="px-4 py-2 text-left">Member</th>
                <th class="px-4 py-2 text-center">Type</th>
                <th class="px-4 py-2 text-center">Method</th>
                <th class="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              {#if $loading}
                {#each Array(5) as _}<tr><td colspan="4" class="px-4 py-3"><div class="h-9 bg-gray-100 rounded animate-pulse"></div></td></tr>{/each}
              {:else if ($dashboardData?.tables.recentPayments.length ?? 0) === 0}
                <tr><td colspan="4" class="px-4 py-8 text-center text-sm text-gray-400">No payments this period</td></tr>
              {:else}
                {#each ($dashboardData?.tables.recentPayments ?? []) as p}
                  <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-4 py-3">
                      <p class="text-sm font-semibold text-gray-900">{p.memberName}</p>
                      <p class="text-xs text-gray-400">{fdt(p.paymentDate)}</p>
                    </td>
                    <td class="px-4 py-3 text-center">
                      <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 capitalize">{p.paymentType}</span>
                    </td>
                    <td class="px-4 py-3 text-center">
                      <span class="text-xs text-gray-500 capitalize">{p.paymentMethod}</span>
                    </td>
                    <td class="px-4 py-3 text-right text-sm font-bold text-green-700">{fc(p.amount)}</td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Top debtors -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div class="px-4 py-3 border-b border-rose-100 bg-gradient-to-r from-rose-50 to-white">
          <h3 class="text-base font-semibold text-gray-900">Highest Outstanding Fines</h3>
          <p class="text-xs text-gray-500 mt-0.5">Members with largest unpaid balances</p>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-100">
            <thead class="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th class="px-4 py-2 text-left">Member</th>
                <th class="px-4 py-2 text-center">Type</th>
                <th class="px-4 py-2 text-center">Items</th>
                <th class="px-4 py-2 text-right">Total Fine</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              {#if $loading}
                {#each Array(5) as _}<tr><td colspan="4" class="px-4 py-3"><div class="h-9 bg-gray-100 rounded animate-pulse"></div></td></tr>{/each}
              {:else if ($dashboardData?.tables.topDebtors.length ?? 0) === 0}
                <tr><td colspan="4" class="px-4 py-8 text-center text-sm text-gray-400">No outstanding fines</td></tr>
              {:else}
                {#each ($dashboardData?.tables.topDebtors ?? []) as d}
                  <tr class="hover:bg-rose-50/40 transition-colors">
                    <td class="px-4 py-3 text-sm font-semibold text-gray-900">{d.memberName}</td>
                    <td class="px-4 py-3 text-center">
                      <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium {d.userType === 'faculty' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'} capitalize">{d.userType}</span>
                    </td>
                    <td class="px-4 py-3 text-center text-sm text-gray-600">{d.fineCount}</td>
                    <td class="px-4 py-3 text-right text-sm font-bold text-red-600">{fc(d.totalFine)}</td>
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