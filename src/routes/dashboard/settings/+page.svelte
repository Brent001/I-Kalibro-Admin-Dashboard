<script lang="ts">
  import { onMount } from "svelte";
  import type { PageData } from './$types.js';

  // ── Lucide-Svelte icons (per-file imports for broad version compatibility) ─
  import FileText       from 'lucide-svelte/icons/file-text';
  import BookOpen       from 'lucide-svelte/icons/book-open';
  import CircleDollarSign from 'lucide-svelte/icons/circle-dollar-sign';
  import Calendar       from 'lucide-svelte/icons/calendar';
  import Bell           from 'lucide-svelte/icons/bell';
  import ShieldCheck    from 'lucide-svelte/icons/shield-check';
  import LockIcon       from 'lucide-svelte/icons/lock';
  import SettingsIcon   from 'lucide-svelte/icons/settings';
  import CheckCircle    from 'lucide-svelte/icons/check-circle';
  import Info           from 'lucide-svelte/icons/info';
  import QrCode         from 'lucide-svelte/icons/qr-code';
  import Barcode        from 'lucide-svelte/icons/barcode';
  import Trash2         from 'lucide-svelte/icons/trash-2';
  import ChevronRight   from 'lucide-svelte/icons/chevron-right';
  import RefreshCw      from 'lucide-svelte/icons/refresh-cw';
  import AlertTriangle  from 'lucide-svelte/icons/alert-triangle';
  import type { SvelteComponent } from 'svelte';

  let { data } = $props<{ data: PageData }>();

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
    address: data.settings?.address ?? '',
    phone: data.settings?.phone ?? '',
    email: data.settings?.email ?? '',
    website: data.settings?.website ?? '',

    visitScanMethod: (data.settings?.visitScanMethod ?? 'qrcode') as 'qrcode' | 'barcode' | 'both',

    notifDueReminder: data.settings?.notificationSettings?.notifDueReminder ?? false,
    notifOverdue: data.settings?.notificationSettings?.notifOverdue ?? false,
    notifReservationReady: data.settings?.notificationSettings?.notifReservationReady ?? false,
    notifReturnConfirmation: data.settings?.notificationSettings?.notifReturnConfirmation ?? false,
    notifDueReminderDaysBefore: data.settings?.notificationSettings?.notifDueReminderDaysBefore ?? 1,
    notifChannelEmail: data.settings?.notificationSettings?.notifChannelEmail ?? false,

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

  let newHoliday = $state('');
  let newHolidayDesc = $state('');
  let newHolidayType = $state<'holiday' | 'closed'>('holiday');
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  function addHoliday() {
    if (!newHoliday) return;
    if (!settings.fineCalculation.holidays.some(h => h.date === newHoliday)) {
      settings.fineCalculation.holidays = [
        ...settings.fineCalculation.holidays,
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
      const [r1, r2, r3, r4, r5, r6] = await Promise.all([
        fetch('/api/settings', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(settings), credentials:'same-origin' }).catch(() => ({ok:false})),
        fetch('/api/settings/finecal', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(settings.fineCalculation), credentials:'same-origin' }).catch(() => ({ok:false})),
        fetch('/api/settings/permissions', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(defaultStaffPermissions), credentials:'same-origin' }).catch(() => ({ok:false})),
        fetch('/api/settings/scan-method', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({visitScanMethod: settings.visitScanMethod}), credentials:'same-origin' }).catch(() => ({ok:false})),
        fetch('/api/settings/notifications', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
          notifDueReminder: settings.notifDueReminder,
          notifOverdue: settings.notifOverdue,
          notifReservationReady: settings.notifReservationReady,
          notifReturnConfirmation: settings.notifReturnConfirmation,
          notifDueReminderDaysBefore: settings.notifDueReminderDaysBefore,
          notifChannelEmail: settings.notifChannelEmail
        }), credentials:'same-origin' }).catch(() => ({ok:false})),
        fetch('/api/settings/security', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({twoFactorAuth: settings.twoFactorAuth}), credentials:'same-origin' }).catch(() => ({ok:false}))
      ]);
      if ((r1 as any).ok || (r2 as any).ok || (r3 as any).ok || (r4 as any).ok || (r5 as any).ok || (r6 as any).ok) {
        saveSuccess = true;
        setTimeout(() => saveSuccess = false, 3000);
      }
    } finally { isSaving = false; }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tabs: { id: string; name: string; icon: any }[] = [
    { id: 'general',       name: 'General',       icon: FileText          },
    { id: 'borrowing',     name: 'Borrowing',      icon: BookOpen          },
    { id: 'fines',         name: 'Fines',          icon: CircleDollarSign  },
    { id: 'finecalc',      name: 'Exemptions',     icon: Calendar          },
    { id: 'notifications', name: 'Notifications',  icon: Bell              },
    { id: 'permissions',   name: 'Permissions',    icon: ShieldCheck       },
    { id: 'security',      name: 'Security',       icon: LockIcon          },
    { id: 'system',        name: 'System',         icon: SettingsIcon      },
  ];

  const tabDescriptions: Record<string, string> = {
    general:       'Library profile, contact info & scan method',
    borrowing:     'Loan periods, copy limits & reservation rules',
    fines:         'Fine rates, damage/loss penalties & return requests',
    finecalc:      'Calendar exemptions for fine day calculation',
    notifications: 'Notification types & delivery channels',
    permissions:   'Default staff permission presets',
    security:      'Sessions, authentication & backup frequency',
    system:        'Health monitoring & maintenance tasks',
  };

  function selectTab(id: string) {
    activeTab = id;
    try {
      const p = new URLSearchParams(location.search);
      p.set('tab', id);
      history.replaceState(null, '', `${location.pathname}?${p}`);
    } catch {}
  }

  onMount(async () => {
    try { const p = new URLSearchParams(location.search); const t = p.get('tab'); if (t) activeTab = t; } catch {}
    try { const res = await fetch('/api/settings/finecal', { credentials:'same-origin' }); if (res.ok) { const d = await res.json(); if (d?.fineCalculation) settings.fineCalculation = d.fineCalculation; } } catch {}
    try { const res = await fetch('/api/settings/notifications', { credentials:'same-origin' }); if (res.ok) { const d = await res.json(); if (d?.notifications) {
        settings.notifDueReminder = !!d.notifications.notifDueReminder;
        settings.notifOverdue = !!d.notifications.notifOverdue;
        settings.notifReservationReady = !!d.notifications.notifReservationReady;
        settings.notifReturnConfirmation = !!d.notifications.notifReturnConfirmation;
        settings.notifDueReminderDaysBefore = Number(d.notifications.notifDueReminderDaysBefore) || settings.notifDueReminderDaysBefore;
        settings.notifChannelEmail = !!d.notifications.notifChannelEmail;
      } }
    } catch {}
    try { const res = await fetch('/api/settings/security', { credentials:'same-origin' }); if (res.ok) { const d = await res.json(); if (d?.security && typeof d.security.twoFactorAuth === 'boolean') { settings.twoFactorAuth = d.security.twoFactorAuth; } } } catch {}
    try { const res = await fetch('/api/settings/storage', { credentials:'same-origin' }); if (res.ok) { const d = await res.json(); if (d?.storage) storageInfo = d.storage; } } catch {}
    try {
      const res = await fetch('/api/health', { credentials:'same-origin' });
      if (res.ok) { const d = await res.json(); apiStatus = d.status === 'healthy' ? 'healthy' : d.status === 'degraded' ? 'degraded' : 'unhealthy'; }
      else apiStatus = 'unhealthy';
    } catch { apiStatus = 'unhealthy'; }
  });

  const inp   = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D5C29] focus:border-transparent outline-none transition-all bg-white";
  const inpSm = "px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D5C29] focus:border-transparent outline-none transition-all bg-white";

  const notifRows = [
    { key:'notifDueReminder',       label:'Due Date Reminder',  desc:'Sent N days before dueDate — type: due_reminder' },
    { key:'notifOverdue',            label:'Overdue Alert',       desc:'Sent when status → overdue — type: overdue' },
    { key:'notifReservationReady',   label:'Reservation Ready',   desc:'Sent when reservation approved — type: reservation_ready' },
    { key:'notifReturnConfirmation', label:'Return Confirmation', desc:'Sent when return processed — type: return_confirmation' },
  ];
  const channelRows = [
    { key:'notifChannelEmail', label:'Email', desc:'Send notifications to user/staff email' },
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

  let activeTabData = $derived(tabs.find(t => t.id === activeTab)!);
</script>

<svelte:head>
  <title>Settings | E-Kalibro Admin Portal</title>
</svelte:head>

<!-- ─── Snippets ─────────────────────────────────────────────────────── -->

{#snippet toggle(checked: boolean, onchange: (v: boolean) => void)}
  <label class="relative inline-flex items-center cursor-pointer shrink-0">
    <input type="checkbox" checked={checked} onchange={e => onchange((e.target as HTMLInputElement).checked)} class="sr-only peer"/>
    <div class="w-10 h-5 bg-gray-300 rounded-full peer peer-checked:bg-[#0D5C29]
      after:content-[''] after:absolute after:top-0.5 after:left-0.5
      after:bg-white after:rounded-full after:h-4 after:w-4
      after:transition-all peer-checked:after:translate-x-5"></div>
  </label>
{/snippet}

{#snippet toggleRow(label: string, desc: string, checked: boolean, onchange: (v: boolean) => void)}
  <div class="flex items-center justify-between gap-4 p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
    <div class="min-w-0">
      <div class="text-sm font-medium text-slate-800">{label}</div>
      <div class="text-xs text-slate-400 mt-0.5">{desc}</div>
    </div>
    {@render toggle(checked, onchange)}
  </div>
{/snippet}

<!-- ─── Page ──────────────────────────────────────────────────────────── -->

<div class="min-h-screen">

  <!-- Header -->
  <div class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <h2 class="text-2xl font-bold text-slate-900">Settings</h2>
      <p class="text-slate-500 text-sm mt-0.5">Manage library configuration, policies, and system preferences</p>
    </div>
    <div class="flex items-center gap-3">
      {#if saveSuccess}
        <div class="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium animate-fadein">
          <CheckCircle size={16} class="shrink-0" />
          Saved successfully
        </div>
      {/if}
      <button onclick={handleSave} disabled={isSaving}
        class="px-5 py-2 bg-[#0D5C29] text-white rounded-lg font-semibold text-sm hover:bg-[#0a4820] disabled:opacity-50 transition-colors shadow-sm">
        {isSaving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  </div>

  <!-- Tab nav -->
  <div class="bg-white border border-gray-200 rounded-xl p-1 mb-1 overflow-hidden">
    <div class="flex gap-0.5 overflow-x-auto" role="tablist"
      style="-webkit-overflow-scrolling:touch;scrollbar-width:none;">
      {#each tabs as tab}
        {@const TabIcon = tab.icon}
        <button
          role="tab"
          aria-selected={activeTab === tab.id}
          onclick={() => selectTab(tab.id)}
          class="flex items-center gap-1.5 px-3.5 py-[7px] rounded-lg text-[13px] font-medium whitespace-nowrap flex-shrink-0 transition-all duration-150 cursor-pointer
            {activeTab === tab.id
              ? 'bg-[#0D5C29] text-white shadow-sm'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}">
          <TabIcon size={15} class="shrink-0" />
          <span>{tab.name}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- Context strip -->
  {#if activeTabData}
    {@const StripIcon = activeTabData.icon}
    <div class="flex items-center gap-2 px-1 py-2.5 mb-3">
      <div class="flex items-center justify-center w-6 h-6 rounded-md bg-[#0D5C29]/10 shrink-0">
        <StripIcon size={14} class="text-[#0D5C29]" />
      </div>
      <span class="text-sm font-semibold text-slate-700">{activeTabData.name}</span>
      <span class="text-slate-300 select-none">·</span>
      <span class="text-xs text-slate-400 truncate">{tabDescriptions[activeTab] ?? ''}</span>
    </div>
  {/if}

  <!-- Content panel -->
  <div class="bg-white rounded-xl shadow-sm border border-gray-200">

    <!-- ── GENERAL ─────────────────────────────────────────────── -->
    {#if activeTab === 'general'}
      <div class="p-6 sm:p-8 animate-in">
        <div class="mb-7">
          <h3 class="text-base font-semibold text-slate-900">Library Information</h3>
          <p class="text-xs text-slate-400 mt-1">Contact details and identifying codes stored in tbl_library_settings</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl">
          <div class="space-y-1.5">
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
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h3 class="text-base font-semibold text-slate-900">Visit Scan Method</h3>
              <p class="text-xs text-slate-400 mt-0.5">How the visit kiosk identifies visitors — tbl_library_settings.visitScanMethod</p>
            </div>
            <div class="flex items-center bg-gray-100 rounded-lg p-1 shrink-0">
              <button type="button" onclick={() => settings.visitScanMethod = 'qrcode'}
                class="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
                  {settings.visitScanMethod === 'qrcode' ? 'bg-white text-[#0D5C29] shadow-sm ring-1 ring-gray-200' : 'text-slate-500 hover:text-slate-700'}">
                <QrCode size={16} />
                QR Code
              </button>
              <button type="button" onclick={() => settings.visitScanMethod = 'barcode'}
                class="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
                  {settings.visitScanMethod === 'barcode' ? 'bg-white text-[#0D5C29] shadow-sm ring-1 ring-gray-200' : 'text-slate-500 hover:text-slate-700'}">
                <Barcode size={16} />
                Barcode
              </button>
            </div>
          </div>
          <p class="text-xs text-slate-500 mt-4 flex items-start gap-2 bg-gray-50 border border-dashed border-gray-200 rounded-lg px-4 py-3">
            <Info size={14} class="mt-0.5 shrink-0 text-slate-400" />
            {#if settings.visitScanMethod === 'qrcode'}
              The visit kiosk camera will read <span class="font-medium text-slate-700">QR codes</span> on student and faculty ID cards or generated visit passes.
            {:else}
              The visit kiosk scanner will read <span class="font-medium text-slate-700">1D barcodes</span> (Code 128 / EAN-13) on physical ID cards.
            {/if}
          </p>
        </div>
      </div>

    <!-- ── BORROWING ────────────────────────────────────────────── -->
    {:else if activeTab === 'borrowing'}
      <div class="p-6 sm:p-8 animate-in">
        <div class="mb-7">
          <h3 class="text-base font-semibold text-slate-900">Borrowing Policies</h3>
          <p class="text-xs text-slate-400 mt-1">Controls loan periods, copy limits, and reservation windows (tbl_*_borrowing, tbl_*_reservation)</p>
        </div>
        <div class="space-y-8 max-w-3xl">

          <div>
            <h4 class="text-sm font-semibold text-slate-700 mb-4">Loan Periods</h4>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div class="space-y-1.5">
                <label for="lpS" class="block text-sm font-medium text-slate-700">Student (days)</label>
                <input id="lpS" type="number" min="1" bind:value={settings.defaultLoanPeriodStudent} class={inp}/>
                <p class="text-xs text-slate-400">dueDate – borrowDate</p>
              </div>
              <div class="space-y-1.5">
                <label for="lpF" class="block text-sm font-medium text-slate-700">Faculty (days)</label>
                <input id="lpF" type="number" min="1" bind:value={settings.defaultLoanPeriodFaculty} class={inp}/>
              </div>
              <div class="space-y-1.5">
                <label for="maxR" class="block text-sm font-medium text-slate-700">Max Renewals</label>
                <input id="maxR" type="number" min="0" bind:value={settings.maxRenewals} class={inp}/>
                <p class="text-xs text-slate-400">Across all item types</p>
              </div>
            </div>
          </div>

          <hr class="border-gray-100"/>

          <div>
            <h4 class="text-sm font-semibold text-slate-700 mb-4">Borrow Limits per User</h4>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {#each borrowLimits as item}
                <div class="space-y-1.5">
                  <label for="bl_{item.key}" class="block text-sm font-medium text-slate-700">{item.label}</label>
                  <input id="bl_{item.key}" type="number" min="0" bind:value={settings[item.key as keyof typeof settings] as number} class={inp}/>
                </div>
              {/each}
            </div>
          </div>

          <hr class="border-gray-100"/>

          <div>
            <div class="flex items-baseline gap-2 mb-4">
              <h4 class="text-sm font-semibold text-slate-700">Reservations</h4>
              <span class="text-xs text-slate-400">tbl_*_reservation</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div class="space-y-1.5">
                <label for="resExp" class="block text-sm font-medium text-slate-700">Expiry (days)</label>
                <input id="resExp" type="number" min="1" bind:value={settings.reservationExpiryDays} class={inp}/>
                <p class="text-xs text-slate-400">expiryDate = requestDate + N</p>
              </div>
              <div class="space-y-1.5">
                <label for="resApproval" class="block text-sm font-medium text-slate-700">Staff Approval Window (hours)</label>
                <input id="resApproval" type="number" min="1" bind:value={settings.reservationApprovalWindowHours} class={inp}/>
                <p class="text-xs text-slate-400">Time before auto-expiry</p>
              </div>
            </div>
          </div>

        </div>
      </div>

    <!-- ── FINES & RETURNS ──────────────────────────────────────── -->
    {:else if activeTab === 'fines'}
      <div class="p-6 sm:p-8 animate-in">
        <div class="mb-7">
          <h3 class="text-base font-semibold text-slate-900">Fines & Return Policies</h3>
          <p class="text-xs text-slate-400 mt-1">Overdue rates, damage/loss penalties, and return request rules (tbl_fine, tbl_*_return_request)</p>
        </div>
        <div class="space-y-8 max-w-3xl">

          <div>
            <div class="flex items-baseline gap-2 mb-4">
              <h4 class="text-sm font-semibold text-slate-700">Overdue Fines</h4>
              <span class="text-xs text-slate-400">fineAmount = daysOverdue × rate</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div class="space-y-1.5">
                <label for="fDay" class="block text-sm font-medium text-slate-700">Rate / Day (₱)</label>
                <input id="fDay" type="number" min="0" step="0.50" bind:value={settings.overdueFinePerDay} class={inp}/>
              </div>
              <div class="space-y-1.5">
                <label for="fCap" class="block text-sm font-medium text-slate-700">Max Fine Cap (₱)</label>
                <input id="fCap" type="number" min="0" step="10" bind:value={settings.maxFineAmount} class={inp}/>
                <p class="text-xs text-slate-400">Per borrowing record</p>
              </div>
              <div class="space-y-1.5">
                <label for="grace" class="block text-sm font-medium text-slate-700">Grace Period (days)</label>
                <input id="grace" type="number" min="0" bind:value={settings.gracePeriodDays} class={inp}/>
                <p class="text-xs text-slate-400">Free days before fines start</p>
              </div>
              <div class="space-y-1.5">
                <label for="waiver" class="block text-sm font-medium text-slate-700">Auto-waiver Threshold (₱)</label>
                <input id="waiver" type="number" min="0" step="0.50" bind:value={settings.fineWaiverThreshold} class={inp}/>
                <p class="text-xs text-slate-400">Below this → auto-waived</p>
              </div>
              <div class="space-y-1.5">
                <label for="autoOD" class="block text-sm font-medium text-slate-700">Auto-overdue After (days)</label>
                <input id="autoOD" type="number" min="1" bind:value={settings.autoMarkOverdueDays} class={inp}/>
                <p class="text-xs text-slate-400">Days past due → 'overdue'</p>
              </div>
            </div>
          </div>

          <hr class="border-gray-100"/>

          <div>
            <div class="flex items-baseline gap-2 mb-4">
              <h4 class="text-sm font-semibold text-slate-700">Damage & Loss Penalties</h4>
              <span class="text-xs text-slate-400">condition: damaged | lost</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-md">
              <div class="space-y-1.5">
                <label for="dmg" class="block text-sm font-medium text-slate-700">Damage Fine (% of value)</label>
                <input id="dmg" type="number" min="0" max="100" bind:value={settings.damageFinePct} class={inp}/>
              </div>
              <div class="space-y-1.5">
                <label for="lost" class="block text-sm font-medium text-slate-700">Lost Fine (% of value)</label>
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
                <label for="retWin" class="block text-sm font-medium text-slate-700">Request Window (days post-due)</label>
                <input id="retWin" type="number" min="1" bind:value={settings.returnRequestWindowDays} class={inp}/>
                <p class="text-xs text-slate-400">Max days after dueDate to file</p>
              </div>
              <label class="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" bind:checked={settings.allowUserReturnRequests} class="h-4 w-4 rounded border-gray-300 text-[#0D5C29] focus:ring-[#0D5C29]"/>
                <span class="text-sm text-slate-700">Allow users to self-submit return requests</span>
              </label>
            </div>
          </div>

        </div>
      </div>

    <!-- ── FINE EXEMPTIONS ─────────────────────────────────────── -->
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
                    {settings.fineCalculation.closedWeekdays.includes(i)
                      ? 'bg-[#0D5C29] text-white border-[#0D5C29]'
                      : 'bg-white text-slate-600 border-gray-300 hover:border-gray-400'}">
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
                <button type="button" onclick={addHoliday}
                  class="px-3 py-2 bg-[#0D5C29] text-white rounded-md text-sm font-medium hover:bg-[#0a4820] transition-colors">
                  Add
                </button>
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
                      <td class="px-4 py-2.5 text-sm">{h.date}</td>
                      <td class="px-4 py-2.5">
                        <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium
                          {h.type === 'holiday' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}">
                          {h.type === 'holiday' ? 'Holiday' : 'Closure'}
                        </span>
                      </td>
                      <td class="px-4 py-2.5 text-sm text-slate-600">{h.description}</td>
                      <td class="px-4 py-2.5">
                        <button type="button" onclick={() => removeHoliday(idx)}
                          class="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">
                          Remove
                        </button>
                      </td>
                    </tr>
                  {:else}
                    <tr>
                      <td class="px-4 py-5 text-xs text-slate-400 text-center" colspan="4">
                        No entries — all days counted for fines
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

    <!-- ── NOTIFICATIONS ───────────────────────────────────────── -->
    {:else if activeTab === 'notifications'}
      <div class="p-6 sm:p-8 animate-in">
        <div class="mb-7">
          <h3 class="text-base font-semibold text-slate-900">Notifications</h3>
          <p class="text-xs text-slate-400 mt-1">Controls tbl_notification type values and delivery channels</p>
        </div>
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-6xl mx-auto">

          <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div>
              <h4 class="text-sm font-semibold text-slate-700">Notification Types</h4>
              <p class="text-xs text-slate-400 mt-0.5">Which tbl_notification.type events are sent</p>
            </div>
            <div class="space-y-3 mt-4">
              {#each notifRows as n}
                {@render toggleRow(n.label, n.desc, settings[n.key as keyof typeof settings] as boolean, v => { (settings as any)[n.key] = v; })}
              {/each}
            </div>
            <div class="space-y-1.5 pt-4">
              <label for="remDays" class="block text-sm font-medium text-slate-700">Due Reminder — Days Before</label>
              <input id="remDays" type="number" min="1" max="14" bind:value={settings.notifDueReminderDaysBefore} class={inp}/>
              <p class="text-xs text-slate-400">Days before dueDate the reminder fires</p>
            </div>
          </div>

          <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div>
              <h4 class="text-sm font-semibold text-slate-700">Delivery Channels</h4>
              <p class="text-xs text-slate-400 mt-0.5">How notifications are dispatched</p>
            </div>
            <div class="space-y-3 mt-4">
              {#each channelRows as ch}
                {@render toggleRow(ch.label, ch.desc, settings[ch.key as keyof typeof settings] as boolean, v => { (settings as any)[ch.key] = v; })}
              {/each}
            </div>
          </div>

        </div>
      </div>

    <!-- ── PERMISSIONS ─────────────────────────────────────────── -->
    {:else if activeTab === 'permissions'}
      <div class="p-6 sm:p-8 animate-in">
        <div class="mb-7">
          <h3 class="text-base font-semibold text-slate-900">Default Staff Permissions</h3>
          <p class="text-xs text-slate-400 mt-1">Applied when a new staff account is created (tbl_staff_permission). Override individually per-staff.</p>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 max-w-4xl">
          {#each permRows as p}
            <div class="flex items-center justify-between gap-4 px-4 py-3.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
              <div class="min-w-0">
                <div class="text-sm font-medium text-slate-800">{p.label}</div>
                <div class="text-xs text-slate-400 mt-0.5">{p.desc}</div>
              </div>
              {@render toggle(defaultStaffPermissions[p.key], v => { defaultStaffPermissions[p.key] = v; })}
            </div>
          {/each}
        </div>
        <p class="text-xs text-slate-400 mt-4 max-w-4xl">
          Note: Admin accounts (tbl_admin) have all permissions and are not affected by these settings.
        </p>
      </div>

    <!-- ── SECURITY ────────────────────────────────────────────── -->
    {:else if activeTab === 'security'}
      <div class="p-6 sm:p-8 animate-in">
        <div class="mb-7">
          <h3 class="text-base font-semibold text-slate-900">Security Settings</h3>
          <p class="text-xs text-slate-400 mt-1">Session management (tbl_user_session, tbl_staff_session) and access control</p>
        </div>
        <div class="space-y-8 max-w-3xl">

          <div>
            <h4 class="text-sm font-semibold text-slate-700 mb-4">Session & Authentication</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
                <p class="text-xs text-slate-400">Recorded in tbl_security_log</p>
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
            {@render toggleRow(
              'Two-Factor Authentication',
              'Require 2FA for tbl_admin and tbl_super_admin logins',
              settings.twoFactorAuth,
              v => { settings.twoFactorAuth = v; }
            )}
          </div>

        </div>
      </div>

    <!-- ── SYSTEM ──────────────────────────────────────────────── -->
    {:else if activeTab === 'system'}
      <div class="p-6 sm:p-8 animate-in">
        <div class="mb-7">
          <h3 class="text-base font-semibold text-slate-900">System Status & Maintenance</h3>
          <p class="text-xs text-slate-400 mt-1">Monitor service health and run maintenance tasks</p>
        </div>
        <div class="space-y-8 max-w-4xl">

          <!-- Service health -->
          <div>
            <h4 class="text-sm font-semibold text-slate-700 mb-4">Service Health</h4>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {#each [
                { label: 'Database',     status: 'Connected', color: 'emerald' },
                {
                  label: 'API Server',
                  status: apiStatus === 'healthy' ? 'Running' : apiStatus === 'degraded' ? 'Degraded' : apiStatus === 'unhealthy' ? 'Down' : 'Checking',
                  color:  apiStatus === 'healthy' ? 'emerald' : apiStatus === 'degraded' ? 'amber' : apiStatus === 'unhealthy' ? 'red' : 'gray'
                },
                {
                  label: 'File Storage',
                  status: storageInfo ? (storageInfo.percentage >= 95 ? 'Critical' : storageInfo.percentage >= 80 ? 'Warning' : 'Healthy') : 'Checking',
                  color:  storageInfo ? (storageInfo.percentage >= 95 ? 'red' : storageInfo.percentage >= 80 ? 'amber' : 'emerald') : 'gray'
                },
              ] as s}
                <div class="p-4 rounded-lg border
                  {s.color === 'emerald' ? 'border-emerald-200 bg-emerald-50'
                  : s.color === 'amber'  ? 'border-amber-200 bg-amber-50'
                  : s.color === 'red'    ? 'border-red-200 bg-red-50'
                  :                        'border-gray-200 bg-gray-50'}">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="w-2 h-2 rounded-full inline-block
                      {s.color === 'emerald' ? 'bg-emerald-500'
                      : s.color === 'amber'  ? 'bg-amber-500'
                      : s.color === 'red'    ? 'bg-red-500'
                      :                        'bg-gray-400'}"></span>
                    <span class="text-xs font-semibold uppercase tracking-wide
                      {s.color === 'emerald' ? 'text-emerald-700'
                      : s.color === 'amber'  ? 'text-amber-700'
                      : s.color === 'red'    ? 'text-red-700'
                      :                        'text-gray-600'}">{s.status}</span>
                  </div>
                  <div class="font-semibold text-slate-800 text-sm">{s.label}</div>
                </div>
              {/each}
            </div>
          </div>

          <hr class="border-gray-100"/>

          <!-- Storage summary + redirect -->
          <div>
            <div class="flex items-center justify-between mb-4">
              <div>
                <h4 class="text-sm font-semibold text-slate-700">Storage Usage</h4>
                <p class="text-xs text-slate-400 mt-0.5">Backblaze B2 bucket utilisation</p>
              </div>
              <a href="/dashboard/settings/storage"
                class="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#0D5C29]/25 text-[#0D5C29] hover:bg-[#0D5C29] hover:text-white hover:border-[#0D5C29] transition-all">
                <Trash2 size={14} />
                Manage Storage
                <ChevronRight size={12} strokeWidth={2.5} />
              </a>
            </div>

            {#if storageInfo}
              <div class="p-5 rounded-xl border border-gray-200 bg-gray-50">
                <div class="flex items-end justify-between mb-3">
                  <div>
                    <p class="text-sm font-semibold text-slate-800">{storageInfo.usedFormatted} <span class="font-normal text-slate-400">of {storageInfo.totalFormatted} used</span></p>
                  </div>
                  <span class="text-xl font-bold tabular-nums
                    {storageInfo.percentage >= 95 ? 'text-red-600' : storageInfo.percentage >= 80 ? 'text-amber-600' : 'text-slate-700'}">
                    {storageInfo.percentage}<span class="text-xs font-medium text-slate-400 ml-0.5">%</span>
                  </span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-1.5">
                  <div class="h-1.5 rounded-full transition-all duration-500
                    {storageInfo.percentage >= 95 ? 'bg-red-500' : storageInfo.percentage >= 80 ? 'bg-amber-500' : 'bg-[#0D5C29]'}"
                    style="width:{Math.min(storageInfo.percentage,100)}%"></div>
                </div>
                {#if storageInfo.percentage > 80}
                  <p class="text-xs text-amber-600 mt-2.5 flex items-center gap-1.5">
                    <AlertTriangle size={14} class="shrink-0" />
                    Storage is high — visit Manage Storage to clean up old files.
                  </p>
                {/if}
              </div>
            {:else}
              <div class="p-5 rounded-xl border border-gray-200 bg-gray-50 flex items-center gap-3">
                <RefreshCw size={16} class="text-slate-300 animate-spin shrink-0" />
                <span class="text-sm text-slate-400">Loading storage information…</span>
              </div>
            {/if}
          </div>

          <hr class="border-gray-100"/>

          <!-- Maintenance -->
          <div>
            <h4 class="text-sm font-semibold text-slate-700 mb-4">Maintenance Tasks</h4>
            <div class="flex flex-wrap gap-3">
              {#each ['Optimize Database','Clear Cache','Export Logs','Rebuild QR Index','Recalculate Overdue Fines'] as task}
                <button type="button"
                  class="px-4 py-2 border border-gray-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors">
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

<style>
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .animate-in { animation: fade-in 0.18s ease-out; }

  @keyframes fade-in-fast {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  .animate-fadein { animation: fade-in-fast 0.2s ease-out; }

  [role="tablist"]::-webkit-scrollbar { display: none; }
</style>