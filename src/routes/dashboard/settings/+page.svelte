<script lang="ts">
  import { onMount } from "svelte";
  import { writable } from 'svelte/store';
  
  let activeTab: string = 'general';
  let isSaving = false;
  let saveSuccess = false;
  let showProfile = false;
  const dropdownOpen = writable(false);
  
  let settings: Record<string, any> = {
    libraryName: 'Metro Dagupan Colleges Library',
    libraryCode: 'MDC-LIB',
    address: 'Dagupan City, Pangasinan',
    phone: '+63 75 522 4567',
    email: 'library@mdc.edu.ph',
    website: 'https://mdc.edu.ph/library',
    defaultLoanPeriod: 14,
    maxRenewals: 2,
    maxBooksPerStudent: 5,
    maxBooksPerFaculty: 10,
    overdueFinePerDay: 5,
    reservationPeriod: 7,
    emailNotifications: true,
    smsNotifications: false,
    overdueReminders: true,
    returnReminders: true,
    newBookAlerts: true,
    maintenanceAlerts: true,
    sessionTimeout: 30,
    passwordExpiry: 90,
    twoFactorAuth: false,
    loginAttempts: 3,
    auditLog: true,
    backupFrequency: 'daily'
  };

  async function handleSave() {
    isSaving = true;
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      saveSuccess = true;
      setTimeout(() => saveSuccess = false, 3000);
    } finally {
      isSaving = false;
    }
  }

  const tabs = [
    { 
      id: 'general', 
      name: 'General', 
      icon: '<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>',
      description: 'Library details & contact' 
    },
    { 
      id: 'loans', 
      name: 'Loans & Fines', 
      icon: '<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>',
      description: 'Borrowing limits & periods' 
    },
    { 
      id: 'notifications', 
      name: 'Notifications', 
      icon: '<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>',
      description: 'Email & SMS alerts' 
    },
    { 
      id: 'security', 
      name: 'Security', 
      icon: '<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>',
      description: 'Access control & logs' 
    },
    { 
      id: 'system', 
      name: 'System', 
      icon: '<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>',
      description: 'Status & maintenance' 
    },
    { 
      id: 'profile', 
      name: 'Profile', 
      icon: '<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>',
      description: 'Account settings' 
    }
  ];

  let profile = {
    fullName: 'Admin User',
    username: 'admin',
    email: 'admin@mdc.edu.ph',
    phone: '',
    avatarUrl: '',
    password: '',
    confirmPassword: ''
  };

  function selectTab(tabId: string) {
    activeTab = tabId;
    dropdownOpen.set(false);
  }
</script>

<svelte:head>
  <title>Settings | E-Kalibro Admin Portal</title>
</svelte:head>

