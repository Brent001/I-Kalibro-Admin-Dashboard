<script lang="ts">
  import { onMount } from "svelte";
  import { replaceState } from "$app/navigation";
  import FileText from 'lucide-svelte/icons/file-text';
  import BookOpen from 'lucide-svelte/icons/book-open';
  import CircleDollarSign from 'lucide-svelte/icons/circle-dollar-sign';
  import CalendarDays from 'lucide-svelte/icons/calendar-days';
  import Bell from 'lucide-svelte/icons/bell';
  import ShieldCheck from 'lucide-svelte/icons/shield-check';
  import LockKeyhole from 'lucide-svelte/icons/lock-keyhole';
  import Eye from 'lucide-svelte/icons/eye';
  import EyeOff from 'lucide-svelte/icons/eye-off';
  import SettingsIcon from 'lucide-svelte/icons/settings';
  import QrCode from 'lucide-svelte/icons/qr-code';
  import Barcode from 'lucide-svelte/icons/barcode';

  let { data } = $props();
  const isAdmin = data.user?.userType === 'admin' || data.user?.userType === 'super_admin';
  const isStaff = data.user?.userType === 'staff';

  let activeTab = $state(isStaff ? 'account' : 'general');
  let isSaving = $state(false);
  let saveSuccess = $state(false);
  let saveError = $state('');
  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let showCurrentPassword = $state(false);
  let showNewPassword = $state(false);
  let showConfirmPassword = $state(false);
  let isSubmittingPassword = $state(false);
  let passwordMessage = $state('');
  let passwordMessageType = $state<'success' | 'error' | ''>('');

  let storageInfo = $state<{
    used: number;
    total: number;
    usedFormatted: string;
    totalFormatted: string;
    percentage: number;
  } | null>(null);

  let apiStatus = $state<'healthy' | 'degraded' | 'unhealthy' | 'checking'>('checking');

  type PermKey = 'canManageBooks'|'canManageUsers'|'canManageBorrowing'|'canManageReservations'|'canViewReports'|'canManageFines';

  const defaultSettings = {
    libraryName: 'Metro Dagupan Colleges Library',
    libraryCode: 'MDC-LIB',
    address: 'National Highway, Barangay Salay, Mangaldan, 2432 Pangasinan',
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
  };

  let settings = $state<typeof defaultSettings>({
    ...defaultSettings,
    ...(data.settings && typeof data.settings === 'object' ? data.settings : {}),
    fineCalculation: defaultSettings.fineCalculation
  });

  const defaultStaffPermissionValues: Record<PermKey, boolean> = {
    canManageBooks: false,
    canManageUsers: false,
    canManageBorrowing: true,
    canManageReservations: true,
    canViewReports: false,
    canManageFines: true
  };

  let defaultStaffPermissions = $state<Record<PermKey, boolean>>({
    ...defaultStaffPermissionValues,
    ...(data.defaultStaffPermissions && typeof data.defaultStaffPermissions === 'object' ? data.defaultStaffPermissions : {})
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
    if (!isAdmin) return;
    isSaving = true;
    saveSuccess = false;
    saveError = '';
    try {
      const [settingsResponse, fineResponse] = await Promise.all([
        fetch('/api/settings', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...settings, defaultStaffPermissions }), credentials:'same-origin' }),
        fetch('/api/settings/finecal', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(settings.fineCalculation), credentials:'same-origin' })
      ]);
      if (!settingsResponse.ok || !fineResponse.ok) throw new Error('Settings could not be saved. Please try again.');
      saveSuccess = true;
      setTimeout(() => saveSuccess = false, 3000);
    } catch (err) {
      saveError = err instanceof Error ? err.message : 'Settings could not be saved.';
    } finally {
      isSaving = false;
    }
  }

  const tabs = [
    { id:'account',       name:'Account',              icon:LockKeyhole },
    { id:'general',       name:'General',             icon:FileText },
    { id:'borrowing',     name:'Borrowing',            icon:BookOpen },
    { id:'fines',         name:'Fines & Returns',      icon:CircleDollarSign },
    { id:'finecalc',      name:'Fine Exemptions',      icon:CalendarDays },
    { id:'notifications', name:'Notifications',        icon:Bell },
    { id:'permissions',   name:'Permissions',          icon:ShieldCheck },
    { id:'security',      name:'Security',             icon:LockKeyhole },
    { id:'system',        name:'System',               icon:SettingsIcon },
  ];

  const tabDescriptions: Record<string, string> = {
    general: 'Library profile, contact details, and visitor scan method',
    borrowing: 'Loan periods, copy limits, and reservation rules',
    fines: 'Fine rates, penalties, and return requests',
    finecalc: 'Calendar exemptions used when calculating fines',
    notifications: 'Notification events and delivery channels',
    permissions: 'Default permissions for new staff accounts',
    security: 'Sessions, authentication, and backup policy',
    system: 'Service health, storage, and maintenance tasks',
    account: 'Manage your own sign-in password'
  };

  const visibleTabs = $derived(isStaff ? tabs.filter(tab => tab.id === 'account') : tabs);
  let activeTabData = $derived(visibleTabs.find(tab => tab.id === activeTab) ?? visibleTabs[0]);

  function selectTab(id: string) {
    if (!isAdmin && id !== 'account') return;
    activeTab = id;
    try { const p = new URLSearchParams(location.search); p.set('tab', id); replaceState(`${location.pathname}?${p}`, {}); } catch {}
  }

  async function submitPasswordChange() {
    passwordMessage = '';
    passwordMessageType = '';
    isSubmittingPassword = true;

    try {
      const response = await fetch('/api/settings/change_pass', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        passwordMessageType = 'error';
        passwordMessage = result.message || 'Password could not be changed.';
        return;
      }

      passwordMessageType = 'success';
      passwordMessage = result.message || 'Password changed successfully. You can stay signed in.';
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
    } catch {
      passwordMessageType = 'error';
      passwordMessage = 'Network error. Please try again.';
    } finally {
      isSubmittingPassword = false;
    }
  }

  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D5C29] focus:border-transparent outline-none transition-all bg-white";
  const inpSm = "px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D5C29] focus:border-transparent outline-none transition-all bg-white";

  const notifRows = [
    { key:'notifDueReminder'      , label:'Due Date Reminder',   desc:'Sent N days before dueDate — type: due_reminder' },
    { key:'notifOverdue'           , label:'Overdue Alert',        desc:'Sent when status → overdue — type: overdue' },
    { key:'notifReservationReady'  , label:'Reservation Ready',    desc:'Sent when reservation approved — type: reservation_ready' },
    { key:'notifReturnConfirmation', label:'Return Confirmation',  desc:'Sent when return processed — type: return_confirmation' },
  ];

  const channelRows = [
    { key:'notifChannelEmail', label:'Email via Resend', desc:'Send notifications to user/staff email through Resend' },
  ];

  let testEmailStatus = $state('');
  let testingEmail = $state(false);

  async function sendTestEmail() {
    testingEmail = true;
    testEmailStatus = '';
    try {
      const response = await fetch('/api/settings/test-email', { method: 'POST', credentials: 'same-origin' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Test email could not be sent.');
      testEmailStatus = 'Test email sent.';
    } catch (err) {
      testEmailStatus = err instanceof Error ? err.message : 'Test email could not be sent.';
    } finally {
      testingEmail = false;
    }
  }

  let maintenanceTask = $state('');
  let maintenanceStatus = $state('');

  const maintenanceActions: Record<string, string> = {
    'Optimize Database': 'optimize_database',
    'Clear Cache': 'clear_cache',
    'Export Logs': 'export_logs',
    'Rebuild QR Index': 'rebuild_qr_index',
    'Recalculate Overdue Fines': 'recalculate_fines'
  };

  async function runMaintenance(task: string) {
    maintenanceTask = task;
    maintenanceStatus = '';
    try {
      const response = await fetch('/api/settings/maintenance', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: maintenanceActions[task] })
      });

      if (task === 'Export Logs' && response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `security-logs-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        maintenanceStatus = 'Security logs exported.';
      } else {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Maintenance task failed.');
        maintenanceStatus = result.message || `${task} completed.`;
      }
    } catch (err) {
      maintenanceStatus = err instanceof Error ? err.message : `${task} failed.`;
    } finally {
      maintenanceTask = '';
    }
  }

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
    try {
      const p = new URLSearchParams(location.search);
      const t = p.get('tab');
      if (t && (isAdmin || t === 'account')) activeTab = t;
    } catch {}
    if (!isAdmin) return;
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
        {#if saveError}
          <div class="px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-medium">{saveError}</div>
        {/if}
        {#if saveSuccess}
          <div class="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
            Saved
          </div>
        {/if}
        {#if isAdmin}
          <button onclick={handleSave} disabled={isSaving}
            class="px-5 py-2 bg-[#0D5C29] text-white rounded-lg font-semibold text-sm hover:bg-[#0a4820] disabled:opacity-50 transition-colors shadow-sm">
            {isSaving ? 'Saving…' : 'Save Changes'}
          </button>
        {/if}
      </div>
    </div>
  </div>

  <!-- Settings navigation -->
  <div class="bg-white border border-gray-200 rounded-xl p-1 mb-1 overflow-hidden">
    <div class="flex gap-0.5 overflow-x-auto" role="tablist" aria-label="Settings sections"
      style="-webkit-overflow-scrolling: touch; scrollbar-width: none;">
      {#each visibleTabs as tab}
        {@const TabIcon = tab.icon}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          onclick={() => selectTab(tab.id)}
          class="flex items-center gap-1.5 px-3.5 py-[7px] rounded-lg text-[13px] font-medium whitespace-nowrap flex-shrink-0 transition-all duration-150
            {activeTab === tab.id
              ? 'bg-[#0D5C29] text-white shadow-sm'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}">
          <TabIcon size={15} class="shrink-0" />
          <span>{tab.name}</span>
        </button>
      {/each}
    </div>
  </div>

  {#if activeTabData}
    {@const ActiveTabIcon = activeTabData.icon}
    <div class="flex items-center gap-2 px-1 py-2.5 mb-3">
      <div class="flex items-center justify-center w-6 h-6 rounded-md bg-[#0D5C29]/10 shrink-0">
        <ActiveTabIcon size={14} class="text-[#0D5C29]" />
      </div>
      <span class="text-sm font-semibold text-slate-700">{activeTabData.name}</span>
      <span class="text-slate-300 select-none">·</span>
      <span class="text-xs text-slate-400 truncate">{tabDescriptions[activeTab]}</span>
    </div>
  {/if}

  <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

        <!-- ACCOUNT -->
        {#if activeTab === 'account'}
          <div class="p-5 sm:p-8 lg:p-10 animate-in">
            <div class="mb-7">
              <h3 class="text-base font-semibold text-slate-900">Change password</h3>
              <p class="text-xs text-slate-400 mt-1">Confirm your current password before choosing a new one.</p>
            </div>
            <form class="max-w-xl space-y-4" onsubmit={(event) => { event.preventDefault(); submitPasswordChange(); }}>
              {#each [
                { label: 'Current password', name: 'currentPassword', value: currentPassword, shown: showCurrentPassword, set: (value: string) => currentPassword = value, toggle: () => showCurrentPassword = !showCurrentPassword },
                { label: 'New password', name: 'newPassword', value: newPassword, shown: showNewPassword, set: (value: string) => newPassword = value, toggle: () => showNewPassword = !showNewPassword },
                { label: 'Confirm new password', name: 'confirmPassword', value: confirmPassword, shown: showConfirmPassword, set: (value: string) => confirmPassword = value, toggle: () => showConfirmPassword = !showConfirmPassword }
              ] as field}
                <div>
                  <label class="mb-1.5 block text-sm font-medium text-gray-700" for={field.name}>{field.label}</label>
                  <div class="relative">
                    <input id={field.name} name={field.name} type={field.shown ? 'text' : 'password'} value={field.value}
                      oninput={(event) => field.set(event.currentTarget.value)} autocomplete={field.name === 'currentPassword' ? 'current-password' : 'new-password'} required class="{inp} pr-11" />
                    <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-[#0D5C29]" aria-label={field.shown ? `Hide ${field.label.toLowerCase()}` : `Show ${field.label.toLowerCase()}`} onclick={field.toggle}>
                      {#if field.shown}<EyeOff class="h-4 w-4" />{:else}<Eye class="h-4 w-4" />{/if}
                    </button>
                  </div>
                </div>
              {/each}
              <p class="text-xs leading-5 text-gray-500">Use at least 8 characters with uppercase, lowercase, a number, and a special character.</p>
              {#if passwordMessage}
                <div class="rounded-lg border px-3 py-2.5 text-sm {passwordMessageType === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'}" role="status">{passwordMessage}</div>
              {/if}
              <button type="submit" disabled={isSubmittingPassword} class="flex items-center justify-center gap-2 rounded-lg bg-[#0D5C29] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#08401c] disabled:cursor-not-allowed disabled:opacity-60">
                <LockKeyhole class="h-4 w-4" />
                {isSubmittingPassword ? 'Updating password...' : 'Update password'}
              </button>
            </form>
          </div>

        <!-- GENERAL -->
        {:else if activeTab === 'general'}
          <div class="p-5 sm:p-8 lg:p-10 animate-in">
            <div class="mb-7">
              <h3 class="text-base font-semibold text-slate-900">Library Information</h3>
              <p class="text-xs text-slate-400 mt-1">Contact details and identifying codes stored in tbl_library_settings</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-5xl">
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

            <hr class="border-gray-100 max-w-5xl mt-8 mb-7"/>

            <div class="max-w-5xl">
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
                    <QrCode class="w-4 h-4" />
                    QR Code
                  </button>
                  <button
                    type="button"
                    onclick={() => settings.visitScanMethod = 'barcode'}
                    class="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
                      {settings.visitScanMethod === 'barcode'
                        ? 'bg-white text-[#0D5C29] shadow-sm ring-1 ring-gray-200'
                        : 'text-slate-500 hover:text-slate-700'}">
                    <Barcode class="w-4 h-4" />
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
          <div class="p-5 sm:p-8 lg:p-10 animate-in">
            <div class="mb-7">
              <h3 class="text-base font-semibold text-slate-900">Borrowing Policies</h3>
              <p class="text-xs text-slate-400 mt-1">Controls loan periods, copy limits, and reservation windows (tbl_*_borrowing, tbl_*_reservation)</p>
            </div>
            <div class="space-y-8 max-w-5xl">

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
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {#each borrowLimits as item}
                    <div class="space-y-1.5">
                      <label for="borrow-limit-{item.key}" class="block text-sm font-medium text-slate-700">{item.label}</label>
                      <input id="borrow-limit-{item.key}" type="number" min="0" bind:value={settings[item.key as keyof typeof settings] as number} class={inp}/>
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
          <div class="p-5 sm:p-8 lg:p-10 animate-in">
            <div class="mb-7">
              <h3 class="text-base font-semibold text-slate-900">Fines & Return Policies</h3>
              <p class="text-xs text-slate-400 mt-1">Configure overdue fine rates, damage/loss penalties, and return request rules (tbl_fine, tbl_*_return_request)</p>
            </div>
            <div class="space-y-8 max-w-5xl">

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
          <div class="p-5 sm:p-8 lg:p-10 animate-in">
            <div class="mb-7">
              <h3 class="text-base font-semibold text-slate-900">Fine Calculation Exemptions</h3>
              <p class="text-xs text-slate-400 mt-1">Days excluded when computing daysOverdue in tbl_fine</p>
            </div>
            <div class="max-w-5xl space-y-7">

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
          <div class="p-5 sm:p-8 lg:p-10 animate-in">
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
                <div class="mt-5 flex flex-wrap items-center gap-3">
                  <button type="button" onclick={sendTestEmail} disabled={testingEmail}
                    class="px-4 py-2 border border-[#0D5C29] text-[#0D5C29] text-sm font-semibold rounded-lg hover:bg-emerald-50 disabled:opacity-50 transition-colors">
                    {testingEmail ? 'Sending…' : 'Send Test Email'}
                  </button>
                  {#if testEmailStatus}
                    <span class="text-xs {testEmailStatus === 'Test email sent.' ? 'text-emerald-700' : 'text-red-600'}">{testEmailStatus}</span>
                  {/if}
                </div>
              </div>

            </div>
          </div>

        <!-- DEFAULT PERMISSIONS -->
        {:else if activeTab === 'permissions'}
          <div class="p-5 sm:p-8 lg:p-10 animate-in">
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
          <div class="p-5 sm:p-8 lg:p-10 animate-in">
            <div class="mb-7">
              <h3 class="text-base font-semibold text-slate-900">Security Settings</h3>
              <p class="text-xs text-slate-400 mt-1">Session management (tbl_user_session, tbl_staff_session) and access control</p>
            </div>
            <div class="max-w-5xl space-y-8">

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
          <div class="p-5 sm:p-8 lg:p-10 animate-in">
            <div class="mb-7">
              <h3 class="text-base font-semibold text-slate-900">System Status & Maintenance</h3>
              <p class="text-xs text-slate-400 mt-1">Monitor health and run maintenance tasks</p>
            </div>
            <div class="max-w-5xl space-y-7">

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
                    <button type="button" onclick={() => runMaintenance(task)} disabled={Boolean(maintenanceTask)} class="px-4 py-2 border border-gray-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-wait transition-colors">
                      {maintenanceTask === task ? 'Working…' : task}
                    </button>
                  {/each}
                </div>
                {#if maintenanceStatus}
                  <p class="mt-3 text-xs {maintenanceStatus.endsWith('failed.') || maintenanceStatus.includes('could not') ? 'text-red-600' : 'text-emerald-700'}">{maintenanceStatus}</p>
                {/if}
              </div>

            </div>
          </div>
        {/if}

  </div>
</div>

<style>
  @keyframes fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  .animate-in { animation: fade-in 0.18s ease-out; }
</style>