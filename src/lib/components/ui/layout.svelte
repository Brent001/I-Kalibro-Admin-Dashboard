<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { writable } from "svelte/store";
  import { browser } from "$app/environment";

  export let onLogout: () => void = () => {};
  
  const sidebarOpen = writable(false);
  let isLoggingOut = false;
  let showLogoutOptions = false;
  
  // User session state
  let user: {
    id?: string;
    name?: string;
    username?: string;
    email?: string;
    role?: string;
    isActive?: boolean;
  } | null = null;
  let isLoadingUser = true;
  let sessionError = false;

  const navigation = [
    { 
      name: "Dashboard", 
      href: "/dashboard", 
      icon: `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2z"/>
        <path stroke-linecap="round" stroke-linejoin="round" d="M8 5a2 2 0 012-2h4a2 2 0 012 2v4H8V5z"/>
      </svg>` 
    },
    { 
      name: "Books", 
      href: "/dashboard/books", 
      icon: `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
      </svg>` 
    },
    { 
      name: "Members", 
      href: "/dashboard/members", 
      icon: `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
      </svg>` 
    },
    { 
      name: "Staff", 
      href: "/dashboard/staff", 
      icon: `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
      </svg>` 
    },
    { 
      name: "Transactions", 
      href: "/dashboard/transactions", 
      icon: `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
      </svg>` 
    },
    { 
      name: "Reports", 
      href: "/reports", 
      icon: `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
      </svg>` 
    },
    { 
      name: "Settings", 
      href: "/dashboard/settings", 
      icon: `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
      </svg>` 
    },
  ];

  let currentPath = "";
  $: currentPath = $page.url.pathname;

  // Fetch user session data
  async function fetchUserSession() {
    if (!browser) return;
    
    try {
      isLoadingUser = true;
      sessionError = false;
      
      const response = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.user) {
          user = result.data.user;
        } else {
          console.warn('Invalid session response:', result);
          sessionError = true;
        }
      } else if (response.status === 401) {
        // Not authenticated, redirect to login
        user = null;
        if (browser) {
          window.location.href = '/';
        }
      } else {
        console.error('Session fetch failed:', response.status);
        sessionError = true;
      }
    } catch (error) {
      console.error('Error fetching user session:', error);
      sessionError = true;
    } finally {
      isLoadingUser = false;
    }
  }

  // Advanced logout function
  async function handleLogout(logoutAllDevices: boolean = false) {
    if (isLoggingOut) return;
    
    isLoggingOut = true;
    showLogoutOptions = false;

    try {
      const response = await fetch('/api/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          logoutAllDevices,
          reason: 'user_logout'
        })
      });

      const result = await response.json();

      if (result.success) {
        // Show success message briefly
        if (logoutAllDevices) {
          showNotification('Logged out from all devices successfully', 'success');
        } else {
          showNotification('Logged out successfully', 'success');
        }
        
        // Clear user data
        user = null;
        
        // Call the parent logout handler
        onLogout();
        
        // Small delay to show the message, then redirect
        setTimeout(() => {
          if (browser) {
            window.location.href = '/';
          }
        }, 1000);
      } else {
        // Handle partial success or errors
        console.error('Logout error:', result.message);
        showNotification(result.message || 'Logout completed with some issues', 'warning');
        
        // Still redirect even if there were issues
        setTimeout(() => {
          if (browser) {
            window.location.href = '/';
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Logout request failed:', error);
      showNotification('Network error during logout. Redirecting...', 'error');
      
      // Force redirect even on network error
      setTimeout(() => {
        if (browser) {
          window.location.href = '/';
        }
      }, 2000);
    } finally {
      isLoggingOut = false;
    }
  }

  // Simple notification system
  let notifications: Array<{id: number; message: string; type: 'success' | 'error' | 'warning'}> = [];
  let notificationId = 0;

  function showNotification(message: string, type: 'success' | 'error' | 'warning' = 'success') {
    const id = ++notificationId;
    notifications = [...notifications, { id, message, type }];
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      notifications = notifications.filter(n => n.id !== id);
    }, 5000);
  }

  function removeNotification(id: number) {
    notifications = notifications.filter(n => n.id !== id);
  }

  // Close logout options when clicking outside
  function handleClickOutside(event: Event) {
    if (showLogoutOptions) {
      const target = event.target as Element;
      if (!target.closest('.logout-menu')) {
        showLogoutOptions = false;
      }
    }
  }

  onMount(() => {
    if (browser) {
      // Fetch user session on component mount
      fetchUserSession();
      
      // Set up click outside handler
      document.addEventListener('click', handleClickOutside);
      
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  });

  // Add a helper to capitalize the role
  function capitalize(str: string) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
  }
</script>

