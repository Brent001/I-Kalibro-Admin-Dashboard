<script lang="ts">
  import { onMount } from "svelte";

  let activeTab = $state('general');
  let isSaving = $state(false);
  let saveSuccess = $state(false);

  let storageInfo = $state<{
    used: number;
    total: number;
    usedFormatted: string;
    totalFormatted: string;
    percentage: number;
  } | null>(null);

  let apiStatus = $state<'healthy' | 'degraded' | 'unhealthy' | 'checking'>('checking');

  type PermKey = 'canManageBooks'|'canManageUsers'|'canManageBorrowing'|'canManageReservations'|'canViewReports'|'canManageFines';

  let settings = $state({
    libraryName: 'Metro Dagupan Colleges Library',
    libraryCode: 'MDC-LIB',
    address: 'Dagupan City, Pangasinan',
    phone: '+63 75 522 4567',
    email: 'library@mdc.edu.ph',
    website: 'https://mdc.edu.ph/library',

    visitScanMethod: 'qrcode' as 'qrcode' | 'barcode' | 'both',

    defaultLoanPeriodStudent: 7,
    defaultLoanPeriodFaculty: 14,
    maxBooksPerStudent: 3,
    maxBooksPerFaculty: 5,
    maxMagazinesPerUser: 2,
    maxThesesPerUser: 1,
    maxJournalsPerUser: 2,
    maxRenewals: 1,
    reservationExpiryDays: 3,
    reservationApprovalWindowHours: 48,

    overdueFinePerDay: 5.00,
    maxFineAmount: 500.00,
    damageFinePct: 50,
    lostFineMultiplier: 100,
    fineWaiverThreshold: 10.00,
    gracePeriodDays: 0,
    allowUserReturnRequests: true,
    returnRequestWindowDays: 30,
    autoMarkOverdueDays: 1,

    notifDueReminder: true,
    notifOverdue: true,
    notifReservationReady: true,
    notifReturnConfirmation: true,
    notifDueReminderDaysBefore: 2,
    notifChannelEmail: true,
    notifChannelSMS: false,

    sessionTimeoutMinutes: 30,
    passwordExpiryDays: 90,
    maxLoginAttempts: 3,
    twoFactorAuth: false,
    backupFrequency: 'daily',

    fineCalculation: {
      excludeSundays: true,
      excludeCampusClosedDays: false,
      closedWeekdays: [0] as number[],
      holidays: [] as { date: string; description: string; type: 'holiday' | 'closed' }[]
    }
  });

  let defaultStaffPermissions = $state<Record<PermKey, boolean>>({
    canManageBooks: false,
    canManageUsers: false,
    canManageBorrowing: true,
    canManageReservations: true,
    canViewReports: false,
    canManageFines: true
  });

  // Fine calc
  let newHoliday = $state('');
  let newHolidayDesc = $state('');
  let newHolidayType = $state<'holiday' | 'closed'>('holiday');
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  function addHoliday() {
    if (!newHoliday) return;
    if (!settings.fineCalculation.holidays.some(h => h.date === newHoliday)) {
      settings.fineCalculation.holidays = [...settings.fineCalculation.holidays,
        { date: newHoliday, description: newHolidayDesc || (newHolidayType === 'closed' ? 'One-time closure' : 'Holiday'), type: newHolidayType }
      ];
      newHoliday = ''; newHolidayDesc = ''; newHolidayType = 'holiday';
    }
  }
  function removeHoliday(idx: number) {
    settings.fineCalculation.holidays = settings.fineCalculation.holidays.filter((_, i) => i !== idx);
  }
  function toggleWeekday(day: number) {
    const cw = settings.fineCalculation.closedWeekdays;
    settings.fineCalculation.closedWeekdays = cw.includes(day) ? cw.filter(d => d !== day) : [...cw, day];
    if (day === 0) settings.fineCalculation.excludeSundays = settings.fineCalculation.closedWeekdays.includes(0);
  }

  $effect(() => {
    const cw = settings.fineCalculation.closedWeekdays;
    if (settings.fineCalculation.excludeSundays && !cw.includes(0))
      settings.fineCalculation.closedWeekdays = [...cw, 0];
    else if (!settings.fineCalculation.excludeSundays && cw.includes(0))
      settings.fineCalculation.closedWeekdays = cw.filter(d => d !== 0);
  });

  async function handleSave() {
    isSaving = true;
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch('/api/settings', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(settings), credentials:'same-origin' }).catch(() => ({ok:false})),
        fetch('/api/settings/finecal', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(settings.fineCalculation), credentials:'same-origin' }).catch(() => ({ok:false})),
        fetch('/api/settings/permissions', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(defaultStaffPermissions), credentials:'same-origin' }).catch(() => ({ok:false}))
      ]);
      if ((r1 as any).ok || (r2 as any).ok || (r3 as any).ok) { saveSuccess = true; setTimeout(() => saveSuccess = false, 3000); }
    } finally { isSaving = false; }
  }

  const tabs = [
    { id:'general',       name:'General',             icon:'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { id:'borrowing',     name:'Borrowing',            icon:'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { id:'fines',         name:'Fines & Returns',      icon:'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id:'finecalc',      name:'Fine Exemptions',      icon:'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id:'notifications', name:'Notifications',        icon:'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
    { id:'permissions',   name:'Permissions',          icon:'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
    { id:'security',      name:'Security',             icon:'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
    { id:'system',        name:'System',               icon:'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  ];

  function selectTab(id: string) {
    activeTab = id;
    try { const p = new URLSearchParams(location.search); p.set('tab', id); history.replaceState(null, '', `${location.pathname}?${p}`); } catch {}
  }

  onMount(async () => {
    try { const p = new URLSearchParams(location.search); const t = p.get('tab'); if (t) activeTab = t; } catch {}
    try {
      const res = await fetch('/api/settings/finecal', { credentials:'same-origin' });
      if (res.ok) { const d = await res.json(); if (d?.fineCalculation) settings.fineCalculation = d.fineCalculation; }
    } catch {}
  });

  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D5C29] focus:border-transparent outline-none transition-all bg-white";
  const inpSm = "px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D5C29] focus:border-transparent outline-none transition-all bg-white";

  const notifRows = [
    { key:'notifDueReminder'      , label:'Due Date Reminder',   desc:'Sent N days before dueDate — type: due_reminder' },
    { key:'notifOverdue'           , label:'Overdue Alert',        desc:'Sent when status → overdue — type: overdue' },
    { key:'notifReservationReady'  , label:'Reservation Ready',    desc:'Sent when reservation approved — type: reservation_ready' },
    { key:'notifReturnConfirmation', label:'Return Confirmation',  desc:'Sent when return processed — type: return_confirmation' },
  ];

  const channelRows = [
    { key:'notifChannelEmail', label:'Email', desc:'Send notifications to user/staff email' },
    { key:'notifChannelSMS',   label:'SMS',   desc:'Send urgent alerts via phone number' },
  ];

  const permRows: { key: PermKey; label: string; desc: string }[] = [
    { key:'canManageBooks',        label:'Manage Books & Copies',    desc:'Add, edit, deactivate tbl_book and tbl_book_copy' },
    { key:'canManageUsers',        label:'Manage Users',             desc:'Create and edit tbl_user, tbl_student, tbl_faculty' },
    { key:'canManageBorrowing',    label:'Process Borrowing',        desc:'Approve reservations, issue copies, update tbl_*_borrowing' },
    { key:'canManageReservations', label:'Manage Reservations',      desc:'Review, approve, reject tbl_*_reservation records' },
    { key:'canViewReports',        label:'View Reports & Analytics', desc:'Access dashboards and tbl_user_activity data' },
    { key:'canManageFines',        label:'Manage Fines & Payments',  desc:'Waive fines, record payments in tbl_fine and tbl_payment' },
  ];

  const borrowLimits = [
    { label:'Books (Student)', key:'maxBooksPerStudent' },
    { label:'Books (Faculty)', key:'maxBooksPerFaculty' },
    { label:'Magazines',       key:'maxMagazinesPerUser' },
    { label:'Theses',          key:'maxThesesPerUser' },
    { label:'Journals',        key:'maxJournalsPerUser' },
  ];

  onMount(async () => {
    try { const p = new URLSearchParams(location.search); const t = p.get('tab'); if (t) activeTab = t; } catch {}
    try {
      const res = await fetch('/api/settings/finecal', { credentials:'same-origin' });
      if (res.ok) { const d = await res.json(); if (d?.fineCalculation) settings.fineCalculation = d.fineCalculation; }
    } catch {}
    try {
      const res = await fetch('/api/settings/storage', { credentials:'same-origin' });
      if (res.ok) { const d = await res.json(); if (d?.storage) storageInfo = d.storage; }
    } catch {}
    try {
      const res = await fetch('/api/health', { credentials:'same-origin' });
      if (res.ok) {
        const d = await res.json();
        if (d.status === 'healthy') {
          apiStatus = 'healthy';
        } else if (d.status === 'degraded') {
          apiStatus = 'degraded';
        } else {
          apiStatus = 'unhealthy';
        }
      } else {
        apiStatus = 'unhealthy';
      }
    } catch {
      apiStatus = 'unhealthy';
    }
  });
</script>

<svelte:head>
  <title>Settings | E-Kalibro Admin Portal</title>
</svelte:head>

{#snippet toggle(checked: boolean, onchange: (v: boolean) => void)}
  <label class="relative inline-flex items-center cursor-pointer">
    <input type="checkbox" checked={checked} onchange={e => onchange((e.target as HTMLInputElement).checked)} class="sr-only peer"/>
    <div class="w-10 h-5 bg-gray-300 rounded-full peer peer-checked:bg-[#0D5C29]
      after:content-[''] after:absolute after:top-0.5 after:left-0.5
      after:bg-white after:rounded-full after:h-4 after:w-4
      after:transition-all peer-checked:after:translate-x-5"></div>
  </label>
{/snippet}

{#snippet toggleRow(label: string, desc: string, checked: boolean, onchange: (v: boolean) => void)}
  <div class="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
    <div>
      <div class="text-sm font-medium text-slate-800">{label}</div>
      <div class="text-xs text-slate-400 mt-0.5">{desc}</div>
    </div>
    {@render toggle(checked, onchange)}
  </div>
{/snippet}

<div class="min-h-screen">
  <!-- Header -->
  <div class="mb-5">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">Settings</h2>
        <p class="text-slate-500 text-sm">Manage library configuration, policies, and system preferences</p>
      </div>
      <div class="flex items-center gap-3">
        {#if saveSuccess}
          <div class="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
            Saved
          </div>
        {/if}
        <button onclick={handleSave} disabled={isSaving}
          class="px-5 py-2 bg-[#0D5C29] text-white rounded-lg font-semibold text-sm hover:bg-[#0a4820] disabled:opacity-50 transition-colors shadow-sm">
          {isSaving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  </div>

  <!-- ✅ FIX: Mobile tab strip is NOW outside the flex row so it stacks above content -->
  <div class="lg:hidden bg-white rounded-xl border border-gray-200 overflow-x-auto mb-3">
    <div class="flex px-1">
      {#each tabs as tab}
        <button onclick={() => selectTab(tab.id)}
          class="px-3 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-all flex flex-col items-center gap-1
            {activeTab === tab.id ? 'border-[#0D5C29] text-[#0D5C29]' : 'border-transparent text-gray-500'}">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d={tab.icon}/>
          </svg>
          {tab.name}
        </button>
      {/each}
    </div>
  </div>

  <!-- Sidebar + Content row (desktop sidebar lives here, mobile tab strip does NOT) -->
  <div class="flex gap-5">

    <!-- Desktop Sidebar -->
    <aside class="hidden lg:flex flex-col w-52 shrink-0 gap-1">
      {#each tabs as tab}
        <button onclick={() => selectTab(tab.id)}
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-all w-full
            {activeTab === tab.id ? 'bg-[#0D5C29] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}">
          <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d={tab.icon}/>
          </svg>
          {tab.name}
        </button>
      {/each}
    </aside>

    <!-- Content Panel -->
    <div class="flex-1 min-w-0">
      <div class="bg-white rounded-xl shadow-sm border border-gray-200">

        <!-- GENERAL -->
        {#if activeTab === 'general'}
          <div class="p-6 sm:p-8 animate-in">
            <div class="mb-7">
              <h3 class="text-base font-semibold text-slate-900">Library Information</h3>
              <p class="text-xs text-slate-400 mt-1">Contact details and identifying codes stored in tbl_library_settings</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl">
              <div class="space-y-1.5">
                <label for="lName" class="block text-sm font-medium text-slate-700">Library Name</label>
                <input id="lName" type="text" bind:value={settings.libraryName} class={inp}/>
              </div>
              <div class="space-y-1.5">
                <label for="lCode" class="block text-sm font-medium text-slate-700">Library Code</label>
                <input id="lCode" type="text" bind:value={settings.libraryCode} class={inp}/>
              </div>
              <div class="md:col-span-2 space-y-1.5">
                <label for="lAddr" class="block text-sm font-medium text-slate-700">Address</label>
                <textarea id="lAddr" bind:value={settings.address} rows="2" class="{inp} resize-none"></textarea>
              </div>
              <div class="space-y-1.5">
                <label for="lPhone" class="block text-sm font-medium text-slate-700">Phone</label>
                <input id="lPhone" type="tel" bind:value={settings.phone} class={inp}/>
              </div>
              <div class="space-y-1.5">
                <label for="lEmail" class="block text-sm font-medium text-slate-700">Email</label>
                <input id="lEmail" type="email" bind:value={settings.email} class={inp}/>
              </div>
              <div class="md:col-span-2 space-y-1.5">
                <label for="lWeb" class="block text-sm font-medium text-slate-700">Website URL</label>
                <input id="lWeb" type="url" bind:value={settings.website} class={inp}/>
              </div>
            </div>

            <hr class="border-gray-100 max-w-3xl mt-8 mb-7"/>

            <div class="max-w-3xl">
              <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 class="text-base font-semibold text-slate-900">Visit Scan Method</h3>
                  <p class="text-xs text-slate-400 mt-0.5">How the visit kiosk identifies visitors — tbl_library_settings.visitScanMethod</p>
                </div>
                <div class="flex items-center bg-gray-100 rounded-lg p-1 shrink-0">
                  <button
                    type="button"
                    onclick={() => settings.visitScanMethod = 'qrcode'}
                    class="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
                      {settings.visitScanMethod === 'qrcode'
                        ? 'bg-white text-[#0D5C29] shadow-sm ring-1 ring-gray-200'
                        : 'text-slate-500 hover:text-slate-700'}">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3 3h6v6H3zm12 0h6v6h-6zM3 15h6v6H3zm2-10h2v2H5zm10 0h2v2h-2zM5 17h2v2H5zm5-14h2v2h-2zm0 4h2v2h-2zm4 4h2v2h-2zm0 4h2v2h-2zm-4 0h2v2h-2zm0 4h2v2h-2zm4-8h2v2h-2zm4 4h2v2h-2z"/>
                    </svg>
                    QR Code
                  </button>
                  <button
                    type="button"
                    onclick={() => settings.visitScanMethod = 'barcode'}
                    class="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
                      {settings.visitScanMethod === 'barcode'
                        ? 'bg-white text-[#0D5C29] shadow-sm ring-1 ring-gray-200'
                        : 'text-slate-500 hover:text-slate-700'}">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h1v12H4zm3 0h1v12H7zm2 0h2v12H9zm3 0h1v12h-1zm2 0h1v12h-1zm2 0h2v12h-2z"/>
                    </svg>
                    Barcode
                  </button>
                </div>
              </div>
              <p class="text-xs text-slate-500 mt-4 flex items-start gap-2 bg-gray-50 border border-dashed border-gray-200 rounded-lg px-4 py-3">
                <svg class="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                {#if settings.visitScanMethod === 'qrcode'}
                  The visit kiosk camera will read <span class="font-medium text-slate-700">QR codes</span> printed on student and faculty ID cards or on generated visit passes.
                {:else}
                  The visit kiosk scanner will read <span class="font-medium text-slate-700">1D barcodes</span> (Code 128 / EAN-13) on physical ID cards.
                {/if}
              </p>
            </div>
          </div>

        <!-- BORROWING -->
        {:else if activeTab === 'borrowing'}
          <div class="p-6 sm:p-8 animate-in">
            <div class="mb-7">
              <h3 class="text-base font-semibold text-slate-900">Borrowing Policies</h3>
              <p class="text-xs text-slate-400 mt-1">Controls loan periods, copy limits, and reservation windows (tbl_*_borrowing, tbl_*_reservation)</p>
            </div>
            <div class="space-y-8 max-w-3xl">

              <div>
                <h4 class="text-sm font-semibold text-slate-700 mb-4">Loan Periods</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div class="space-y-1.5">
                    <label for="lpS" class="block text-sm font-medium text-slate-700">Student Loan Period (days)</label>
                    <input id="lpS" type="number" min="1" bind:value={settings.defaultLoanPeriodStudent} class={inp}/>
                    <p class="text-xs text-slate-400">Maps to dueDate – borrowDate in tbl_*_borrowing</p>
                  </div>
                  <div class="space-y-1.5">
                    <label for="lpF" class="block text-sm font-medium text-slate-700">Faculty Loan Period (days)</label>
                    <input id="lpF" type="number" min="1" bind:value={settings.defaultLoanPeriodFaculty} class={inp}/>
                  </div>
                  <div class="space-y-1.5">
                    <label for="maxR" class="block text-sm font-medium text-slate-700">Maximum Renewals</label>
                    <input id="maxR" type="number" min="0" bind:value={settings.maxRenewals} class={inp}/>
                    <p class="text-xs text-slate-400">Applies across all item types</p>
                  </div>
                </div>
              </div>

              <hr class="border-gray-100"/>

              <div>
                <h4 class="text-sm font-semibold text-slate-700 mb-4">Borrow Limits per User</h4>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {#each borrowLimits as item}
                    <div class="space-y-1.5">
                      <label class="block text-sm font-medium text-slate-700">{item.label}</label>
                      <input type="number" min="0" bind:value={settings[item.key as keyof typeof settings] as number} class={inp}/>
                    </div>
                  {/each}
                </div>
              </div>

              <hr class="border-gray-100"/>

              <div>
                <div class="flex items-baseline gap-2 mb-4">
                  <h4 class="text-sm font-semibold text-slate-700">Reservations</h4>
                  <span class="text-xs text-slate-400">tbl_*_reservation — expiryDate and approval flow</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div class="space-y-1.5">
                    <label for="resExp" class="block text-sm font-medium text-slate-700">Reservation Expiry (days)</label>
                    <input id="resExp" type="number" min="1" bind:value={settings.reservationExpiryDays} class={inp}/>
                    <p class="text-xs text-slate-400">Sets expiryDate = requestDate + N days</p>
                  </div>
                  <div class="space-y-1.5">
                    <label for="resApproval" class="block text-sm font-medium text-slate-700">Staff Approval Window (hours)</label>
                    <input id="resApproval" type="number" min="1" bind:value={settings.reservationApprovalWindowHours} class={inp}/>
                    <p class="text-xs text-slate-400">Time staff has before reservation auto-expires</p>
                  </div>
                </div>
              </div>

            </div>
          </div>

        <!-- FINES & RETURNS -->
        {:else if activeTab === 'fines'}
          <div class="p-6 sm:p-8 animate-in">
            <div class="mb-7">
              <h3 class="text-base font-semibold text-slate-900">Fines & Return Policies</h3>
              <p class="text-xs text-slate-400 mt-1">Configure overdue fine rates, damage/loss penalties, and return request rules (tbl_fine, tbl_*_return_request)</p>
            </div>
            <div class="space-y-8 max-w-3xl">

              <div>
                <div class="flex items-baseline gap-2 mb-4">
                  <h4 class="text-sm font-semibold text-slate-700">Overdue Fines</h4>
                  <span class="text-xs text-slate-400">tbl_fine — fineAmount = daysOverdue × rate</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div class="space-y-1.5">
                    <label for="fDay" class="block text-sm font-medium text-slate-700">Fine Rate per Day (₱)</label>
                    <input id="fDay" type="number" min="0" step="0.50" bind:value={settings.overdueFinePerDay} class={inp}/>
                  </div>
                  <div class="space-y-1.5">
                    <label for="fCap" class="block text-sm font-medium text-slate-700">Maximum Fine Cap (₱)</label>
                    <input id="fCap" type="number" min="0" step="10" bind:value={settings.maxFineAmount} class={inp}/>
                    <p class="text-xs text-slate-400">Per borrowing record</p>
                  </div>
                  <div class="space-y-1.5">
                    <label for="grace" class="block text-sm font-medium text-slate-700">Grace Period (days)</label>
                    <input id="grace" type="number" min="0" bind:value={settings.gracePeriodDays} class={inp}/>
                    <p class="text-xs text-slate-400">Free days after due date before fines start</p>
                  </div>
                  <div class="space-y-1.5">
                    <label for="waiver" class="block text-sm font-medium text-slate-700">Auto-waiver Threshold (₱)</label>
                    <input id="waiver" type="number" min="0" step="0.50" bind:value={settings.fineWaiverThreshold} class={inp}/>
                    <p class="text-xs text-slate-400">Fines below this can be auto-waived (status → waived)</p>
                  </div>
                  <div class="space-y-1.5">
                    <label for="autoOD" class="block text-sm font-medium text-slate-700">Auto-overdue After (days)</label>
                    <input id="autoOD" type="number" min="1" bind:value={settings.autoMarkOverdueDays} class={inp}/>
                    <p class="text-xs text-slate-400">Days past due before status flips to 'overdue'</p>
                  </div>
                </div>
              </div>

              <hr class="border-gray-100"/>

              <div>
                <div class="flex items-baseline gap-2 mb-4">
                  <h4 class="text-sm font-semibold text-slate-700">Damage & Loss Penalties</h4>
                  <span class="text-xs text-slate-400">tbl_*_return_request condition: damaged | lost</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div class="space-y-1.5">
                    <label for="dmg" class="block text-sm font-medium text-slate-700">Damage Fine (% of item value)</label>
                    <input id="dmg" type="number" min="0" max="100" bind:value={settings.damageFinePct} class={inp}/>
                  </div>
                  <div class="space-y-1.5">
                    <label for="lost" class="block text-sm font-medium text-slate-700">Lost Item Fine (% of item value)</label>
                    <input id="lost" type="number" min="0" max="200" bind:value={settings.lostFineMultiplier} class={inp}/>
                  </div>
                </div>
              </div>

              <hr class="border-gray-100"/>

              <div>
                <div class="flex items-baseline gap-2 mb-4">
                  <h4 class="text-sm font-semibold text-slate-700">Return Requests</h4>
                  <span class="text-xs text-slate-400">tbl_*_return_request</span>
                </div>
                <div class="space-y-4 max-w-sm">
                  <div class="space-y-1.5">
                    <label for="retWin" class="block text-sm font-medium text-slate-700">Return Request Window (days post-due)</label>
                    <input id="retWin" type="number" min="1" bind:value={settings.returnRequestWindowDays} class={inp}/>
                    <p class="text-xs text-slate-400">Max days after dueDate to file a return request</p>
                  </div>
                  <label class="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" bind:checked={settings.allowUserReturnRequests} class="h-4 w-4 rounded border-gray-300 text-[#0D5C29] focus:ring-[#0D5C29]"/>
                    <span class="text-sm text-slate-700">Allow users to self-submit return requests</span>
                  </label>
                </div>
              </div>

            </div>
          </div>

        <!-- FINE EXEMPTIONS -->
        {:else if activeTab === 'finecalc'}
          <div class="p-6 sm:p-8 animate-in">
            <div class="mb-7">
              <h3 class="text-base font-semibold text-slate-900">Fine Calculation Exemptions</h3>
              <p class="text-xs text-slate-400 mt-1">Days excluded when computing daysOverdue in tbl_fine</p>
            </div>
            <div class="max-w-3xl space-y-7">

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label class="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" bind:checked={settings.fineCalculation.excludeSundays} class="h-4 w-4 rounded border-gray-300"/>
                  <span class="text-sm text-slate-700">Exclude Sundays</span>
                </label>
                <label class="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" bind:checked={settings.fineCalculation.excludeCampusClosedDays} class="h-4 w-4 rounded border-gray-300"/>
                  <span class="text-sm text-slate-700">Exclude campus-closed weekdays</span>
                </label>
              </div>

              <div class="space-y-2">
                <p class="text-sm font-medium text-slate-700">Recurring Closed Weekdays</p>
                <div class="flex gap-2 flex-wrap">
                  {#each dayNames as dn, i}
                    <button type="button" onclick={() => toggleWeekday(i)}
                      class="px-3 py-1.5 rounded-md text-sm font-medium border transition-all
                        {settings.fineCalculation.closedWeekdays.includes(i) ? 'bg-[#0D5C29] text-white border-[#0D5C29]' : 'bg-white text-slate-600 border-gray-300 hover:border-gray-400'}">
                      {dn}
                    </button>
                  {/each}
                </div>
              </div>

              <div class="space-y-3">
                <p class="text-sm font-medium text-slate-700">Holidays & One-time Closures</p>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input type="date" bind:value={newHoliday} class={inpSm}/>
                  <input type="text" placeholder="Description (optional)" bind:value={newHolidayDesc} class={inpSm}/>
                  <div class="flex gap-2">
                    <select bind:value={newHolidayType} class="{inpSm} flex-1">
                      <option value="holiday">Holiday</option>
                      <option value="closed">One-time Closure</option>
                    </select>
                    <button type="button" onclick={addHoliday} class="px-3 py-2 bg-[#0D5C29] text-white rounded-md text-sm font-medium">Add</button>
                  </div>
                </div>
                <div class="border border-gray-200 rounded-lg overflow-hidden">
                  <table class="min-w-full text-sm">
                    <thead class="bg-gray-50">
                      <tr>
                        {#each ['Date','Type','Description',''] as h}
                          <th class="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                        {/each}
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                      {#each settings.fineCalculation.holidays as h, idx}
                        <tr class="hover:bg-gray-50">
                          <td class="px-4 py-2.5">{h.date}</td>
                          <td class="px-4 py-2.5">
                            <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium {h.type === 'holiday' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}">
                              {h.type === 'holiday' ? 'Holiday' : 'Closure'}
                            </span>
                          </td>
                          <td class="px-4 py-2.5 text-slate-600">{h.description}</td>
                          <td class="px-4 py-2.5">
                            <button type="button" onclick={() => removeHoliday(idx)} class="text-xs text-red-600 hover:text-red-800 font-medium">Remove</button>
                          </td>
                        </tr>
                      {:else}
                        <tr><td class="px-4 py-5 text-xs text-slate-400 text-center" colspan="4">No entries — all days counted for fines</td></tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>

        <!-- NOTIFICATIONS -->
        {:else if activeTab === 'notifications'}
          <div class="p-6 sm:p-8 animate-in">
            <div class="mb-7">
              <h3 class="text-base font-semibold text-slate-900">Notifications</h3>
              <p class="text-xs text-slate-400 mt-1">Controls tbl_notification type values and delivery channels</p>
            </div>
            <div class="max-w-2xl space-y-7">

              <div>
                <div class="flex items-baseline gap-2 mb-4">
                  <h4 class="text-sm font-semibold text-slate-700">Notification Types</h4>
                  <span class="text-xs text-slate-400">Which tbl_notification.type events are sent</span>
                </div>
                <div class="space-y-3">
                  {#each notifRows as n}
                    {@render toggleRow(n.label, n.desc,
                      settings[n.key as keyof typeof settings] as boolean,
                      v => { (settings as any)[n.key] = v; }
                    )}
                  {/each}
                </div>
                <div class="mt-5 space-y-1.5 max-w-xs">
                  <label for="remDays" class="block text-sm font-medium text-slate-700">Due Reminder — Days Before</label>
                  <input id="remDays" type="number" min="1" max="14" bind:value={settings.notifDueReminderDaysBefore} class={inp}/>
                  <p class="text-xs text-slate-400">How many days before dueDate the reminder fires</p>
                </div>
              </div>

              <hr class="border-gray-100"/>

              <div>
                <h4 class="text-sm font-semibold text-slate-700 mb-4">Delivery Channels</h4>
                <div class="space-y-3">
                  {#each channelRows as ch}
                    {@render toggleRow(ch.label, ch.desc,
                      settings[ch.key as keyof typeof settings] as boolean,
                      v => { (settings as any)[ch.key] = v; }
                    )}
                  {/each}
                </div>
              </div>

            </div>
          </div>

        <!-- DEFAULT PERMISSIONS -->
        {:else if activeTab === 'permissions'}
          <div class="p-6 sm:p-8 animate-in">
            <div class="mb-7">
              <h3 class="text-base font-semibold text-slate-900">Default Staff Permissions</h3>
              <p class="text-xs text-slate-400 mt-1">Applied when a new staff account is created (tbl_staff_permission). Individual records can be overridden per-staff.</p>
            </div>
            <div class="max-w-2xl space-y-3">
              {#each permRows as p}
                <div class="flex items-center justify-between px-4 py-3.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                  <div>
                    <div class="text-sm font-medium text-slate-800">{p.label}</div>
                    <div class="text-xs text-slate-400 mt-0.5">{p.desc}</div>
                  </div>
                  {@render toggle(defaultStaffPermissions[p.key], v => { defaultStaffPermissions[p.key] = v; })}
                </div>
              {/each}
              <p class="text-xs text-slate-400 pt-1">Note: Admin accounts (tbl_admin) have all permissions and are not affected by these settings.</p>
            </div>
          </div>

        <!-- SECURITY -->
        {:else if activeTab === 'security'}
          <div class="p-6 sm:p-8 animate-in">
            <div class="mb-7">
              <h3 class="text-base font-semibold text-slate-900">Security Settings</h3>
              <p class="text-xs text-slate-400 mt-1">Session management (tbl_user_session, tbl_staff_session) and access control</p>
            </div>
            <div class="max-w-3xl space-y-8">

              <div>
                <h4 class="text-sm font-semibold text-slate-700 mb-4">Session & Authentication</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div class="space-y-1.5">
                    <label for="sessTo" class="block text-sm font-medium text-slate-700">Session Timeout (minutes)</label>
                    <input id="sessTo" type="number" min="5" bind:value={settings.sessionTimeoutMinutes} class={inp}/>
                    <p class="text-xs text-slate-400">Affects tbl_*_session.expiresAt</p>
                  </div>
                  <div class="space-y-1.5">
                    <label for="pwdExp" class="block text-sm font-medium text-slate-700">Password Expiry (days)</label>
                    <input id="pwdExp" type="number" min="0" bind:value={settings.passwordExpiryDays} class={inp}/>
                  </div>
                  <div class="space-y-1.5">
                    <label for="loginAtt" class="block text-sm font-medium text-slate-700">Max Login Attempts</label>
                    <input id="loginAtt" type="number" min="1" bind:value={settings.maxLoginAttempts} class={inp}/>
                    <p class="text-xs text-slate-400">Failed attempts recorded in tbl_security_log</p>
                  </div>
                  <div class="space-y-1.5">
                    <label for="bakFreq" class="block text-sm font-medium text-slate-700">Backup Frequency</label>
                    <select id="bakFreq" bind:value={settings.backupFrequency} class={inp}>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>
              </div>

              <hr class="border-gray-100"/>

              <div>
                <h4 class="text-sm font-semibold text-slate-700 mb-4">Access Controls</h4>
                <div class="max-w-2xl">
                  {@render toggleRow(
                    'Two-Factor Authentication',
                    'Require 2FA for tbl_admin and tbl_super_admin logins',
                    settings.twoFactorAuth,
                    v => { settings.twoFactorAuth = v; }
                  )}
                </div>
              </div>

            </div>
          </div>

        <!-- SYSTEM -->
        {:else if activeTab === 'system'}
          <div class="p-6 sm:p-8 animate-in">
            <div class="mb-7">
              <h3 class="text-base font-semibold text-slate-900">System Status & Maintenance</h3>
              <p class="text-xs text-slate-400 mt-1">Monitor health and run maintenance tasks</p>
            </div>
            <div class="max-w-3xl space-y-7">

              <div>
                <h4 class="text-sm font-semibold text-slate-700 mb-4">Current Status</h4>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {#each [
                    { label:'Database', status:'Connected', color:'emerald' },
                    {
                      label:'API Server',
                      status: apiStatus === 'healthy' ? 'Running' : apiStatus === 'degraded' ? 'Degraded' : apiStatus === 'unhealthy' ? 'Down' : 'Checking',
                      color: apiStatus === 'healthy' ? 'emerald' : apiStatus === 'degraded' ? 'amber' : apiStatus === 'unhealthy' ? 'red' : 'gray'
                    },
                    {
                      label:'File Storage',
                      status: storageInfo ? (storageInfo.percentage >= 95 ? 'Critical' : storageInfo.percentage >= 80 ? 'Warning' : 'Healthy') : 'Checking',
                      color: storageInfo ? (storageInfo.percentage >= 95 ? 'red' : storageInfo.percentage >= 80 ? 'amber' : 'emerald') : 'gray'
                    },
                  ] as s}
                    <div class="p-4 rounded-lg border {s.color === 'emerald' ? 'border-emerald-200 bg-emerald-50' : s.color === 'amber' ? 'border-amber-200 bg-amber-50' : s.color === 'red' ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="w-2 h-2 rounded-full {s.color === 'emerald' ? 'bg-emerald-500' : s.color === 'amber' ? 'bg-amber-500' : s.color === 'red' ? 'bg-red-500' : 'bg-gray-500'} inline-block"></span>
                        <span class="text-xs font-semibold uppercase tracking-wide {s.color === 'emerald' ? 'text-emerald-700' : s.color === 'amber' ? 'text-amber-700' : s.color === 'red' ? 'text-red-700' : 'text-gray-700'}">{s.status}</span>
                      </div>
                      <div class="font-semibold text-slate-800 text-sm">{s.label}</div>
                    </div>
                  {/each}
                </div>
              </div>

              <hr class="border-gray-100"/>

              <div>
                <h4 class="text-sm font-semibold text-slate-700 mb-4">Storage Usage</h4>
                {#if storageInfo}
                  <div class="p-4 rounded-lg border border-gray-200 bg-white">
                    <div class="flex items-center justify-between mb-3">
                      <div>
                        <div class="text-sm font-medium text-slate-800">Backblaze B2 Storage</div>
                        <div class="text-xs text-slate-500 mt-0.5">{storageInfo.usedFormatted} used of {storageInfo.totalFormatted}</div>
                      </div>
                      <div class="text-right">
                        <div class="text-lg font-semibold text-slate-800">{storageInfo.percentage}%</div>
                      </div>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                      <div class="bg-[#0D5C29] h-2 rounded-full transition-all duration-300" style="width: {Math.min(storageInfo.percentage, 100)}%"></div>
                    </div>
                    {#if storageInfo.percentage > 80}
                      <p class="text-xs text-amber-600 mt-2 flex items-center gap-1">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                        </svg>
                        Storage usage is high. Consider cleaning up old files.
                      </p>
                    {/if}
                  </div>
                {:else}
                  <div class="p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <div class="text-sm text-slate-500">Loading storage information...</div>
                  </div>
                {/if}
              </div>

              <div>
                <h4 class="text-sm font-semibold text-slate-700 mb-4">Maintenance Tasks</h4>
                <div class="flex flex-wrap gap-3">
                  {#each ['Optimize Database','Clear Cache','Export Logs','Rebuild QR Index','Recalculate Overdue Fines'] as task}
                    <button type="button" class="px-4 py-2 border border-gray-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                      {task}
                    </button>
                  {/each}
                </div>
              </div>

            </div>
          </div>
        {/if}

      </div>
    </div>
  </div>
</div>

<style>
  @keyframes fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  .animate-in { animation: fade-in 0.18s ease-out; }
</style>