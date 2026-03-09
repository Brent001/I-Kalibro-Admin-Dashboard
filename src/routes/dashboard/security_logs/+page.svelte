<script lang="ts">
  import { onMount } from "svelte";
  import { page } from '$app/stores';

  // ── Lucide icons — individual file imports (works across all lucide-svelte versions) ──
  import RefreshCw      from 'lucide-svelte/icons/refresh-cw';
  import Search         from 'lucide-svelte/icons/search';
  import ShieldCheck    from 'lucide-svelte/icons/shield-check';
  import LogIn          from 'lucide-svelte/icons/log-in';
  import LogOut         from 'lucide-svelte/icons/log-out';
  import TriangleAlert  from 'lucide-svelte/icons/triangle-alert';
  import Users          from 'lucide-svelte/icons/users';
  import User           from 'lucide-svelte/icons/user';
  import ChevronDown    from 'lucide-svelte/icons/chevron-down';
  import ChevronLeft    from 'lucide-svelte/icons/chevron-left';
  import ChevronRight   from 'lucide-svelte/icons/chevron-right';
  import X              from 'lucide-svelte/icons/x';
  import Eye            from 'lucide-svelte/icons/eye';
  import Filter         from 'lucide-svelte/icons/filter';
  import CalendarDays   from 'lucide-svelte/icons/calendar-days';
  import Monitor        from 'lucide-svelte/icons/monitor';
  import Globe          from 'lucide-svelte/icons/globe';
  import Clock          from 'lucide-svelte/icons/clock';
  import CircleCheckBig from 'lucide-svelte/icons/circle-check-big';
  import CircleX        from 'lucide-svelte/icons/circle-x';
  import KeyRound       from 'lucide-svelte/icons/key-round';
  import SlidersHorizontal from 'lucide-svelte/icons/sliders-horizontal';

  let searchTerm = "";
  let selectedEventType = "all";
  let selectedUserType = "all";
  let dateFilter = "";
  let logs: any[] = [];
  let loading = false;
  let errorMsg = "";
  let selectedLog: any = null;
  let isDetailModalOpen = false;

  let eventDropdownOpen   = false;
  let userTypeDropdownOpen = false;

  export let data: { user?: { uniqueId?: string; userType?: string } };

  const eventTypeOptions = [
    { value: 'all',             label: 'All Events',      icon: Filter       },
    { value: 'login',           label: 'Login',           icon: LogIn        },
    { value: 'logout',          label: 'Logout',          icon: LogOut       },
    { value: 'failed_login',    label: 'Failed Login',    icon: CircleX      },
    { value: 'password_change', label: 'Password Change', icon: KeyRound     },
  ];

  const userTypeOptions = [
    { value: 'all',         label: 'All Users'   },
    { value: 'super_admin', label: 'Super Admin' },
    { value: 'admin',       label: 'Admin'       },
    { value: 'staff',       label: 'Staff'       },
    { value: 'user',        label: 'User'        },
  ];

  async function fetchLogs() {
    loading = true;
    errorMsg = "";
    try {
      const params = new URLSearchParams();
      const urlUid = $page.url.searchParams.get('uid') || data?.user?.uniqueId;
      if (urlUid) params.append('uid', urlUid);
      const res = await fetch(`/api/security-logs?${params.toString()}`);
      const data_res = await res.json();
      logs = data_res.data.logs || [];
    } catch {
      errorMsg = "Failed to load security logs.";
    } finally {
      loading = false;
    }
  }

  onMount(fetchLogs);

  function handleOutsideClick(e: MouseEvent) {
    const t = e.target as HTMLElement;
    if (!t.closest('.event-dropdown'))    eventDropdownOpen    = false;
    if (!t.closest('.usertype-dropdown')) userTypeDropdownOpen = false;
  }

  $: filteredLogs = logs.filter(log => {
    const s = searchTerm.toLowerCase();
    const matchSearch =
      log.ipAddress?.toLowerCase().includes(s) ||
      log.browser?.toLowerCase().includes(s) ||
      log.userName?.toLowerCase().includes(s) ||
      log.userEmail?.toLowerCase().includes(s) ||
      log.userUsername?.toLowerCase().includes(s);
    const matchEvent    = selectedEventType === 'all' || log.eventType === selectedEventType;
    const matchUserType = selectedUserType  === 'all' || log.userType  === selectedUserType;
    const matchDate     = !dateFilter ||
      new Date(log.createdAt).toISOString().split('T')[0] === dateFilter;
    return matchSearch && matchEvent && matchUserType && matchDate;
  });

  function getEventBadge(eventType: string) {
    switch (eventType) {
      case 'login':           return { cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', label: 'Login' };
      case 'logout':          return { cls: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',             label: 'Logout' };
      case 'failed_login':    return { cls: 'bg-red-50 text-red-700 ring-1 ring-red-200',             label: 'Failed Login' };
      case 'password_change': return { cls: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',   label: 'Password Change' };
      default:                return { cls: 'bg-slate-50 text-slate-600 ring-1 ring-slate-200',       label: eventType };
    }
  }

  function getRoleBadge(role: string) {
    switch (role?.toLowerCase()) {
      case 'super_admin': return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200';
      case 'admin':       return 'bg-violet-50 text-violet-700 ring-1 ring-violet-200';
      case 'staff':       return 'bg-sky-50 text-sky-700 ring-1 ring-sky-200';
      default:            return 'bg-slate-50 text-slate-600 ring-1 ring-slate-200';
    }
  }

  function titleCase(str: string) {
    return str?.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? 'N/A';
  }

  function formatDateTime(d: string) {
    return new Date(d).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  function formatDateTimeMobile(d: string) {
    return new Date(d).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  function openDetail(log: any) { selectedLog = log; isDetailModalOpen = true; }
  function closeDetail()        { selectedLog = null; isDetailModalOpen = false; }

  $: totalLogs     = logs.length;
  $: loginAttempts = logs.filter((l:any) => l.eventType === 'login' || l.eventType === 'failed_login').length;
  $: failedLogins  = logs.filter((l:any) => l.eventType === 'failed_login').length;
  $: uniqueUsers   = new Set(logs.map((l:any) => l.accountId || l.userId)).size;

  $: hasFilters = searchTerm.trim() !== '' || selectedEventType !== 'all' || selectedUserType !== 'all' || dateFilter !== '';

  function clearFilters() {
    searchTerm = ''; selectedEventType = 'all'; selectedUserType = 'all'; dateFilter = '';
  }

  $: selectedEventLabel = eventTypeOptions.find(o => o.value === selectedEventType)?.label ?? 'All Events';
  $: selectedEventIcon  = eventTypeOptions.find(o => o.value === selectedEventType)?.icon  ?? Filter;
  $: selectedUserLabel  = userTypeOptions.find(o => o.value === selectedUserType)?.label   ?? 'All Users';
</script>

<svelte:window on:click={handleOutsideClick} />

<svelte:head>
  <title>Security Logs | E-Kalibro Admin Portal</title>
</svelte:head>

<div class="space-y-5">

  <!-- ── Header ── -->
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <h2 class="text-2xl font-bold text-slate-900 tracking-tight">Security Logs</h2>
      <p class="text-sm text-slate-500 mt-0.5">Monitor authentication and security events</p>
    </div>
    <button
      on:click={fetchLogs}
      class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 active:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-150 shadow-sm"
    >
      <RefreshCw size={15} class={loading ? 'animate-spin' : ''} />
      Refresh Logs
    </button>
  </div>

  <!-- ── Error ── -->
  {#if errorMsg}
    <div class="flex items-center justify-between gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
      <div class="flex items-center gap-2"><TriangleAlert size={16} />{errorMsg}</div>
      <button on:click={() => errorMsg = ""} class="text-red-400 hover:text-red-600"><X size={16}/></button>
    </div>
  {/if}

  <!-- ── Stats ── -->
  {#if loading && logs.length === 0}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {#each Array(4) as _}
        <div class="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
          <div class="flex flex-col items-center gap-2.5">
            <div class="h-11 w-11 rounded-xl bg-slate-200"></div>
            <div class="h-6 w-12 rounded bg-slate-200"></div>
            <div class="h-3 w-20 rounded bg-slate-200"></div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {#each [
        { label:'Total Events',   value:totalLogs,     icon:ShieldCheck,   grad:'from-slate-500 to-slate-700' },
        { label:'Login Attempts', value:loginAttempts, icon:LogIn,         grad:'from-green-500 to-green-700' },
        { label:'Failed Logins',  value:failedLogins,  icon:TriangleAlert, grad:'from-red-500 to-red-700'    },
        { label:'Unique Users',   value:uniqueUsers,   icon:Users,         grad:'from-green-400 to-green-600' },
      ] as card}
        <div class="group bg-white rounded-xl border border-slate-200 p-3 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <div class="flex flex-col items-center text-center gap-1">
            <div class="p-2.5 rounded-xl bg-gradient-to-br {card.grad} shadow-sm mb-1">
              <svelte:component this={card.icon} size={20} class="text-white" />
            </div>
            <span class="text-xs font-medium text-slate-500 uppercase tracking-wide">{card.label}</span>
            <span class="text-xl font-bold text-slate-900">{card.value}</span>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- ── Active Filter Chips ── -->
  {#if hasFilters}
    <div class="flex items-center gap-3 flex-wrap px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
      <div class="flex items-center gap-1.5 text-green-700 text-sm font-semibold shrink-0">
        <SlidersHorizontal size={14} /> Active Filters
      </div>
      <div class="flex flex-wrap gap-2">
        {#if searchTerm.trim()}
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-green-200 text-green-800 shadow-sm">
            <Search size={11} />"{searchTerm}"
            <button on:click={() => searchTerm = ''} class="ml-0.5 text-green-400 hover:text-green-700" aria-label="Remove search filter"><X size={10}/></button>
          </span>
        {/if}
        {#if selectedEventType !== 'all'}
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-green-200 text-green-800 shadow-sm">
            {selectedEventLabel}
            <button on:click={() => selectedEventType = 'all'} class="ml-0.5 text-green-400 hover:text-green-700" aria-label="Remove event filter"><X size={10}/></button>
          </span>
        {/if}
        {#if selectedUserType !== 'all'}
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-green-200 text-green-800 shadow-sm">
            {selectedUserLabel}
            <button on:click={() => selectedUserType = 'all'} class="ml-0.5 text-green-400 hover:text-green-700" aria-label="Remove user type filter"><X size={10}/></button>
          </span>
        {/if}
        {#if dateFilter}
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-green-200 text-green-800 shadow-sm">
            <CalendarDays size={11}/>{dateFilter}
            <button on:click={() => dateFilter = ''} class="ml-0.5 text-green-400 hover:text-green-700" aria-label="Remove date filter"><X size={10}/></button>
          </span>
        {/if}
      </div>
      <button on:click={clearFilters} class="ml-auto text-xs font-medium text-green-700 hover:text-green-900 underline underline-offset-2 shrink-0">
        Clear all
      </button>
    </div>
  {/if}

  <!-- ── Filter Bar ── -->
  <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
    <div class="flex flex-col lg:flex-row gap-3">

      <!-- Search -->
      <div class="flex-1 relative">
        <Search size={15} class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search IP, browser, name, email…"
          bind:value={searchTerm}
          class="w-full pl-10 pr-4 py-2.5 text-sm border rounded-lg bg-white outline-none transition-all duration-150
                 {searchTerm ? 'border-green-400 ring-2 ring-green-100 bg-green-50/50' : 'border-slate-300 hover:border-slate-400 focus:border-green-400 focus:ring-2 focus:ring-green-100'}"
        />
      </div>

      <div class="flex flex-col sm:flex-row gap-3">

        <!-- ── Event Type Dropdown ── -->
        <div class="relative event-dropdown">
          <button
            type="button"
            on:click|stopPropagation={() => { eventDropdownOpen = !eventDropdownOpen; userTypeDropdownOpen = false; }}
            aria-haspopup="listbox"
            aria-expanded={eventDropdownOpen}
            class="flex items-center justify-between gap-2 w-full sm:w-48 px-3.5 py-2.5 text-sm font-medium rounded-lg border outline-none transition-all duration-150
                   {selectedEventType !== 'all'
                     ? 'border-green-400 bg-green-50 text-green-800 ring-2 ring-green-100'
                     : 'border-slate-300 text-slate-700 bg-white hover:border-slate-400 focus:border-green-400 focus:ring-2 focus:ring-green-100'}"
          >
            <span class="flex items-center gap-2 truncate">
              <svelte:component this={selectedEventIcon} size={14} class="flex-shrink-0 {selectedEventType !== 'all' ? 'text-green-600' : 'text-slate-400'}" />
              <span class="truncate">{selectedEventLabel}</span>
            </span>
            <ChevronDown size={14} class="flex-shrink-0 transition-transform duration-200 {eventDropdownOpen ? 'rotate-180' : ''}" />
          </button>

          {#if eventDropdownOpen}
            <ul
              role="listbox"
              aria-label="Event type"
              class="absolute z-30 top-[calc(100%+6px)] left-0 w-52 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden py-1.5"
            >
              {#each eventTypeOptions as opt}
                <li role="option" aria-selected={selectedEventType === opt.value}>
                  <button
                    type="button"
                    on:click={() => { selectedEventType = opt.value; eventDropdownOpen = false; }}
                    class="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors duration-100
                           {selectedEventType === opt.value ? 'bg-green-50 text-green-800 font-semibold' : 'text-slate-700 hover:bg-slate-50'}"
                  >
                    <svelte:component this={opt.icon} size={14} class="flex-shrink-0 {selectedEventType === opt.value ? 'text-green-600' : 'text-slate-400'}" />
                    {opt.label}
                    {#if selectedEventType === opt.value}
                      <CircleCheckBig size={14} class="ml-auto text-green-600 flex-shrink-0" />
                    {/if}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>

        <!-- ── User Type Dropdown (super_admin only) ── -->
        {#if data?.user?.userType === 'super_admin'}
          <div class="relative usertype-dropdown">
            <button
              type="button"
              on:click|stopPropagation={() => { userTypeDropdownOpen = !userTypeDropdownOpen; eventDropdownOpen = false; }}
              aria-haspopup="listbox"
              aria-expanded={userTypeDropdownOpen}
              class="flex items-center justify-between gap-2 w-full sm:w-44 px-3.5 py-2.5 text-sm font-medium rounded-lg border outline-none transition-all duration-150
                     {selectedUserType !== 'all'
                       ? 'border-green-400 bg-green-50 text-green-800 ring-2 ring-green-100'
                       : 'border-slate-300 text-slate-700 bg-white hover:border-slate-400 focus:border-green-400 focus:ring-2 focus:ring-green-100'}"
            >
              <span class="flex items-center gap-2 truncate">
                <User size={14} class="flex-shrink-0 {selectedUserType !== 'all' ? 'text-green-600' : 'text-slate-400'}" />
                <span class="truncate">{selectedUserLabel}</span>
              </span>
              <ChevronDown size={14} class="flex-shrink-0 transition-transform duration-200 {userTypeDropdownOpen ? 'rotate-180' : ''}" />
            </button>

            {#if userTypeDropdownOpen}
              <ul
                role="listbox"
                aria-label="User type"
                class="absolute z-30 top-[calc(100%+6px)] left-0 w-44 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden py-1.5"
              >
                {#each userTypeOptions as opt}
                  <li role="option" aria-selected={selectedUserType === opt.value}>
                    <button
                      type="button"
                      on:click={() => { selectedUserType = opt.value; userTypeDropdownOpen = false; }}
                      class="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors duration-100
                             {selectedUserType === opt.value ? 'bg-green-50 text-green-800 font-semibold' : 'text-slate-700 hover:bg-slate-50'}"
                    >
                      {opt.label}
                      {#if selectedUserType === opt.value}
                        <CircleCheckBig size={14} class="ml-auto text-green-600 flex-shrink-0" />
                      {/if}
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        {/if}

        <!-- ── Date Picker ── -->
        <div class="relative">
          <CalendarDays size={15} class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
          <input
            type="date"
            bind:value={dateFilter}
            class="pl-10 pr-3 py-2.5 text-sm border rounded-lg outline-none w-full sm:w-auto transition-all duration-150
                   {dateFilter
                     ? 'border-green-400 ring-2 ring-green-100 bg-green-50/50 text-green-800'
                     : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 focus:border-green-400 focus:ring-2 focus:ring-green-100'}"
          />
        </div>

      </div>
    </div>
  </div>

  <!-- ── Skeleton Loading ── -->
  {#if loading && logs.length === 0}
    <div class="hidden lg:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="grid grid-cols-[1.4fr_1.8fr_0.9fr_1.2fr_1fr_1.8fr_0.7fr] px-5 py-3.5 border-b border-slate-200 bg-slate-50/80">
        {#each ['Event Time','User','Role','Event','IP Address','Browser',''] as h}
          <div class="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{h}</div>
        {/each}
      </div>
      {#each Array(7) as _, i}
        <div class="grid grid-cols-[1.4fr_1.8fr_0.9fr_1.2fr_1fr_1.8fr_0.7fr] px-5 py-4 border-b border-slate-100 last:border-0 animate-pulse {i%2!==0?'bg-slate-50/40':''}">
          <div class="h-3.5 bg-slate-200 rounded w-28"></div>
          <div class="space-y-1.5"><div class="h-3.5 bg-slate-200 rounded w-24"></div><div class="h-3 bg-slate-200 rounded w-32"></div></div>
          <div class="h-5 bg-slate-200 rounded-full w-14"></div>
          <div class="h-5 bg-slate-200 rounded-full w-20"></div>
          <div class="h-3.5 bg-slate-200 rounded w-24"></div>
          <div class="h-3.5 bg-slate-200 rounded w-40"></div>
          <div class="h-4 bg-slate-200 rounded w-12"></div>
        </div>
      {/each}
    </div>
    <div class="lg:hidden space-y-3">
      {#each Array(4) as _}
        <div class="bg-white rounded-xl border border-slate-200 p-4 animate-pulse space-y-3">
          <div class="flex justify-between"><div class="h-4 bg-slate-200 rounded w-32"></div><div class="h-7 w-7 bg-slate-200 rounded-lg"></div></div>
          <div class="flex gap-2"><div class="h-5 bg-slate-200 rounded-full w-20"></div><div class="h-5 bg-slate-200 rounded-full w-14"></div></div>
          <div class="space-y-1.5"><div class="h-3 bg-slate-200 rounded w-full"></div><div class="h-3 bg-slate-200 rounded w-3/4"></div></div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- ── Desktop Custom Table ── -->
  {#if !loading || logs.length > 0}
    <div class="hidden lg:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

      <!-- Column headers -->
      <div class="grid grid-cols-[1.4fr_1.8fr_0.9fr_1.2fr_1fr_1.8fr_0.7fr] px-5 py-3.5 border-b border-slate-200 bg-slate-50/80">
        {#each [
          { label:'Event Time', icon:Clock   },
          { label:'User',       icon:User    },
          { label:'Role',       icon:null    },
          { label:'Event',      icon:null    },
          { label:'IP Address', icon:Globe   },
          { label:'Browser',    icon:Monitor },
          { label:'',           icon:null    },
        ] as col}
          <div class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400 select-none">
            {#if col.icon}<svelte:component this={col.icon} size={11} />{/if}
            {col.label}
          </div>
        {/each}
      </div>

      <!-- Rows -->
      {#each filteredLogs as log, i}
        {@const badge = getEventBadge(log.eventType)}
        <div class="grid grid-cols-[1.4fr_1.8fr_0.9fr_1.2fr_1fr_1.8fr_0.7fr] px-5 py-3.5 items-center border-b border-slate-100 last:border-0 transition-colors duration-150 hover:bg-green-50/50 {i%2!==0?'bg-slate-50/40':''}">

          <div class="text-xs text-slate-600 tabular-nums leading-snug">{formatDateTime(log.eventTime)}</div>

          <div class="min-w-0">
            <div class="text-sm font-semibold text-slate-800 truncate">{log.userName || '—'}</div>
            <div class="text-xs text-slate-400 mt-0.5 truncate">{log.userEmail || 'N/A'}</div>
          </div>

          <div>
            <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold {getRoleBadge(log.role)}">
              {titleCase(log.role) || 'N/A'}
            </span>
          </div>

          <div>
            <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold {badge.cls}">
              {badge.label}
            </span>
          </div>

          <div class="text-xs text-slate-600 font-mono">{log.ipAddress || '—'}</div>

          <div class="text-xs text-slate-500 truncate pr-2" title={log.browser}>{log.browser || '—'}</div>

          <div>
            <button
              type="button"
              on:click={() => openDetail(log)}
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-green-700 hover:bg-green-100 hover:text-green-900 active:bg-green-200 transition-all duration-150 border border-transparent hover:border-green-200"
            >
              <Eye size={13} /> View
            </button>
          </div>
        </div>
      {/each}

      {#if filteredLogs.length === 0 && !loading}
        <div class="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <ShieldCheck size={36} class="opacity-30" />
          <p class="text-sm font-medium">No logs match your current filters</p>
        </div>
      {/if}
    </div>
  {/if}

  <!-- ── Mobile Cards ── -->
  {#if !loading || logs.length > 0}
    <div class="lg:hidden space-y-3">
      {#each filteredLogs as log}
        {@const badge = getEventBadge(log.eventType)}
        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div class="flex items-start justify-between gap-2 mb-3">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-slate-900 truncate">{log.userName || 'Unknown'}</p>
              <div class="flex flex-wrap gap-1.5 mt-1.5">
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold {badge.cls}">{badge.label}</span>
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold {getRoleBadge(log.role)}">{titleCase(log.role)}</span>
              </div>
            </div>
            <button
              type="button"
              on:click={() => openDetail(log)}
              aria-label="View details"
              class="flex-shrink-0 p-2 rounded-lg text-green-600 hover:bg-green-100 hover:text-green-800 transition-all duration-150 border border-transparent hover:border-green-200"
            >
              <Eye size={16} />
            </button>
          </div>

          <div class="space-y-1.5 text-xs text-slate-500">
            <div class="flex items-center gap-2"><Globe size={12} class="flex-shrink-0 text-slate-400" /><span class="font-mono">{log.ipAddress || '—'}</span></div>
            <div class="flex items-center gap-2"><Monitor size={12} class="flex-shrink-0 text-slate-400" /><span class="truncate">{log.browser || '—'}</span></div>
            <div class="flex items-center gap-2"><Clock size={12} class="flex-shrink-0 text-slate-400" /><span>{formatDateTimeMobile(log.eventTime)}</span></div>
          </div>
        </div>
      {/each}

      {#if filteredLogs.length === 0 && !loading}
        <div class="bg-white rounded-xl border border-slate-200 py-14 flex flex-col items-center gap-3 text-slate-400">
          <ShieldCheck size={32} class="opacity-30" />
          <p class="text-sm font-medium">No logs match your filters</p>
        </div>
      {/if}
    </div>
  {/if}

  <!-- ── Pagination ── -->
  <div class="bg-white rounded-xl border border-green-200 px-5 py-3.5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
    <p class="text-sm text-slate-500 order-2 sm:order-1">
      Showing <span class="font-semibold text-slate-700">{filteredLogs.length}</span> of
      <span class="font-semibold text-slate-700">{filteredLogs.length}</span> results
    </p>
    <nav class="flex items-center gap-1 order-1 sm:order-2">
      <button type="button" disabled
        class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 border border-slate-200 bg-white hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150">
        <ChevronLeft size={14} /><span class="hidden sm:inline">Previous</span>
      </button>
      <button type="button" disabled
        class="inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-semibold bg-green-600 text-white border border-green-600 shadow-sm">
        1
      </button>
      <button type="button" disabled
        class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 border border-slate-200 bg-white hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150">
        <span class="hidden sm:inline">Next</span><ChevronRight size={14} />
      </button>
    </nav>
  </div>

</div>

<!-- ── Detail Modal ── -->
{#if isDetailModalOpen && selectedLog}
  {@const badge = getEventBadge(selectedLog.eventType)}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">

      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
        <div class="flex items-center gap-2.5">
          <div class="p-1.5 rounded-lg bg-green-100"><ShieldCheck size={16} class="text-green-700" /></div>
          <h3 class="text-base font-bold text-slate-900">Security Log Details</h3>
        </div>
        <button type="button" on:click={closeDetail} aria-label="Close" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all duration-150">
          <X size={18} />
        </button>
      </div>

      <div class="overflow-y-auto px-6 py-5 space-y-5 flex-1">
        <!-- Badges -->
        <div class="flex flex-wrap gap-2">
          <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold {badge.cls}">{badge.label}</span>
          <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold {getRoleBadge(selectedLog.role)}">{titleCase(selectedLog.role)}</span>
        </div>

        <!-- Detail grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {#each [
            { label:'User Name',  value: selectedLog.userName  || '—', icon: User,    mono: false },
            { label:'Email',      value: selectedLog.userEmail || '—', icon: null,    mono: false },
            { label:'Event Time', value: formatDateTime(selectedLog.eventTime), icon: Clock, mono: false },
            { label:'Created At', value: formatDateTime(selectedLog.createdAt), icon: Clock, mono: false },
            { label:'IP Address', value: selectedLog.ipAddress || '—', icon: Globe,   mono: true  },
            { label:'Account ID', value: selectedLog.accountId || '—', icon: null,    mono: true  },
            { label:'User ID',    value: selectedLog.userId    || '—', icon: null,    mono: true  },
            { label:'Log ID',     value: `#${selectedLog.id}`,         icon: null,    mono: true  },
          ] as f}
            <div class="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
              <div class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">
                {#if f.icon}<svelte:component this={f.icon} size={11} />{/if}
                {f.label}
              </div>
              <p class="text-sm text-slate-800 {f.mono ? 'font-mono' : 'font-medium'} break-all leading-snug">{f.value}</p>
            </div>
          {/each}
        </div>

        <!-- Browser -->
        <div class="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
          <div class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">
            <Monitor size={11} /> Browser
          </div>
          <p class="text-sm text-slate-700 break-words leading-relaxed">{selectedLog.browser || '—'}</p>
        </div>
      </div>

      <div class="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex justify-end">
        <button
          type="button"
          on:click={closeDetail}
          class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 active:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-150 shadow-sm"
        >
          <X size={14} /> Close
        </button>
      </div>

    </div>
  </div>
{/if}