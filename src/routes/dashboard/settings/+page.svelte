<script lang="ts">
  import Layout from "$lib/components/ui/layout.svelte";
  import { onMount } from "svelte";

  let activeTab: string = 'general';
  let settings = {
    // General Settings
    libraryName: 'Metro Dagupan Colleges Library',
    libraryCode: 'MDC-LIB',
    address: 'Dagupan City, Pangasinan',
    phone: '+63 75 522 4567',
    email: 'library@mdc.edu.ph',
    website: 'https://mdc.edu.ph/library',

    // Loan Settings
    defaultLoanPeriod: 14,
    maxRenewals: 2,
    maxBooksPerStudent: 5,
    maxBooksPerFaculty: 10,
    overdueFinePerDay: 5,
    reservationPeriod: 7,

    // Notification Settings
    emailNotifications: true,
    smsNotifications: false,
    overdueReminders: true,
    returnReminders: true,
    newBookAlerts: true,
    maintenanceAlerts: true,

    // Security Settings
    sessionTimeout: 30,
    passwordExpiry: 90,
    twoFactorAuth: false,
    loginAttempts: 3,
    auditLog: true,
    backupFrequency: 'daily'
  };

  function handleInputChange(key: string, value: string | number | boolean) {
    settings = { ...settings, [key]: value };
  }

  function handleSave() {
    alert('Settings saved successfully!');
  }

  const tabs = [
    { id: 'general', name: 'General', icon: 'book' },
    { id: 'loans', name: 'Loans & Fines', icon: 'users' },
    { id: 'notifications', name: 'Notifications', icon: 'bell' },
    { id: 'security', name: 'Security', icon: 'shield' },
    { id: 'system', name: 'System', icon: 'database' },
    { id: 'profile', name: 'Profile', icon: 'users' }, // Added Profile tab
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

  // SVG icon helper
  function getTabIcon(icon: string) {
    switch (icon) {
      case 'book':
        return `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>`;
      case 'users':
        return `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 21v-2a4 4 0 0 0-8 0v2"/><circle cx="12" cy="7" r="4"/><path stroke-linecap="round" stroke-linejoin="round" d="M23 21v-2a4 4 0 0 0-3-3.87"/><path stroke-linecap="round" stroke-linejoin="round" d="M1 21v-2a4 4 0 0 1 3-3.87"/></svg>`;
      case 'bell':
        return `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path stroke-linecap="round" stroke-linejoin="round" d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`;
      case 'shield':
        return `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
      case 'database':
        return `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path stroke-linecap="round" stroke-linejoin="round" d="M3 5v14c0 1.657 4.03 3 9 3s9-1.343 9-3V5"/><path stroke-linecap="round" stroke-linejoin="round" d="M3 12c0 1.657 4.03 3 9 3s9-1.343 9-3"/><path stroke-linecap="round" stroke-linejoin="round" d="M3 17c0 1.657 4.03 3 9 3s9-1.343 9-3"/></svg>`;
      default:
        return '';
    }
  }

  function getNotifIcon(type: string) {
    if (type === 'mail') {
      return `<svg class="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect width="20" height="14" x="2" y="5" rx="2"/><path stroke-linecap="round" stroke-linejoin="round" d="M22 5 12 13 2 5"/></svg>`;
    }
    if (type === 'sms') {
      return `<svg class="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path stroke-linecap="round" stroke-linejoin="round" d="M8 11h8M8 15h6"/></svg>`;
    }
    return '';
  }
</script>

<Layout>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-gray-900">Settings</h2>
        <p class="text-gray-600">Configure your library management system</p>
      </div>
      <button
        on:click={handleSave}
        class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <!-- Save Icon -->
        <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
        Save Changes
      </button>
    </div>

    <div class="flex flex-col lg:flex-row gap-6">
      <!-- Sidebar Tabs -->
      <div class="lg:w-1/4">
        <div class="bg-white rounded-lg shadow-sm border">
          <nav class="space-y-1 p-4">
            {#each tabs as tab}
              <button
                type="button"
                on:click={() => activeTab = tab.id}
                class={`w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-150 ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {@html getTabIcon(tab.icon)}
                <span>{tab.name}</span>
              </button>
            {/each}
          </nav>
        </div>
      </div>

      <!-- Settings Content -->
      <div class="flex-1">
        <div class="bg-white rounded-lg shadow-sm border">
          <div class="p-6">
            <!-- General Settings -->
            {#if activeTab === 'general'}
              <div class="space-y-6">
                <div>
                  <h3 class="text-lg font-medium text-gray-900 mb-4">Library Information</h3>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">
                        Library Name
                      </label>
                      <input
                        type="text"
                        bind:value={settings.libraryName}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">
                        Library Code
                      </label>
                      <input
                        type="text"
                        bind:value={settings.libraryCode}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">
                        Address
                      </label>
                      <textarea
                        bind:value={settings.address}
                        rows={3}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        bind:value={settings.phone}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        bind:value={settings.email}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">
                        Website
                      </label>
                      <input
                        type="url"
                        bind:value={settings.website}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            {/if}

            <!-- Loan Settings -->
            {#if activeTab === 'loans'}
              <div class="space-y-6">
                <div>
                  <h3 class="text-lg font-medium text-gray-900 mb-4">Loan Policies</h3>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">
                        Default Loan Period (days)
                      </label>
                      <input
                        type="number"
                        bind:value={settings.defaultLoanPeriod}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">
                        Maximum Renewals
                      </label>
                      <input
                        type="number"
                        bind:value={settings.maxRenewals}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">
                        Max Books per Student
                      </label>
                      <input
                        type="number"
                        bind:value={settings.maxBooksPerStudent}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">
                        Max Books per Faculty
                      </label>
                      <input
                        type="number"
                        bind:value={settings.maxBooksPerFaculty}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">
                        Overdue Fine per Day (₱)
                      </label>
                      <input
                        type="number"
                        bind:value={settings.overdueFinePerDay}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">
                        Reservation Period (days)
                      </label>
                      <input
                        type="number"
                        bind:value={settings.reservationPeriod}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            {/if}

            <!-- Notification Settings -->
            {#if activeTab === 'notifications'}
              <div class="space-y-6">
                <div>
                  <h3 class="text-lg font-medium text-gray-900 mb-4">Notification Preferences</h3>
                  <div class="space-y-4">
                    <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div class="flex items-center space-x-3">
                        {@html getNotifIcon('mail')}
                        <div>
                          <h4 class="text-sm font-medium text-gray-900">Email Notifications</h4>
                          <p class="text-sm text-gray-500">Send notifications via email</p>
                        </div>
                      </div>
                      <label class="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.emailNotifications}
                          on:change={(e: Event) => handleInputChange('emailNotifications', (e.target as HTMLInputElement).checked)}
                          class="sr-only peer"
                        />
                        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div class="flex items-center space-x-3">
                        {@html getNotifIcon('sms')}
                        <div>
                          <h4 class="text-sm font-medium text-gray-900">SMS Notifications</h4>
                          <p class="text-sm text-gray-500">Send notifications via SMS</p>
                        </div>
                      </div>
                      <label class="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.smsNotifications}
                          on:change={(e: Event) => handleInputChange('smsNotifications', (e.target as HTMLInputElement).checked)}
                          class="sr-only peer"
                        />
                        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <h4 class="text-sm font-medium text-gray-900">Overdue Reminders</h4>
                        <p class="text-sm text-gray-500">Notify users about overdue books</p>
                      </div>
                      <label class="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.overdueReminders}
                          on:change={(e: Event) => handleInputChange('overdueReminders', (e.target as HTMLInputElement).checked)}
                          class="sr-only peer"
                        />
                        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <h4 class="text-sm font-medium text-gray-900">Return Reminders</h4>
                        <p class="text-sm text-gray-500">Notify users about upcoming due dates</p>
                      </div>
                      <label class="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.returnReminders}
                          on:change={(e: Event) => handleInputChange('returnReminders', (e.target as HTMLInputElement).checked)}
                          class="sr-only peer"
                        />
                        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <h4 class="text-sm font-medium text-gray-900">New Book Alerts</h4>
                        <p class="text-sm text-gray-500">Notify about new book additions</p>
                      </div>
                      <label class="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.newBookAlerts}
                          on:change={(e: Event) => handleInputChange('newBookAlerts', (e.target as HTMLInputElement).checked)}
                          class="sr-only peer"
                        />
                        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            {/if}

            <!-- Security Settings -->
            {#if activeTab === 'security'}
              <div class="space-y-6">
                <div>
                  <h3 class="text-lg font-medium text-gray-900 mb-4">Security Configuration</h3>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">
                        Session Timeout (minutes)
                      </label>
                      <input
                        type="number"
                        bind:value={settings.sessionTimeout}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">
                        Password Expiry (days)
                      </label>
                      <input
                        type="number"
                        bind:value={settings.passwordExpiry}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">
                        Failed Login Attempts
                      </label>
                      <input
                        type="number"
                        bind:value={settings.loginAttempts}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div class="mt-6 space-y-4">
                    <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <h4 class="text-sm font-medium text-gray-900">Two-Factor Authentication</h4>
                        <p class="text-sm text-gray-500">Require 2FA for admin accounts</p>
                      </div>
                      <label class="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.twoFactorAuth}
                          on:change={(e: Event) => handleInputChange('twoFactorAuth', (e.target as HTMLInputElement).checked)}
                          class="sr-only peer"
                        />
                        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <h4 class="text-sm font-medium text-gray-900">Audit Logging</h4>
                        <p class="text-sm text-gray-500">Log all system activities</p>
                      </div>
                      <label class="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.auditLog}
                          on:change={(e: Event) => handleInputChange('auditLog', (e.target as HTMLInputElement).checked)}
                          class="sr-only peer"
                        />
                        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            {/if}

            <!-- System Settings -->
            {#if activeTab === 'system'}
              <div class="space-y-6">
                <div>
                  <h3 class="text-lg font-medium text-gray-900 mb-4">System Configuration</h3>
                  <div class="space-y-6">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">
                        Backup Frequency
                      </label>
                      <select
                        bind:value={settings.backupFrequency}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>

                    <div class="border border-gray-200 rounded-lg p-4">
                      <h4 class="text-sm font-medium text-gray-900 mb-2">System Information</h4>
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span class="text-gray-500">Version:</span>
                          <span class="ml-2 font-medium">Kalibro v2.1.0</span>
                        </div>
                        <div>
                          <span class="text-gray-500">Last Backup:</span>
                          <span class="ml-2 font-medium">January 15, 2024</span>
                        </div>
                        <div>
                          <span class="text-gray-500">Database Size:</span>
                          <span class="ml-2 font-medium">45.6 MB</span>
                        </div>
                        <div>
                          <span class="text-gray-500">Uptime:</span>
                          <span class="ml-2 font-medium">15 days, 6 hours</span>
                        </div>
                      </div>
                    </div>

                    <div class="flex space-x-4">
                      <button class="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm font-medium">
                        Create Backup
                      </button>
                      <button class="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm font-medium">
                        Clear Cache
                      </button>
                      <button class="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm font-medium">
                        View Logs
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            {/if}

            <!-- Profile Settings -->
            {#if activeTab === 'profile'}
              <div class="space-y-6">
                <div>
                  <h3 class="text-lg font-medium text-gray-900 mb-4">Profile Settings</h3>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">
                        Full Name
                      </label>
                      <input
                        type="text"
                        bind:value={profile.fullName}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">
                        Username
                      </label>
                      <input
                        type="text"
                        bind:value={profile.username}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        bind:value={profile.email}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">
                        Phone
                      </label>
                      <input
                        type="tel"
                        bind:value={profile.phone}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">
                        New Password
                      </label>
                      <input
                        type="password"
                        bind:value={profile.password}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        autocomplete="new-password"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        bind:value={profile.confirmPassword}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        autocomplete="new-password"
                      />
                    </div>
                  </div>
                  <div class="mt-6">
                    <button
                      class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Save Profile
                    </button>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
</Layout>