<div class="min-h-screen">
  <!-- Header -->
  <div class="mb-4">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">Settings</h2>
        <p class="text-slate-600">Manage library configuration and preferences</p>
      </div>
      
      <div class="flex items-center gap-2">
        {#if saveSuccess}
          <div class="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
            </svg>
            Changes saved
          </div>
        {/if}
        <button
          on:click={handleSave}
          disabled={isSaving}
          class="px-6 py-2 bg-[#0D5C29] text-white rounded-lg font-semibold text-sm hover:bg-[#0a4820] disabled:opacity-50 transition-colors shadow-sm"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  </div>

  <main class="space-y-2 -mx-2 sm:mx-0">
    <!-- Tab Navigation - Horizontal scrollable for mobile -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
      <div class="flex gap-0 px-2 sm:px-4">
        {#each tabs as tab}
          <button
            on:click={() => selectTab(tab.id)}
            class={`relative px-4 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? 'border-[#0D5C29] text-[#0D5C29] bg-[#0D5C29]/5'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div class={`flex-shrink-0 ${activeTab === tab.id ? 'text-[#0D5C29]' : 'text-gray-400'}`}>
              {@html tab.icon}
            </div>
            <div class="text-left">
              <div class="font-semibold">{tab.name}</div>
            </div>
          </button>
        {/each}
      </div>
    </div>

    <!-- Content Areas -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      
      {#if activeTab === 'general'}
        <div class="p-6 sm:p-8 animate-fade-in">
          <div class="mb-8">
            <h3 class="text-lg font-semibold text-slate-900 mb-2">Library Information</h3>
            <p class="text-sm text-slate-500">Update your library's contact details and basic information</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
            <div class="space-y-2">
              <label for="libraryName" class="block text-sm font-medium text-slate-700">Library Name</label>
              <input 
                id="libraryName"
                type="text" 
                bind:value={settings.libraryName} 
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0D5C29] focus:border-transparent outline-none transition-all"
              />
            </div>
            
            <div class="space-y-2">
              <label for="libraryCode" class="block text-sm font-medium text-slate-700">Library Code</label>
              <input 
                id="libraryCode"
                type="text" 
                bind:value={settings.libraryCode} 
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0D5C29] focus:border-transparent outline-none transition-all"
              />
            </div>

            <div class="md:col-span-2 space-y-2">
              <label for="address" class="block text-sm font-medium text-slate-700">Address</label>
              <textarea 
                id="address"
                bind:value={settings.address} 
                rows="2"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0D5C29] focus:border-transparent outline-none transition-all resize-none"
              ></textarea>
            </div>

            <div class="space-y-2">
              <label for="phone" class="block text-sm font-medium text-slate-700">Contact Phone</label>
              <input 
                id="phone"
                type="tel" 
                bind:value={settings.phone} 
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0D5C29] focus:border-transparent outline-none transition-all"
              />
            </div>

            <div class="space-y-2">
              <label for="email" class="block text-sm font-medium text-slate-700">Contact Email</label>
              <input 
                id="email"
                type="email" 
                bind:value={settings.email} 
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0D5C29] focus:border-transparent outline-none transition-all"
              />
            </div>
            
            <div class="md:col-span-2 space-y-2">
              <label for="website" class="block text-sm font-medium text-slate-700">Website URL</label>
              <input 
                id="website"
                type="url" 
                bind:value={settings.website} 
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0D5C29] focus:border-transparent outline-none transition-all"
              />
            </div>
          </div>
        </div>

      {:else if activeTab === 'loans'}
        <div class="p-6 sm:p-8 animate-fade-in">
          <div class="mb-8">
            <h3 class="text-lg font-semibold text-slate-900 mb-2">Loan & Fine Policies</h3>
            <p class="text-sm text-slate-500">Configure borrowing limits, periods, and fine amounts</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
            {#each [
              { label: 'Default Loan Period (Days)', key: 'defaultLoanPeriod', id: 'defaultLoanPeriod' },
              { label: 'Maximum Renewals Allowed', key: 'maxRenewals', id: 'maxRenewals' },
              { label: 'Max Books per Student', key: 'maxBooksPerStudent', id: 'maxBooksPerStudent' },
              { label: 'Max Books per Faculty', key: 'maxBooksPerFaculty', id: 'maxBooksPerFaculty' },
              { label: 'Overdue Fine per Day (₱)', key: 'overdueFinePerDay', id: 'overdueFinePerDay' },
              { label: 'Reservation Period (Days)', key: 'reservationPeriod', id: 'reservationPeriod' }
            ] as item}
              <div class="space-y-2">
                <label for={item.id} class="block text-sm font-medium text-slate-700">{item.label}</label>
                <input
                  id={item.id}
                  type="number"
                  bind:value={settings[item.key]}
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0D5C29] focus:border-transparent outline-none transition-all"
                />
              </div>
            {/each}
          </div>
        </div>

      {:else if activeTab === 'notifications'}
        <div class="p-6 sm:p-8 animate-fade-in">
          <div class="mb-8">
            <h3 class="text-lg font-semibold text-slate-900 mb-2">Notification Preferences</h3>
            <p class="text-sm text-slate-500">Control which alerts and notifications you receive</p>
          </div>

          <div class="max-w-2xl space-y-4">
            {#each [
              { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive system alerts via email address', id: 'emailNotifications' },
              { key: 'smsNotifications', label: 'SMS Notifications', desc: 'Receive urgent alerts via mobile number', id: 'smsNotifications' },
              { key: 'overdueReminders', label: 'Overdue Reminders', desc: 'Automated reminders for overdue items', id: 'overdueReminders' },
              { key: 'returnReminders', label: 'Return Reminders', desc: 'Pre-due date reminders', id: 'returnReminders' },
              { key: 'newBookAlerts', label: 'New Book Alerts', desc: 'Announcements for new acquisitions', id: 'newBookAlerts' },
              { key: 'maintenanceAlerts', label: 'Maintenance Alerts', desc: 'Downtime and update notifications', id: 'maintenanceAlerts' }
            ] as notif}
              <div class="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                <div>
                  <h4 class="font-medium text-slate-900 text-sm">{notif.label}</h4>
                  <p class="text-xs text-slate-500 mt-1">{notif.desc}</p>
                </div>
                <label for={notif.id} class="relative inline-flex items-center cursor-pointer">
                  <input id={notif.id} type="checkbox" bind:checked={settings[notif.key]} class="sr-only peer" />
                  <div class="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0D5C29]"></div>
                </label>
              </div>
            {/each}
          </div>
        </div>

      {:else if activeTab === 'security'}
        <div class="p-6 sm:p-8 animate-fade-in">
          <div class="mb-8">
            <h3 class="text-lg font-semibold text-slate-900 mb-2">Security Settings</h3>
            <p class="text-sm text-slate-500">Manage access control and security policies</p>
          </div>

          <div class="max-w-4xl">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div class="space-y-2">
                <label for="sessionTimeout" class="block text-sm font-medium text-slate-700">Session Timeout (Minutes)</label>
                <input 
                  id="sessionTimeout"
                  type="number" 
                  bind:value={settings.sessionTimeout} 
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0D5C29] focus:border-transparent outline-none transition-all"
                />
              </div>
              <div class="space-y-2">
                <label for="passwordExpiry" class="block text-sm font-medium text-slate-700">Password Expiry (Days)</label>
                <input 
                  id="passwordExpiry"
                  type="number" 
                  bind:value={settings.passwordExpiry} 
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0D5C29] focus:border-transparent outline-none transition-all"
                />
              </div>
              <div class="space-y-2">
                <label for="loginAttempts" class="block text-sm font-medium text-slate-700">Max Login Attempts</label>
                <input 
                  id="loginAttempts"
                  type="number" 
                  bind:value={settings.loginAttempts} 
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0D5C29] focus:border-transparent outline-none transition-all"
                />
              </div>
              <div class="space-y-2">
                <label for="backupFrequency" class="block text-sm font-medium text-slate-700">Backup Frequency</label>
                <select 
                  id="backupFrequency"
                  bind:value={settings.backupFrequency} 
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0D5C29] focus:border-transparent outline-none transition-all"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            <div class="space-y-4">
              <div class="flex items-center justify-between p-4 rounded-lg border border-gray-200">
                <div>
                  <h4 class="font-medium text-slate-900 text-sm">Two-Factor Authentication</h4>
                  <p class="text-xs text-slate-500 mt-1">Require 2FA for all admin accounts</p>
                </div>
                <label for="twoFactorAuth" class="relative inline-flex items-center cursor-pointer">
                  <input id="twoFactorAuth" type="checkbox" bind:checked={settings.twoFactorAuth} class="sr-only peer" />
                  <div class="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0D5C29]"></div>
                </label>
              </div>
              <div class="flex items-center justify-between p-4 rounded-lg border border-gray-200">
                <div>
                  <h4 class="font-medium text-slate-900 text-sm">System Audit Log</h4>
                  <p class="text-xs text-slate-500 mt-1">Record all system modifications</p>
                </div>
                <label for="auditLog" class="relative inline-flex items-center cursor-pointer">
                  <input id="auditLog" type="checkbox" bind:checked={settings.auditLog} class="sr-only peer" />
                  <div class="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0D5C29]"></div>
                </label>
              </div>
            </div>
          </div>
        </div>

      {:else if activeTab === 'system'}
        <div class="p-6 sm:p-8 animate-fade-in">
          <div class="mb-8">
            <h3 class="text-lg font-semibold text-slate-900 mb-2">System Status & Maintenance</h3>
            <p class="text-sm text-slate-500">Monitor system health and perform maintenance tasks</p>
          </div>

          <div class="max-w-4xl">
            <h4 class="font-semibold text-slate-900 text-sm mb-4">Current Status</h4>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div class="p-4 rounded-lg border border-emerald-200 bg-emerald-50">
                <div class="flex items-center gap-2 mb-2">
                  <span class="inline-flex items-center justify-center w-2 h-2 bg-emerald-500 rounded-full"></span>
                  <span class="text-xs font-semibold text-emerald-700">CONNECTED</span>
                </div>
                <div class="font-semibold text-slate-900">Database</div>
              </div>
              <div class="p-4 rounded-lg border border-emerald-200 bg-emerald-50">
                <div class="flex items-center gap-2 mb-2">
                  <span class="inline-flex items-center justify-center w-2 h-2 bg-emerald-500 rounded-full"></span>
                  <span class="text-xs font-semibold text-emerald-700">RUNNING</span>
                </div>
                <div class="font-semibold text-slate-900">API Server</div>
              </div>
              <div class="p-4 rounded-lg border border-emerald-200 bg-emerald-50">
                <div class="flex items-center gap-2 mb-2">
                  <span class="inline-flex items-center justify-center w-2 h-2 bg-emerald-500 rounded-full"></span>
                  <span class="text-xs font-semibold text-emerald-700">HEALTHY</span>
                </div>
                <div class="font-semibold text-slate-900">File Storage</div>
              </div>
            </div>

            <h4 class="font-semibold text-slate-900 text-sm mb-4">Maintenance Tasks</h4>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button class="px-4 py-2 bg-white border border-gray-300 text-slate-700 font-medium text-sm rounded-lg hover:bg-gray-50 transition-colors">
                Optimize Database
              </button>
              <button class="px-4 py-2 bg-white border border-gray-300 text-slate-700 font-medium text-sm rounded-lg hover:bg-gray-50 transition-colors">
                Clear Cache
              </button>
              <button class="px-4 py-2 bg-white border border-gray-300 text-slate-700 font-medium text-sm rounded-lg hover:bg-gray-50 transition-colors">
                Export Logs
              </button>
            </div>
          </div>
        </div>

      {:else if activeTab === 'profile'}
        <div class="p-6 sm:p-8 animate-fade-in">
          <div class="mb-8">
            <h3 class="text-lg font-semibold text-slate-900 mb-2">Personal Profile</h3>
            <p class="text-sm text-slate-500">Manage your account details and password</p>
          </div>

          <div class="max-w-2xl">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div class="space-y-2">
                <label for="fullName" class="block text-sm font-medium text-slate-700">Full Name</label>
                <input 
                  id="fullName"
                  type="text" 
                  bind:value={profile.fullName} 
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0D5C29] focus:border-transparent outline-none transition-all"
                />
              </div>
              <div class="space-y-2">
                <label for="username" class="block text-sm font-medium text-slate-700">Username</label>
                <input 
                  id="username"
                  type="text" 
                  bind:value={profile.username} 
                  disabled 
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-slate-500 cursor-not-allowed"
                />
              </div>
              <div class="space-y-2">
                <label for="profileEmail" class="block text-sm font-medium text-slate-700">Email</label>
                <input 
                  id="profileEmail"
                  type="email" 
                  bind:value={profile.email} 
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0D5C29] focus:border-transparent outline-none transition-all"
                />
              </div>
              <div class="space-y-2">
                <label for="profilePhone" class="block text-sm font-medium text-slate-700">Phone</label>
                <input 
                  id="profilePhone"
                  type="tel" 
                  bind:value={profile.phone} 
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0D5C29] focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>

            <div class="bg-amber-50 rounded-lg border border-amber-200 p-6">
              <h4 class="font-semibold text-amber-900 text-sm mb-4">Change Password</h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-2">
                  <label for="newPassword" class="block text-sm font-medium text-amber-900">New Password</label>
                  <input 
                    id="newPassword"
                    type="password" 
                    bind:value={profile.password} 
                    placeholder="••••••••"
                    class="w-full px-4 py-2 border border-amber-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
                <div class="space-y-2">
                  <label for="confirmPassword" class="block text-sm font-medium text-amber-900">Confirm Password</label>
                  <input 
                    id="confirmPassword"
                    type="password" 
                    bind:value={profile.confirmPassword} 
                    placeholder="••••••••"
                    class="w-full px-4 py-2 border border-amber-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      {/if}

    </div>
  </main>
</div>

<style>
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .animate-fade-in { animation: fade-in 0.2s ease-out; }
</style>