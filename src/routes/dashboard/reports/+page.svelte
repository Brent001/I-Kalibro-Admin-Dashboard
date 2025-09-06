<script lang="ts">
  import Layout from "$lib/components/ui/layout.svelte";
  import { onMount } from 'svelte';
  import Chart from 'chart.js/auto';

  interface DashboardData {
    overview: {
      totalVisits: number;
      totalTransactions: number;
      activeBorrowings: number;
      overdueBooks: number;
      totalPenalties: number;
      availableBooks: number;
    };
    charts: {
      dailyVisits: Array<{date: string; count: number}>;
      transactionTypes: Array<{type: string; count: number}>;
      categoryDistribution: Array<{category: string; count: number; percentage: number}>;
      penaltyTrends: Array<{date: string; amount: number}>;
      memberActivity: Array<{type: string; active: number; new: number}>;
    };
    tables: {
      topBooks: Array<{title: string; author: string; borrowCount: number}>;
      overdueList: Array<{bookTitle: string; borrowerName: string; daysOverdue: number; fine: number}>;
    };
  }

  let loading = true;
  let errorMsg = "";
  let selectedPeriod = "month";
  
  const periodOptions = [
    { value: "week", label: "Last 7 Days" },
    { value: "month", label: "Last 30 Days" },
    { value: "quarter", label: "Last 3 Months" },
    { value: "year", label: "Last 12 Months" }
  ];

  let dashboardData: DashboardData = {
    overview: {
      totalVisits: 0,
      totalTransactions: 0,
      activeBorrowings: 0,
      overdueBooks: 0,
      totalPenalties: 0,
      availableBooks: 0
    },
    charts: {
      dailyVisits: [],
      transactionTypes: [],
      categoryDistribution: [],
      penaltyTrends: [],
      memberActivity: []
    },
    tables: {
      topBooks: [],
      overdueList: []
    }
  };

  // Chart instances
  let visitsChart: any = null;
  let transactionsChart: any = null;
  let categoriesChart: any = null;
  let penaltiesChart: any = null;

  // Store full category names for hover
  let fullCategoryNames: string[] = [];

  onMount(async () => {
    await loadReports();
    if (typeof window !== 'undefined' && window.Chart) {
      initializeCharts();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js';
      script.onload = () => {
        initializeCharts();
      };
      document.head.appendChild(script);
    }
  });

  async function loadReports() {
    loading = true;
    errorMsg = "";
    try {
      const res = await fetch(`/api/reports?period=${selectedPeriod}`);
      const data = await res.json();
      if (res.ok && data.success) {
        dashboardData = data.data;
      } else {
        errorMsg = data.message || "Failed to load reports.";
      }
    } catch (err) {
      errorMsg = "Network error. Please try again.";
      // Sample data for demonstration
      dashboardData = {
        overview: {
          totalVisits: 1247,
          totalTransactions: 856,
          activeBorrowings: 342,
          overdueBooks: 28,
          totalPenalties: 485000,
          availableBooks: 8734
        },
        charts: {
          dailyVisits: [
            {date: '2024-01-01', count: 45}, {date: '2024-01-02', count: 52},
            {date: '2024-01-03', count: 38}, {date: '2024-01-04', count: 61},
            {date: '2024-01-05', count: 48}, {date: '2024-01-06', count: 73},
            {date: '2024-01-07', count: 67}, {date: '2024-01-08', count: 82},
            {date: '2024-01-09', count: 59}, {date: '2024-01-10', count: 71},
            {date: '2024-01-11', count: 65}, {date: '2024-01-12', count: 88},
            {date: '2024-01-13', count: 94}, {date: '2024-01-14', count: 76}
          ],
          transactionTypes: [
            {type: 'Borrowed', count: 456},
            {type: 'Returned', count: 389},
            {type: 'Renewed', count: 67},
            {type: 'Reserved', count: 23}
          ],
          categoryDistribution: [
            {category: 'Fiction', count: 245, percentage: 28},
            {category: 'Science', count: 189, percentage: 22},
            {category: 'Technology', count: 156, percentage: 18},
            {category: 'History', count: 134, percentage: 15},
            {category: 'Arts', count: 98, percentage: 11},
            {category: 'Others', count: 56, percentage: 6}
          ],
          penaltyTrends: [
            {date: '2024-01-01', amount: 12500}, {date: '2024-01-08', amount: 15200},
            {date: '2024-01-15', amount: 18700}, {date: '2024-01-22', amount: 14300},
            {date: '2024-01-29', amount: 16800}, {date: '2024-02-05', amount: 19200},
            {date: '2024-02-12', amount: 21500}, {date: '2024-02-19', amount: 17800}
          ],
          memberActivity: [
            {type: 'Students', active: 245, new: 12},
            {type: 'Faculty', active: 67, new: 3},
            {type: 'Staff', active: 34, new: 2},
            {type: 'Visitors', active: 18, new: 8}
          ]
        },
        tables: {
          topBooks: [
            {title: 'Introduction to Algorithms', author: 'Thomas H. Cormen', borrowCount: 23},
            {title: 'Clean Code', author: 'Robert C. Martin', borrowCount: 19},
            {title: 'Design Patterns', author: 'Gang of Four', borrowCount: 17},
            {title: 'The Pragmatic Programmer', author: 'Andrew Hunt', borrowCount: 15},
            {title: 'Code Complete', author: 'Steve McConnell', borrowCount: 14},
            {title: 'JavaScript: The Good Parts', author: 'Douglas Crockford', borrowCount: 13},
            {title: 'Effective Java', author: 'Joshua Bloch', borrowCount: 12}
          ],
          overdueList: [
            {bookTitle: 'Data Structures and Algorithms', borrowerName: 'John Smith', daysOverdue: 5, fine: 2500},
            {bookTitle: 'Machine Learning Basics', borrowerName: 'Sarah Johnson', daysOverdue: 3, fine: 1500},
            {bookTitle: 'Web Development Guide', borrowerName: 'Mike Wilson', daysOverdue: 8, fine: 4000},
            {bookTitle: 'Database Systems', borrowerName: 'Emily Davis', daysOverdue: 2, fine: 1000},
            {bookTitle: 'Software Engineering', borrowerName: 'Alex Brown', daysOverdue: 12, fine: 6000}
          ]
        }
      };
    } finally {
      loading = false;
    }
  }

  async function handlePeriodChange() {
    loading = true;
    await loadReports();
    updateCharts();
    loading = false;
  }

  function truncateCategory(category: string, max: number = 12) {
    return category.length > max ? category.slice(0, max) + '...' : category;
  }

  // Truncate category if needed, else show full
  function getCategoryLabels(): string[] {
    const isMobile = window.innerWidth < 640;
    const maxLen = isMobile ? 8 : 12;
    fullCategoryNames = dashboardData.charts.categoryDistribution.map(d => d.category);
    return dashboardData.charts.categoryDistribution.map(d => {
      return d.category.length > maxLen ? d.category.slice(0, maxLen) + '...' : d.category;
    });
  }

  function initializeCharts() {
    // Daily Visits Chart - Enhanced with gradient
    const visitsCtx = document.getElementById('visitsChart') as HTMLCanvasElement;
    if (visitsCtx) {
      const gradient = visitsCtx.getContext('2d')!.createLinearGradient(0, 0, 0, 400);
      gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
      gradient.addColorStop(1, 'rgba(59, 130, 246, 0.05)');

      visitsChart = new Chart(visitsCtx, {
        type: 'line',
        data: {
          labels: dashboardData.charts.dailyVisits.map(d => {
            const date = new Date(d.date);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          }),
          datasets: [{
            label: 'Daily Visits',
            data: dashboardData.charts.dailyVisits.map(d => d.count),
            borderColor: '#3B82F6',
            backgroundColor: gradient,
            borderWidth: 3,
            pointBackgroundColor: '#3B82F6',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
            tension: 0.4,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            intersect: false,
            mode: 'index'
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleColor: '#ffffff',
              bodyColor: '#ffffff',
              borderColor: '#3B82F6',
              borderWidth: 1
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#6B7280' }
            },
            y: { 
              beginAtZero: true,
              grid: { color: '#F3F4F6' },
              ticks: { color: '#6B7280' }
            }
          }
        }
      });
    }

    // Transaction Types Chart
    const transactionsCtx = document.getElementById('transactionsChart') as HTMLCanvasElement;
    if (transactionsCtx) {
      transactionsChart = new Chart(transactionsCtx, {
        type: 'doughnut',
        data: {
          labels: dashboardData.charts.transactionTypes.map(d => d.type),
          datasets: [{
            data: dashboardData.charts.transactionTypes.map(d => d.count),
            backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'],
            borderWidth: 0,
            hoverBorderWidth: 2,
            hoverBorderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: { 
              position: 'bottom',
              labels: {
                padding: 20,
                usePointStyle: true,
                pointStyle: 'circle'
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              callbacks: {
                label: (context) => {
                  const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                  const percentage = ((context.parsed / total) * 100).toFixed(1);
                  return `${context.label}: ${context.parsed} (${percentage}%)`;
                }
              }
            }
          }
        }
      });
    }

    // Category Distribution Chart - Horizontal Bar
    const categoriesCtx = document.getElementById('categoriesChart') as HTMLCanvasElement;
    if (categoriesCtx) {
      categoriesChart = new Chart(categoriesCtx, {
        type: 'bar',
        data: {
          labels: getCategoryLabels(),
          datasets: [{
            label: 'Books by Category',
            data: dashboardData.charts.categoryDistribution.map(d => d.count),
            backgroundColor: '#6366F1',
            borderRadius: 6,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              callbacks: {
                // Show full category name on hover
                title: (context) => {
                  const idx = context[0].dataIndex;
                  return fullCategoryNames[idx];
                },
                label: (context) => {
                  const item = dashboardData.charts.categoryDistribution[context.dataIndex];
                  return `${item.category}: ${context.parsed.x} books (${item.percentage}%)`;
                }
              }
            }
          },
          scales: {
            x: { 
              beginAtZero: true,
              grid: { color: '#F3F4F6' },
              ticks: { color: '#6B7280' }
            },
            y: {
              grid: { display: false },
              ticks: { color: '#6B7280' }
            }
          }
        }
      });
    }

    // Penalties Trend Chart - Area Chart
    const penaltiesCtx = document.getElementById('penaltiesChart') as HTMLCanvasElement;
    if (penaltiesCtx) {
      const gradient = penaltiesCtx.getContext('2d')!.createLinearGradient(0, 0, 0, 400);
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)');
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0.05)');

      penaltiesChart = new Chart(penaltiesCtx, {
        type: 'line',
        data: {
          labels: dashboardData.charts.penaltyTrends.map(d => {
            const date = new Date(d.date);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          }),
          datasets: [{
            label: 'Penalty Amount (₱)',
            data: dashboardData.charts.penaltyTrends.map(d => d.amount / 100),
            borderColor: '#EF4444',
            backgroundColor: gradient,
            borderWidth: 3,
            pointBackgroundColor: '#EF4444',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
            tension: 0.4,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            intersect: false,
            mode: 'index'
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              callbacks: {
                label: (context) => `Penalties: ₱${context.parsed.y.toFixed(2)}`
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#6B7280' }
            },
            y: { 
              beginAtZero: true,
              grid: { color: '#F3F4F6' },
              ticks: {
                color: '#6B7280',
                callback: function(value: any) {
                  return '₱' + value;
                }
              }
            }
          }
        }
      });
    }
  }

  function updateCharts() {
    if (visitsChart) {
      visitsChart.data.labels = dashboardData.charts.dailyVisits.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      });
      visitsChart.data.datasets[0].data = dashboardData.charts.dailyVisits.map(d => d.count);
      visitsChart.update();
    }

    if (transactionsChart) {
      transactionsChart.data.labels = dashboardData.charts.transactionTypes.map(d => d.type);
      transactionsChart.data.datasets[0].data = dashboardData.charts.transactionTypes.map(d => d.count);
      transactionsChart.update();
    }

    if (categoriesChart) {
      categoriesChart.data.labels = getCategoryLabels();
      categoriesChart.data.datasets[0].data = dashboardData.charts.categoryDistribution.map(d => d.count);
      categoriesChart.update();
    }

    if (penaltiesChart) {
      penaltiesChart.data.labels = dashboardData.charts.penaltyTrends.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      });
      penaltiesChart.data.datasets[0].data = dashboardData.charts.penaltyTrends.map(d => d.amount / 100);
      penaltiesChart.update();
    }
  }

  function formatCurrency(amount: number) {
    return `₱${(amount / 100).toFixed(2)}`;
  }

  function exportReport() {
    console.log("Exporting report for period:", selectedPeriod);
  }
