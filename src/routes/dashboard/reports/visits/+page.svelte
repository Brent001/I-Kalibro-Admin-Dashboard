<script lang="ts">
  import { onMount } from "svelte";
  import { writable } from "svelte/store";

  export let data: { user?: { userType?: string } } = {};
  $: userType = data?.user?.userType || "";

  let visits: any[] = [];
  let loading = true;
  let errorMsg = "";
  let successMsg = "";

  // Filter state
  let selectedPeriod = "month";
  let selectedDate = "";
  let selectedTime = "";
  let searchTerm = "";
  let activeTab = "all";
  let showFilters = false;
  let periodDropdownOpen = false;
  let typeDropdownOpen = false;
  let selectedVisitorType = "all";

  // Export
  const exportDropdownOpen = writable(false);
  const selectedExportFormat = writable("pdf");
  const EXPORT_FORMATS = [
    { v: "pdf",   label: "PDF",   colorClass: "text-red-500" },
    { v: "excel", label: "Excel", colorClass: "text-green-500" }
  ];

  const tabs = [
    { id: "all",         label: "All Visits",   icon: "list" },
    { id: "checked_in",  label: "Checked In",   icon: "login" },
    { id: "checked_out", label: "Checked Out",  icon: "logout" },
  ];

  const periodOptions = [
    { value: "day",   label: "Today" },
    { value: "week",  label: "Last 7 Days" },
    { value: "month", label: "Last 30 Days" },
    { value: "year",  label: "Last 12 Months" },
    { value: "all",   label: "All Time" },
  ];

  const visitorTypeOptions = [
    { value: "all",     label: "All Types" },
    { value: "Student", label: "Student" },
    { value: "Faculty", label: "Faculty" },
    { value: "Staff",   label: "Staff" },
    { value: "Guest",   label: "Guest" },
  ];

  onMount(async () => {
    await loadVisits();
  });

  async function loadVisits() {
    loading = true;
    errorMsg = "";
    try {
      let url = `/api/reports/visits?period=${selectedPeriod}`;
      if (selectedDate) url += `&date=${selectedDate}`;
      if (selectedTime) url += `&time=${selectedTime}`;
      const res = await fetch(url);
      const json = await res.json();
      if (res.ok && json.success && Array.isArray(json.visits)) {
        visits = json.visits.map((v: any) => {
          let duration = "—";
          if (v.timeIn && v.timeOut) {
            const inDate  = new Date(v.timeIn);
            const outDate = new Date(v.timeOut);
            const diffMs  = outDate.getTime() - inDate.getTime();
            if (diffMs > 0) {
              const mins    = Math.floor(diffMs / 60000);
              const hours   = Math.floor(mins / 60);
              const remMins = mins % 60;
              duration = hours > 0 ? `${hours}h ${remMins}m` : `${remMins} min`;
            }
          }
          return {
            ...v,
            purpose: v.purpose ?? "",
            status: v.status ?? (v.timeOut ? "checked_out" : "checked_in"),
            duration,
          };
        });
      } else {
        errorMsg = json.message || "Failed to load visits.";
        visits = [];
      }
    } catch {
      errorMsg = "Network error. Please try again.";
      visits = [];
    } finally {
      loading = false;
    }
  }

  function resetFilters() {
    selectedDate = "";
    selectedTime = "";
    selectedPeriod = "month";
    searchTerm = "";
    selectedVisitorType = "all";
    activeTab = "all";
    loadVisits();
  }

  async function handleExport() {
    try {
      const format = $selectedExportFormat;
      const res  = await fetch(`/api/reports/visits/export?format=${format}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `visits_${new Date().toISOString().split("T")[0]}.${format === "excel" ? "xlsx" : "pdf"}`;
      link.click();
    } catch {
      alert("Export failed.");
    }
  }

  $: filteredVisits = visits.filter((visit) => {
    const search      = searchTerm.toLowerCase();
    const name        = (visit.visitorName || visit.user?.name || visit.fullName || "").toLowerCase();
    const idNumber    = (visit.idNumber || "").toLowerCase();
    const purpose     = (visit.purpose  || "").toLowerCase();
    const matchSearch = name.includes(search) || idNumber.includes(search) || purpose.includes(search);

    const matchTab =
      activeTab === "all"
        ? true
        : visit.status?.toLowerCase() === activeTab.toLowerCase();

    const matchType =
      selectedVisitorType === "all"
        ? true
        : (visit.visitorType || "").toLowerCase() === selectedVisitorType.toLowerCase();

    return matchSearch && matchTab && matchType;
  });

  $: stats = {
    total:      visits.length,
    checkedIn:  visits.filter((v) => v.status === "checked_in").length,
    checkedOut: visits.filter((v) => v.status === "checked_out").length,
    today:      visits.filter((v) => {
      if (!v.timeIn) return false;
      const d = new Date(v.timeIn);
      const n = new Date();
      return d.toDateString() === n.toDateString();
    }).length,
  };

  function formatDateTime(dateStr: string) {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleString("en-US", {
        year: "numeric", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit", hour12: true,
      });
    } catch {
      return dateStr;
    }
  }

  function formatDateOnly(dateStr: string) {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    } catch { return dateStr; }
  }

  function formatTimeOnly(dateStr: string) {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    } catch { return ""; }
  }

  function getStatusColor(status: string) {
    return status === "checked_in"
      ? "bg-blue-100 text-blue-800 border-blue-200"
      : "bg-emerald-100 text-emerald-800 border-emerald-200";
  }

  function getStatusDot(status: string) {
    return status === "checked_in" ? "bg-blue-500" : "bg-emerald-500";
  }

  function getTypeColor(type: string) {
    const t = (type || "").toLowerCase();
    switch (t) {
      case "student": return "bg-slate-100 text-slate-800 border-slate-200";
      case "faculty": return "bg-violet-100 text-violet-800 border-violet-200";
      case "staff":   return "bg-amber-100 text-amber-800 border-amber-200";
      case "guest":   return "bg-rose-100 text-rose-800 border-rose-200";
      default:        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  }

  function getInitial(visit: any) {
    const name = visit.visitorName || visit.user?.name || visit.fullName || "";
    return name.charAt(0).toUpperCase() || "V";
  }

  function getVisitorName(visit: any) {
    return visit.visitorName || visit.user?.name || visit.fullName || "—";
  }
</script>

<svelte:head>
  <title>Visit Reports | E-Kalibro Admin Portal</title>
</svelte:head>

<div class="space-y-2">

  <!-- Header -->
  <div class="mb-2">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">Visit Management</h2>
        <p class="text-slate-600">Track and monitor all library visitor check-ins</p>
      </div>
    </div>
  </div>

  <!-- Alerts -->
  {#if successMsg}
    <div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-start justify-between">
      <div>
        <p class="font-medium text-sm">Success</p>
        <p class="text-xs mt-0.5">{successMsg}</p>
      </div>
      <button on:click={() => successMsg = ""} class="text-green-400 hover:text-green-600 ml-4">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  {/if}
  {#if errorMsg}
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start justify-between">
      <div>
        <p class="font-medium text-sm">Error</p>
        <p class="text-xs mt-0.5">{errorMsg}</p>
        <button on:click={loadVisits} class="mt-1.5 text-xs text-red-800 underline hover:text-red-900">Try again</button>
      </div>
      <button on:click={() => errorMsg = ""} class="text-red-400 hover:text-red-600 ml-4">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  {/if}

  <!-- Stats Cards -->
  <div class="grid grid-cols-2 gap-1 sm:gap-2 lg:grid-cols-4 mb-2">
    <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
      <div class="flex flex-col items-center text-center">
        <div class="p-2.5 rounded-lg mb-3 bg-gradient-to-br from-slate-400 to-slate-600 shadow-sm">
          <svg class="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
        </div>
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Total Visits</p>
        <p class="text-lg sm:text-xl font-bold text-gray-900">{stats.total}</p>
      </div>
    </div>

    <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
      <div class="flex flex-col items-center text-center">
        <div class="p-2.5 rounded-lg mb-3 bg-gradient-to-br from-blue-400 to-blue-600 shadow-sm">
          <svg class="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
          </svg>
        </div>
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Checked In</p>
        <p class="text-lg sm:text-xl font-bold text-gray-900">{stats.checkedIn}</p>
      </div>
    </div>

    <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
      <div class="flex flex-col items-center text-center">
        <div class="p-2.5 rounded-lg mb-3 bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-sm">
          <svg class="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
        </div>
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Checked Out</p>
        <p class="text-lg sm:text-xl font-bold text-gray-900">{stats.checkedOut}</p>
      </div>
    </div>

    <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
      <div class="flex flex-col items-center text-center">
        <div class="p-2.5 rounded-lg mb-3 bg-gradient-to-br from-amber-400 to-amber-600 shadow-sm">
          <svg class="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"/>
          </svg>
        </div>
        <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Today</p>
        <p class="text-lg sm:text-xl font-bold text-gray-900">{stats.today}</p>
      </div>
    </div>
  </div>

  <!-- Search and Filters -->
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-3 mb-2">

    <!-- Search + quick filters (desktop) -->
    <div class="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div class="relative flex-1">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/>
          <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="text"
          placeholder="Search by name, ID, or purpose..."
          bind:value={searchTerm}
          class="pl-10 pr-4 py-2.5 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 text-sm"
          disabled={loading}
        />
        {#if loading}
          <div class="absolute right-3 top-1/2 -translate-y-1/2">
            <div class="animate-spin rounded-full h-4 w-4 border-2 border-slate-300 border-t-slate-600"></div>
          </div>
        {/if}
      </div>

      <!-- Desktop filters -->
      <div class="hidden sm:flex items-center gap-2">

        <!-- Period dropdown -->
        <div class="relative">
          <button
            on:click={() => { periodDropdownOpen = !periodDropdownOpen; typeDropdownOpen = false; }}
            class="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 flex items-center gap-2 hover:bg-gray-50 transition-colors"
          >
            <span>{periodOptions.find(p => p.value === selectedPeriod)?.label || "Last 30 Days"}</span>
            <svg class={`h-4 w-4 text-gray-400 transition-transform ${periodDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          {#if periodDropdownOpen}
            <div class="absolute z-10 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg">
              {#each periodOptions as opt}
                <button
                  on:click={() => { selectedPeriod = opt.value; periodDropdownOpen = false; loadVisits(); }}
                  class={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg transition-colors ${selectedPeriod === opt.value ? "bg-slate-100 text-slate-900 font-medium" : "text-gray-700"}`}
                >{opt.label}</button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Visitor type dropdown -->
        <div class="relative">
          <button
            on:click={() => { typeDropdownOpen = !typeDropdownOpen; periodDropdownOpen = false; }}
            class="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 flex items-center gap-2 hover:bg-gray-50 transition-colors"
          >
            <span>{visitorTypeOptions.find(o => o.value === selectedVisitorType)?.label || "All Types"}</span>
            <svg class={`h-4 w-4 text-gray-400 transition-transform ${typeDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          {#if typeDropdownOpen}
            <div class="absolute z-10 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg">
              {#each visitorTypeOptions as opt}
                <button
                  on:click={() => { selectedVisitorType = opt.value; typeDropdownOpen = false; }}
                  class={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg transition-colors ${selectedVisitorType === opt.value ? "bg-slate-100 text-slate-900 font-medium" : "text-gray-700"}`}
                >{opt.label}</button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Date filter -->
        <input
          type="date"
          bind:value={selectedDate}
          on:change={loadVisits}
          class="px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all"
          disabled={loading}
        />

        <!-- Refresh -->
        <button
          on:click={loadVisits}
          class="p-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-500"
          title="Refresh"
          disabled={loading}
        >
          <svg class={`h-4 w-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/>
          </svg>
        </button>

        <!-- Export -->
        <div class="relative">
          <button
            on:click={() => exportDropdownOpen.update(v => !v)}
            class="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg class="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Export
            <svg class={`h-4 w-4 text-gray-400 transition-transform ${$exportDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          {#if $exportDropdownOpen}
            <div class="absolute right-0 z-20 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg">
              {#each EXPORT_FORMATS as fmt}
                <button
                  on:click={() => { selectedExportFormat.set(fmt.v); exportDropdownOpen.set(false); handleExport(); }}
                  class={`w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg flex items-center gap-2 ${$selectedExportFormat === fmt.v ? "bg-slate-50 text-slate-700 font-medium" : ""}`}
                >
                  <span class={`h-2 w-2 rounded-full ${fmt.colorClass === "text-red-500" ? "bg-red-500" : "bg-green-500"}`}></span>
                  {fmt.label}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Reset -->
        <button
          on:click={resetFilters}
          class="px-3 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200 transition-colors font-medium"
          disabled={loading}
        >Reset</button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="border-b border-gray-200 mb-4 -mx-3 px-3">
      <div class="flex gap-0 overflow-x-auto">
        {#each tabs as tab}
          <button
            on:click={() => activeTab = tab.id}
            class={`px-4 py-3 font-medium text-sm border-b-2 transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
              activeTab === tab.id
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            {#if tab.icon === "list"}
              <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            {:else if tab.icon === "login"}
              <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
              </svg>
            {:else if tab.icon === "logout"}
              <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
            {/if}
            {tab.label}
            <span class={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
              activeTab === tab.id ? "bg-slate-900 text-white" : "bg-gray-100 text-gray-500"
            }`}>
              {tab.id === "all" ? visits.length : visits.filter(v => v.status === tab.id).length}
            </span>
          </button>
        {/each}
      </div>
    </div>

    <!-- Mobile filter toggle -->
    <div class="sm:hidden mb-3">
      <button
        on:click={() => showFilters = !showFilters}
        class="w-full flex items-center justify-between px-3 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
      >
        <span class="flex items-center gap-2 font-medium text-gray-700">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z"/>
          </svg>
          Filters
        </span>
        <svg class={`h-4 w-4 text-gray-400 transition-transform ${showFilters ? "rotate-180" : ""}`} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
    </div>

    <!-- Mobile filters expanded -->
    {#if showFilters}
      <div class="sm:hidden flex flex-col gap-2">
        <div class="relative">
          <button
            on:click={() => periodDropdownOpen = !periodDropdownOpen}
            class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 flex items-center justify-between"
          >
            <span>{periodOptions.find(p => p.value === selectedPeriod)?.label}</span>
            <svg class={`h-4 w-4 text-gray-400 transition-transform ${periodDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          {#if periodDropdownOpen}
            <div class="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
              {#each periodOptions as opt}
                <button
                  on:click={() => { selectedPeriod = opt.value; periodDropdownOpen = false; loadVisits(); }}
                  class={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${selectedPeriod === opt.value ? "bg-slate-100 font-medium" : "text-gray-700"}`}
                >{opt.label}</button>
              {/each}
            </div>
          {/if}
        </div>
        <div class="relative">
          <button
            on:click={() => typeDropdownOpen = !typeDropdownOpen}
            class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 flex items-center justify-between"
          >
            <span>{visitorTypeOptions.find(o => o.value === selectedVisitorType)?.label}</span>
            <svg class={`h-4 w-4 text-gray-400 transition-transform ${typeDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          {#if typeDropdownOpen}
            <div class="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
              {#each visitorTypeOptions as opt}
                <button
                  on:click={() => { selectedVisitorType = opt.value; typeDropdownOpen = false; }}
                  class={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${selectedVisitorType === opt.value ? "bg-slate-100 font-medium" : "text-gray-700"}`}
                >{opt.label}</button>
              {/each}
            </div>
          {/if}
        </div>
        <input
          type="date"
          bind:value={selectedDate}
          on:change={loadVisits}
          class="px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 w-full"
        />
        <button on:click={resetFilters} class="w-full px-3 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">
          Reset Filters
        </button>
      </div>
    {/if}
  </div>

  <!-- ===================== DESKTOP TABLE ===================== -->
  <div class="hidden lg:block mb-2">
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

      <!-- Table top bar -->
      <div class="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-gray-50/60">
        <p class="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          {filteredVisits.length} visit{filteredVisits.length !== 1 ? "s" : ""}
        </p>
        <div class="flex items-center gap-1.5">
          <span class="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span class="text-xs text-gray-400 font-medium">Live</span>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full">
          <thead>
            <tr class="border-b border-gray-100">
              <th class="pl-6 pr-3 py-3.5 text-left">
                <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Visitor</span>
              </th>
              <th class="px-3 py-3.5 text-left">
                <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Type & ID</span>
              </th>
              <th class="px-3 py-3.5 text-left">
                <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Purpose</span>
              </th>
              <th class="px-4 py-3.5 text-left">
                <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Timeline</span>
              </th>
              <th class="px-3 py-3.5 text-left">
                <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Duration</span>
              </th>
              <th class="pl-3 pr-6 py-3.5 text-left">
                <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Status</span>
              </th>
            </tr>
          </thead>

          <tbody class="divide-y divide-gray-50">
            {#each filteredVisits as visit}
              <tr class="group hover:bg-slate-50/70 transition-colors duration-150">

                <!-- Visitor -->
                <td class="pl-6 pr-3 py-4 whitespace-nowrap">
                  <div class="flex items-center gap-3">
                    <div class="flex-shrink-0 h-9 w-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow-sm">
                      <span class="text-xs font-bold text-white">{getInitial(visit)}</span>
                    </div>
                    <div>
                      <p class="text-sm font-semibold text-gray-900">{getVisitorName(visit)}</p>
                    </div>
                  </div>
                </td>

                <!-- Type & ID -->
                <td class="px-3 py-4 whitespace-nowrap">
                  <div class="flex flex-col gap-1.5">
                    <span class={`inline-flex w-fit items-center px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wide border ${getTypeColor(visit.visitorType)}`}>
                      {visit.visitorType || "—"}
                    </span>
                    <span class="text-[11px] text-gray-400 font-mono">{visit.idNumber || "—"}</span>
                  </div>
                </td>

                <!-- Purpose -->
                <td class="px-3 py-4 max-w-[200px]">
                  <p class="text-sm text-gray-700 truncate" title={visit.purpose}>{visit.purpose || "—"}</p>
                </td>

                <!-- Timeline -->
                <td class="px-4 py-4 min-w-[200px]">
                  <div class="space-y-1.5">
                    <div class="flex items-center gap-2">
                      <div class="h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0"></div>
                      <div class="flex items-baseline gap-1.5">
                        <span class="text-[11px] font-medium text-gray-400 uppercase tracking-wide">In</span>
                        <span class="text-xs text-gray-700 font-medium">{formatDateOnly(visit.timeIn)}</span>
                        <span class="text-[11px] text-gray-400">{formatTimeOnly(visit.timeIn)}</span>
                      </div>
                    </div>
                    {#if visit.timeOut}
                      <div class="flex items-center gap-2">
                        <div class="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0"></div>
                        <div class="flex items-baseline gap-1.5">
                          <span class="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Out</span>
                          <span class="text-xs text-emerald-600 font-semibold">{formatDateOnly(visit.timeOut)}</span>
                          <span class="text-[11px] text-gray-400">{formatTimeOnly(visit.timeOut)}</span>
                        </div>
                      </div>
                    {:else}
                      <div class="flex items-center gap-2">
                        <div class="h-1.5 w-1.5 rounded-full bg-gray-200 flex-shrink-0"></div>
                        <span class="text-[11px] text-gray-300 italic">Still inside</span>
                      </div>
                    {/if}
                  </div>
                </td>

                <!-- Duration -->
                <td class="px-3 py-4 whitespace-nowrap">
                  <span class="text-sm text-gray-700 font-medium tabular-nums">{visit.duration}</span>
                </td>

                <!-- Status -->
                <td class="pl-3 pr-6 py-4 whitespace-nowrap">
                  <div class="flex items-center gap-1.5">
                    <span class={`h-2 w-2 rounded-full flex-shrink-0 ${getStatusDot(visit.status)} ${visit.status === "checked_in" ? "animate-pulse" : ""}`}></span>
                    <span class={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold border ${getStatusColor(visit.status)}`}>
                      {visit.status === "checked_in" ? "Checked In" : "Checked Out"}
                    </span>
                  </div>
                </td>

              </tr>
            {/each}

            <!-- Empty state -->
            {#if filteredVisits.length === 0}
              <tr>
                <td colspan="6" class="px-6 py-16 text-center">
                  <div class="flex flex-col items-center gap-3">
                    <div class="h-14 w-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                      <svg class="h-7 w-7 text-gray-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>
                      </svg>
                    </div>
                    <div>
                      <p class="text-sm font-semibold text-gray-500">{loading ? "Loading visits…" : "No visits found"}</p>
                      <p class="text-xs text-gray-400 mt-0.5">Try adjusting your filters or search term</p>
                    </div>
                  </div>
                </td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>

      <!-- Table footer -->
      {#if filteredVisits.length > 0}
        <div class="px-6 py-3 border-t border-gray-100 bg-gray-50/40 flex items-center justify-between">
          <p class="text-xs text-gray-400">
            Showing <span class="font-semibold text-gray-600">{filteredVisits.length}</span> of
            <span class="font-semibold text-gray-600">{visits.length}</span> visits
          </p>
        </div>
      {/if}
    </div>
  </div>
  <!-- ===================== END DESKTOP TABLE ===================== -->

  <!-- Mobile Card View -->
  <div class="lg:hidden space-y-2 mb-2">
    {#each filteredVisits as visit}
      <div class="bg-white p-3 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200 text-sm">

        <!-- Header -->
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <div class="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow-sm">
              <span class="text-sm font-bold text-white">{getInitial(visit)}</span>
            </div>
            <div class="min-w-0">
              <h3 class="text-base font-semibold text-gray-900 truncate">{getVisitorName(visit)}</h3>
              <div class="flex items-center gap-2 mt-1">
                <span class={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getTypeColor(visit.visitorType)}`}>
                  {visit.visitorType || "—"}
                </span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <span class={`h-2 w-2 rounded-full ${getStatusDot(visit.status)} ${visit.status === "checked_in" ? "animate-pulse" : ""}`}></span>
            <span class={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(visit.status)}`}>
              {visit.status === "checked_in" ? "In" : "Out"}
            </span>
          </div>
        </div>

        <!-- Info rows -->
        <div class="space-y-2 pb-3 border-b border-gray-100">
          <div class="flex items-center gap-2 text-xs">
            <svg class="h-3.5 w-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
            </svg>
            <span class="font-medium text-gray-500">ID:</span>
            <span class="font-mono text-gray-700">{visit.idNumber || "—"}</span>
          </div>
          {#if visit.purpose}
            <div class="flex items-start gap-2 text-xs">
              <svg class="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <span class="font-medium text-gray-500">Purpose:</span>
              <span class="text-gray-700">{visit.purpose}</span>
            </div>
          {/if}
        </div>

        <!-- Timeline -->
        <div class="flex items-center gap-4 pt-3 text-xs">
          <div>
            <p class="text-gray-400 font-medium uppercase tracking-wide text-[10px] mb-0.5">Time In</p>
            <p class="text-gray-800 font-medium">{formatDateTime(visit.timeIn)}</p>
          </div>
          {#if visit.timeOut}
            <svg class="h-4 w-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
            </svg>
            <div>
              <p class="text-gray-400 font-medium uppercase tracking-wide text-[10px] mb-0.5">Time Out</p>
              <p class="text-emerald-600 font-semibold">{formatDateTime(visit.timeOut)}</p>
            </div>
          {:else}
            <div class="flex items-center gap-1.5">
              <span class="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse"></span>
              <span class="text-blue-500 italic text-[11px]">Currently inside</span>
            </div>
          {/if}
          {#if visit.duration && visit.duration !== "—"}
            <div class="ml-auto">
              <p class="text-gray-400 font-medium uppercase tracking-wide text-[10px] mb-0.5">Duration</p>
              <p class="text-gray-700 font-semibold tabular-nums">{visit.duration}</p>
            </div>
          {/if}
        </div>
      </div>
    {/each}

    {#if filteredVisits.length === 0 && !loading}
      <div class="bg-white p-10 rounded-xl shadow-sm border border-gray-200 text-center">
        <div class="h-14 w-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
          <svg class="h-7 w-7 text-gray-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>
          </svg>
        </div>
        <p class="text-sm font-semibold text-gray-500">No visit logs found</p>
        <p class="text-xs text-gray-400 mt-1">Try adjusting your filters or search term</p>
      </div>
    {/if}
  </div>

</div>