<!-- Notifications -->
{#if notifications.length > 0}
  <div class="fixed top-4 right-4 z-[100] space-y-2">
    {#each notifications as notification (notification.id)}
      <div 
        class="flex items-center justify-between px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ease-in-out
          {notification.type === 'success' ? 'bg-green-500 text-white' : 
           notification.type === 'error' ? 'bg-red-500 text-white' : 
           'bg-yellow-500 text-white'}"
      >
        <div class="flex items-center space-x-2">
          {#if notification.type === 'success'}
            <!-- Changed from checkmark to thumbs up -->
            <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
            </svg>
          {:else if notification.type === 'error'}
            <!-- Changed from X to alert triangle -->
            <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M12 2L2 22h20L12 2z"/>
            </svg>
          {:else}
            <!-- Changed from warning triangle to info circle -->
            <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          {/if}
          <span class="text-sm font-medium">{notification.message}</span>
        </div>
        <button 
          on:click={() => removeNotification(notification.id)}
          class="ml-4 text-white/80 hover:text-white"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    {/each}
  </div>
{/if}

<div class="flex h-screen bg-gray-50">
  <!-- Sidebar -->
  <div class="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0"
    class:translate-x-0={$sidebarOpen}
    class:-translate-x-full={!$sidebarOpen}
  >
    <!-- Logo -->
    <div class="flex items-center justify-between h-16 px-6 bg-slate-900 text-white">
      <div class="flex items-center space-x-3">
        <div class="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
          <svg class="h-5 w-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
            <circle cx="12" cy="12" r="2"/>
          </svg>
        </div>
        <div>
          <h1 class="text-lg font-bold">i/Kalibro</h1>
          <p class="text-xs text-slate-300">Library Management System</p>
        </div>
      </div>
      <button class="lg:hidden p-1" on:click={() => sidebarOpen.set(false)}>
        <svg class="h-5 w-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- Navigation -->
    <nav class="mt-6 px-4">
      <ul class="space-y-1">
        {#each navigation as item}
          <li>
            <a
              href={item.href}
              class="flex items-center space-x-3 px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200
                {currentPath === item.href
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}"
              on:click|preventDefault={() => { goto(item.href); sidebarOpen.set(false); }}
            >
              <span class="flex-shrink-0">
                {@html item.icon}
              </span>
              <span>{item.name}</span>
            </a>
          </li>
        {/each}
      </ul>
    </nav>

    <!-- User info -->
    <div class="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
      <div class="flex items-center space-x-3 mb-3">
        <div class="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center">
          {#if isLoadingUser}
            <div class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
          {:else}
            <svg class="h-4 w-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          {/if}
        </div>
        <div class="flex-1 min-w-0">
          {#if isLoadingUser}
            <div class="animate-pulse">
              <div class="h-3 bg-gray-200 rounded w-20 mb-1"></div>
              <div class="h-2 bg-gray-200 rounded w-24"></div>
            </div>
          {:else if sessionError}
            <p class="text-sm font-medium text-red-600">Session Error</p>
            <p class="text-xs text-red-500">Unable to load user data</p>
          {:else if user}
            <p class="text-sm font-medium text-gray-900 truncate" title={user.name || user.username}>
              {user.name || user.username}
            </p>
            <p class="text-xs text-gray-500 truncate" title={user.email}>
              {user.email}
            </p>
          {:else}
            <p class="text-sm font-medium text-gray-900">Guest User</p>
            <p class="text-xs text-gray-500">Not authenticated</p>
          {/if}
        </div>
      </div>
      
      <!-- Logout Button with Dropdown -->
      <div class="relative logout-menu">
        <button
          on:click|stopPropagation={() => showLogoutOptions = !showLogoutOptions}
          class="flex items-center space-x-2 w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors duration-200
            {isLoggingOut ? 'opacity-50 cursor-not-allowed' : ''}"
          disabled={isLoggingOut || isLoadingUser}
        >
          {#if isLoggingOut}
            <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Signing out...</span>
          {:else}
            <!-- Changed logout icon from arrow to power button -->
            <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 12v6a2 2 0 002 2h4a2 2 0 002-2v-6M12 2v10"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M16 6a4 4 0 10-8 0"/>
            </svg>
            <span>Sign out</span>
            <svg class="h-3 w-3 ml-auto transition-transform {showLogoutOptions ? 'rotate-180' : ''}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          {/if}
        </button>

        <!-- Logout Options Dropdown -->
        {#if showLogoutOptions && !isLoggingOut && !isLoadingUser}
          <div class="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
            <button
              on:click={() => handleLogout(false)}
              class="flex items-center space-x-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <!-- Changed from arrow to monitor icon -->
              <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <rect x="2" y="4" width="20" height="12" rx="2"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 20h8M12 16v4"/>
              </svg>
              <span>Sign out this device</span>
            </button>
            <button
              on:click={() => handleLogout(true)}
              class="flex items-center space-x-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <!-- Changed to multiple monitors icon -->
              <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <rect x="8" y="2" width="12" height="8" rx="1"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M16 12h4a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6a1 1 0 011-1h4"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 14v4M8 18h8"/>
              </svg>
              <span>Sign out all devices</span>
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Main content -->
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b border-gray-200">
      <div class="flex items-center justify-between px-6 py-4">
        <div class="flex items-center space-x-4">
          <button class="lg:hidden p-1" on:click={() => sidebarOpen.set(true)}>
            <svg class="h-6 w-6 text-gray-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <h1 class="text-lg sm:text-2xl font-semibold text-gray-900">
            {#if currentPath === "/dashboard" && user?.role}
              {capitalize(user.role)} Dashboard
            {:else}
              {navigation.find(nav => nav.href === currentPath)?.name || "Dashboard"}
            {/if}
          </h1>
        </div>
        <div class="flex items-center space-x-4">
          <!-- Notification bell icon -->
          <button class="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7C18 6.279 15.464 4 12.25 4s-5.75 2.279-5.75 5.05v.7a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/>
            </svg>
            <span class="absolute top-1 right-1 h-3 w-3 bg-red-500 rounded-full"></span>
          </button>
          <div class="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center">
            {#if isLoadingUser}
              <div class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
            {:else}
              <svg class="h-4 w-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            {/if}
          </div>
        </div>
      </div>
    </header>

    <!-- Page content -->
    <main class="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6">
      <slot />
    </main>
  </div>

  <!-- Overlay -->
  {#if $sidebarOpen}
    <div
      class="fixed inset-0 z-40 bg-white/30 backdrop-blur-sm lg:hidden"
      on:click={() => sidebarOpen.set(false)}
    ></div>
  {/if}
</div>