</script>

<Layout>
  <div class="space-y-8 px-0 lg:px-6">
    <!-- Header -->
    <div class="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
      <!-- Removed dashboard title and subtitle -->
      <div></div>
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center space-y-3 sm:space-y-0 sm:space-x-3">
        <select
          bind:value={selectedPeriod}
          on:change={handlePeriodChange}
          class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium"
        >
          {#each periodOptions as period}
            <option value={period.value}>{period.label}</option>
          {/each}
        </select>
        <button 
          on:click={exportReport}
          class="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
        >
          <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          Export Report
        </button>
        <button
          on:click={() => window.location.href = '/dashboard/reports/visits'}
          class="inline-flex items-center justify-center px-4 py-2 border border-indigo-300 text-sm font-medium rounded-lg text-indigo-700 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
        >
          <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
          </svg>
          Visit Logs
        </button>
      </div>
    </div>

    {#if errorMsg}
      <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        {errorMsg}
      </div>
    {/if}

    {#if loading}
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
      <!-- Key Metrics Cards -->
      <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 lg:gap-3">
        <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div class="flex items-center space-x-3">
            <div class="p-2 lg:p-3 bg-blue-100 rounded-xl">
              <svg class="h-5 w-5 lg:h-6 lg:w-6 text-blue-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs lg:text-sm font-medium text-gray-600">Total Visits</p>
              <p class="text-xl lg:text-2xl font-bold text-gray-900">{dashboardData.overview.totalVisits.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div class="flex items-center space-x-3">
            <div class="p-2 lg:p-3 bg-green-100 rounded-xl">
              <svg class="h-5 w-5 lg:h-6 lg:w-6 text-green-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs lg:text-sm font-medium text-gray-600">Transactions</p>
              <p class="text-xl lg:text-2xl font-bold text-gray-900">{dashboardData.overview.totalTransactions.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div class="flex items-center space-x-3">
            <div class="p-2 lg:p-3 bg-yellow-100 rounded-xl">
              <svg class="h-5 w-5 lg:h-6 lg:w-6 text-yellow-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
              </svg>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs lg:text-sm font-medium text-gray-600">Active Borrowings</p>
              <p class="text-xl lg:text-2xl font-bold text-gray-900">{dashboardData.overview.activeBorrowings}</p>
            </div>
          </div>
        </div>

        <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div class="flex items-center space-x-3">
            <div class="p-2 lg:p-3 bg-red-100 rounded-xl">
              <svg class="h-5 w-5 lg:h-6 lg:w-6 text-red-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs lg:text-sm font-medium text-gray-600">Overdue Books</p>
              <p class="text-xl lg:text-2xl font-bold text-gray-900">{dashboardData.overview.overdueBooks}</p>
            </div>
          </div>
        </div>

        <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div class="flex items-center space-x-3">
            <div class="p-2 lg:p-3 bg-purple-100 rounded-xl">
              <svg class="h-5 w-5 lg:h-6 lg:w-6 text-purple-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>
              </svg>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs lg:text-sm font-medium text-gray-600">Total Penalties</p>
              <p class="text-xl lg:text-2xl font-bold text-gray-900">{formatCurrency(dashboardData.overview.totalPenalties)}</p>
            </div>
          </div>
        </div>

        <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div class="flex items-center space-x-3">
            <div class="p-2 lg:p-3 bg-indigo-100 rounded-xl">
              <svg class="h-5 w-5 lg:h-6 lg:w-6 text-indigo-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 14v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs lg:text-sm font-medium text-gray-600">Available Books</p>
              <p class="text-xl lg:text-2xl font-bold text-gray-900">{dashboardData.overview.availableBooks.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Chart - Full Width -->
      <div class="bg-white p-6 lg:p-8 rounded-xl shadow-sm border border-gray-200">
        <!-- Daily Visits Trend -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h3 class="text-xl font-bold text-gray-900">Daily Visits Trend</h3>
            <p class="text-sm text-gray-500 mt-1">Visitor activity over the selected period</p>
          </div>
          <div class="mt-2 sm:mt-0">
            <span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
              <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
              </svg>
              Real-time Data
            </span>
          </div>
        </div>
        <div class="h-64 lg:h-72">
          <canvas id="visitsChart"></canvas>
        </div>
      </div>

      <!-- Secondary Charts Row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <!-- Transaction Types Chart -->
        <div class="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-gray-900">Transaction Types</h3>
            <div class="text-sm text-gray-500">Distribution</div>
          </div>
          <div class="h-56 sm:h-64">
            <canvas id="transactionsChart"></canvas>
          </div>
        </div>

        <!-- Category Distribution Chart -->
        <div class="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-gray-900">Book Categories</h3>
            <div class="text-sm text-gray-500">By popularity</div>
          </div>
          <div class="h-56 sm:h-64">
            <canvas id="categoriesChart"></canvas>
          </div>
        </div>
      </div>

      <!-- Penalties Trend Chart - Area Chart -->
      <div class="bg-white p-6 lg:p-8 rounded-xl shadow-sm border border-gray-200 mt-6">
        <!-- Penalty Collections -->
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-xl font-bold text-gray-900">Penalty Collections</h3>
          <div class="text-sm text-gray-500">Trend analysis</div>
        </div>
        <div class="h-64 lg:h-72">
          <canvas id="penaltiesChart"></canvas>
        </div>
      </div>

      <!-- Member Activity Cards -->
      <div class="bg-white p-6 lg:p-8 rounded-xl shadow-sm border border-gray-200">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-xl font-bold text-gray-900">Member Activity Summary</h3>
          <div class="text-sm text-gray-500">Active vs New Members</div>
        </div>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
          {#each dashboardData.charts.memberActivity as activity}
            <div class="bg-gradient-to-br from-gray-50 to-gray-100 p-4 lg:p-6 rounded-xl border border-gray-200">
              <div class="flex flex-col space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-gray-900">{activity.type}</span>
                  <div class="flex items-center space-x-1">
                    <div class="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span class="text-xs text-gray-500">Active</span>
                  </div>
                </div>
                <div class="flex items-end justify-between">
                  <div>
                    <p class="text-2xl lg:text-3xl font-bold text-gray-900">{activity.active}</p>
                    <p class="text-xs text-gray-600">Active members</p>
                  </div>
                  <div class="text-right">
                    <p class="text-lg font-semibold text-green-600">+{activity.new}</p>
                    <p class="text-xs text-gray-500">New this period</p>
                  </div>
                </div>
                <div class="pt-2 border-t border-gray-200">
                  <div class="flex justify-between items-center">
                    <span class="text-xs text-gray-500">Growth</span>
                    <span class="text-xs font-medium text-green-600">
                      {((activity.new / activity.active) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Data Tables Section -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-3 lg:gap-3">
        <!-- Top Books Table -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200">
          <div class="p-6 border-b border-gray-200">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-bold text-gray-900">Most Popular Books</h3>
              <span class="text-sm text-gray-500">Top performers</span>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Rank</th>
                  <th class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Book Details</th>
                  <th class="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Borrows</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {#each dashboardData.tables.topBooks as book, index}
                  <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-6 py-4">
                      <div class="flex items-center justify-center w-8 h-8 rounded-full {index < 3 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'} text-sm font-bold">
                        {index + 1}
                      </div>
                    </td>
                    <td class="px-6 py-4">
                      <div>
                        <div class="text-sm font-semibold text-gray-900">{book.title}</div>
                        <div class="text-sm text-gray-500">by {book.author}</div>
                      </div>
                    </td>
                    <td class="px-6 py-4 text-center">
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {book.borrowCount} times
                      </span>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Overdue Books Table -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200">
          <div class="p-6 border-b border-gray-200">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-bold text-gray-900">Overdue Books</h3>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {dashboardData.tables.overdueList.length} items
              </span>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Book & Borrower</th>
                  <th class="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Days Overdue</th>
                  <th class="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Fine</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {#each dashboardData.tables.overdueList as overdue}
                  <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-6 py-4">
                      <div>
                        <div class="text-sm font-semibold text-gray-900">{overdue.bookTitle}</div>
                        <div class="text-sm text-gray-500">Borrowed by {overdue.borrowerName}</div>
                      </div>
                    </td>
                    <td class="px-6 py-4 text-center">
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {overdue.daysOverdue <= 3 ? 'bg-yellow-100 text-yellow-800' : overdue.daysOverdue <= 7 ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'}">
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
          <div class="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div class="flex justify-between items-center text-sm">
              <span class="text-gray-600">Total Outstanding Fines:</span>
              <span class="font-bold text-gray-900">
                {formatCurrency(dashboardData.tables.overdueList.reduce((sum, item) => sum + item.fine, 0))}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Actions Footer -->
      <div class="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-6">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div>
            <h3 class="text-lg font-bold text-gray-900">Quick Actions</h3>
            <p class="text-sm text-gray-600">Manage your library operations efficiently</p>
          </div>
          <div class="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            <button class="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">
              <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
              </svg>
              Add New Book
            </button>
            <button class="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">
              <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
              View All Transactions
            </button>
            <button class="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">
              <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
              Generate Report
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</Layout>