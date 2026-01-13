<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { writable, get, derived } from "svelte/store";
  import { browser } from "$app/environment";
  import NotificationContainer from "./notificationContainer.svelte";
  import { notifications } from "$lib/stores/notificationStore.js";

  export let onLogout: () => void = () => {};
  
  const sidebarOpen = writable(false);
  let isLoggingOut = false;
  let showLogoutOptions = false;
  let showNotificationPanel = false;
  
  // Create a persistent user store that survives navigation
  const userStore = writable<{
    id?: string;
    name?: string;
    username?: string;
    email?: string;
    role?: string;
    isActive?: boolean;
  } | null>(null);
  
  const isLoadingStore = writable(true);
  const sessionErrorStore = writable(false);
  
  // Subscribe to stores for reactivity
  type UserType = {
    id?: string;
    name?: string;
    username?: string;
    email?: string;
    role?: string;
    isActive?: boolean;
  } | null;

  let user: UserType = null;
  let isLoadingUser = true;
  let sessionError = false;
  
  $: user = $userStore;
  $: isLoadingUser = $isLoadingStore;
  $: sessionError = $sessionErrorStore;

  const allNavigation = [
    { 
      name: "Dashboard", 
      href: "/dashboard", 
      icon: `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2z"/>
        <path stroke-linecap="round" stroke-linejoin="round" d="M8 5a2 2 0 012-2h4a2 2 0 012 2v4H8V5z"/>
      </svg>`,
      roles: ["admin", "staff"]
    },
    { 
      name: "Books", 
      href: "/dashboard/books", 
      icon: `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
      </svg>`,
      roles: ["admin", "staff"]
    },
    { 
      name: "Members", 
      href: "/dashboard/members", 
      icon: `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
      </svg>`,
      roles: ["admin", "staff"]
    },
    { 
      name: "Staff", 
      href: "/dashboard/staff", 
      icon: `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
      </svg>`,
      roles: ["admin"]
    },
    { 
      name: "Transactions", 
      href: "/dashboard/transactions", 
      icon: `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
      </svg>`,
      roles: ["admin", "staff"]
    },
    { 
      name: "Reports", 
      href: "/dashboard/reports", 
      icon: `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
      </svg>`,
      roles: ["admin", "staff"]
    },
    { 
      name: "Logs", 
      href: "/dashboard/logs", 
      icon: `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <rect x="4" y="4" width="16" height="16" rx="2"/>
      <path stroke-linecap="round" stroke-linejoin="round" d="M8 9h8M8 13h6M8 17h4"/>
    </svg>`,
      roles: ["admin"]
    },
    { 
      name: "Settings", 
      href: "/dashboard/settings", 
      icon: `<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
      </svg>`,
      roles: ["admin"]
    },
  ];

  // Create a derived store for filtered navigation based on user role
  const navigation = derived(userStore, ($user) => {
    if (!$user || !$user.role) return allNavigation;
    return allNavigation.filter(item => item.roles.includes($user.role!));
  });

  let currentPath = "";
  $: currentPath = $page.url.pathname;

  // Reactive computed active navigation item
  $: activeNavHref = (() => {
    const matching = $navigation
      .filter(nav => currentPath === nav.href || currentPath.startsWith(nav.href + "/"))
      .sort((a, b) => b.href.length - a.href.length);
    return matching.length > 0 ? matching[0].href : "";
  })();

  // Fetch user session data
  async function fetchUserSession() {
    if (!browser) return;
    
    // If we already have user data, don't refetch
    if (get(userStore) !== null) {
      isLoadingStore.set(false);
      return;
    }
    
    try {
      isLoadingStore.set(true);
      sessionErrorStore.set(false);
      
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
          userStore.set(result.data.user);
        } else {
          console.warn('Invalid session response:', result);
          sessionErrorStore.set(true);
        }
      } else if (response.status === 401) {
        // Not authenticated, redirect to login
        userStore.set(null);
        if (browser) {
          window.location.href = '/';
        }
      } else {
        console.error('Session fetch failed:', response.status);
        sessionErrorStore.set(true);
      }
    } catch (error) {
      console.error('Error fetching user session:', error);
      sessionErrorStore.set(true);
    } finally {
      isLoadingStore.set(false);
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
        // Clear user data immediately
        userStore.set(null);
        
        // Call the parent logout handler
        onLogout();
        
        // Show success message and redirect immediately
        if (logoutAllDevices) {
          notifications.show('Logged out from all devices successfully', 'success');
        } else {
          notifications.show('Logged out successfully', 'success');
        }
        
        // Redirect immediately without delay
        if (browser) {
          window.location.href = '/';
        }
      } else {
        // Handle partial success or errors
        console.error('Logout error:', result.message);
        notifications.show(result.message || 'Logout completed with some issues', 'warning');
        
        // Still redirect even if there were issues
        setTimeout(() => {
          if (browser) {
            window.location.href = '/';
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Logout request failed:', error);
      notifications.show('Network error during logout. Redirecting...', 'error');
      
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

  // Close logout options when clicking outside
  function handleClickOutside(event: Event) {
    if (showLogoutOptions) {
      const target = event.target as Element;
      if (!target.closest('.logout-menu')) {
        showLogoutOptions = false;
      }
    }
    // Close notification panel when clicking outside
    if (showNotificationPanel) {
      const target = event.target as Element;
      if (!target.closest('.notification-panel') && !target.closest('.notification-bell')) {
        showNotificationPanel = false;
      }
    }
  }

  // Notification helper functions
  function getNotificationIconColor(type: string) {
    switch (type) {
      case 'success': return 'text-emerald-600';
      case 'error': return 'text-red-600';
      case 'warning': return 'text-amber-600';
      case 'info': default: return 'text-blue-600';
    }
  }

  function getNotificationIcon(type: string) {
    switch (type) {
      case 'success':
        return `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
        </svg>`;
      case 'error':
        return `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
        </svg>`;
      case 'warning':
        return `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
        </svg>`;
      case 'info':
      default:
        return `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
        </svg>`;
    }
  }

  function formatTimestamp(date: Date) {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  function handleNotificationAction(notification: any) {
    if (notification.actionUrl) {
      showNotificationPanel = false; // Close panel before navigation
      window.location.href = notification.actionUrl;
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
  function capitalize(str: string | undefined) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
  }
</script>

<div class="flex h-screen bg-[#4A7C59]/5">
  <!-- Sidebar -->
  <div class="fixed inset-y-0 left-0 z-50 w-64 bg-[#0D5C29] shadow-lg border-r border-[#E8B923]/30 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0"
    class:translate-x-0={$sidebarOpen}
    class:-translate-x-full={!$sidebarOpen}
  >
    <!-- Logo section - Dark Forest Green with Bronze accents -->
    <div class="flex items-center justify-between h-16 px-6 bg-[#0D5C29] text-white border-b border-[#B8860B]/30">
      <div class="flex items-center space-x-3">
        <div class="w-8 h-8 bg-[#B8860B] rounded-lg flex items-center justify-center">
          <svg class="w-5 h-5 text-[#0D5C29]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
          </svg>
        </div>
        <div class="pt-1">
          <h1 class="text-lg font-bold text-white">i-Kalibro</h1>
          <p class="text-xs text-[#E8B923] whitespace-nowrap">Library Management System</p>
        </div>
      </div>
      <button class="lg:hidden p-1 hover:bg-[#B8860B]/20 rounded" on:click={() => sidebarOpen.set(false)} aria-label="Close sidebar">
        <svg class="w-6 h-6 text-[#E8B923]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- Navigation section - Academic green background with bronze accents -->
    <nav class="mt-6 px-4 flex-1 overflow-y-auto bg-[#0D5C29]">
      <ul class="space-y-1">
        {#each $navigation as item}
          <li>
            {#if !(user?.role && item.roles.includes(user.role))}
              <!-- Skeleton loading with improved styling -->
              <div class="px-4 py-3 rounded-lg bg-gradient-to-r from-[#4A7C59]/20 via-[#E8B923]/10 to-[#4A7C59]/20 animate-pulse h-10 border border-[#B8860B]/20 shadow-sm">
                <div class="flex items-center space-x-3">
                  <div class="w-5 h-5 bg-[#B8860B]/30 rounded animate-pulse"></div>
                  <div class="h-4 bg-[#4A7C59]/30 rounded animate-pulse flex-1"></div>
                </div>
              </div>
            {:else}
              <a
                href={item.href}
                class="flex items-center space-x-3 px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 border border-transparent
                  {activeNavHref === item.href
                    ? 'bg-[#E8B923] text-[#0D5C29] border-[#B8860B] shadow-sm'
                    : 'text-white hover:bg-[#4A7C59]/30 hover:text-[#E8B923] hover:border-[#B8860B]/30'}"
                on:click|preventDefault={() => {
                  goto(item.href);
                  sidebarOpen.set(false);
                }}
              >
                {@html item.icon}
                <span>{item.name}</span>
              </a>
            {/if}
          </li>
        {/each}
      </ul>
    </nav>

    <!-- User info section - Academic green background with bronze accents -->
    <div class="absolute bottom-0 left-0 right-0 p-4 border-t border-[#B8860B]/30 bg-[#0D5C29]">
      <div class="flex items-center space-x-3 mb-3">
        <div class="w-8 h-8 bg-[#B8860B] text-[#0D5C29] rounded-full flex items-center justify-center border border-[#E8B923]/50">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
        </div>
        <div>
          <p class="text-sm font-medium text-white">{user?.name || 'User'}</p>
          <p class="text-xs text-[#E8B923]">{capitalize(user?.role || 'guest')}</p>
        </div>
      </div>

      <!-- Logout Button with Dropdown -->
      <div class="relative logout-menu">
        <button
          on:click|stopPropagation={() => showLogoutOptions = !showLogoutOptions}
          class="flex items-center space-x-2 w-full px-3 py-2 text-sm text-white hover:bg-[#4A7C59]/30 hover:text-[#E8B923] rounded-lg transition-colors duration-200 border border-transparent hover:border-[#B8860B]/30
            {isLoggingOut ? 'opacity-50 cursor-not-allowed' : ''}"
          disabled={isLoggingOut}
        >
          <svg class="w-5 h-5 text-[#E8B923]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
          <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
        </button>

        <!-- Logout Options Dropdown -->
        {#if showLogoutOptions && !isLoggingOut}
          <div class="absolute bottom-full left-0 right-0 mb-2 bg-[#0D5C29] border border-[#B8860B]/30 rounded-lg shadow-lg py-1">
            <button
              on:click={() => handleLogout(false)}
              class="flex items-center space-x-2 w-full px-3 py-2 text-sm text-white hover:bg-[#4A7C59]/30 hover:text-[#E8B923] transition-colors"
            >
              <span>Logout from this device</span>
            </button>
            <button
              on:click={() => handleLogout(true)}
              class="flex items-center space-x-2 w-full px-3 py-2 text-sm text-[#E8B923] hover:bg-[#4A7C59]/30 transition-colors"
            >
              <span>Logout from all devices</span>
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Main content -->
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- Header - Academic white background with green and gold accents -->
    <header class="bg-white shadow-lg border-b border-[#4A7C59]/20">
      <div class="flex items-center justify-between px-6 py-4">
        <div class="flex items-center space-x-4">
          <button class="lg:hidden p-2 hover:bg-[#0D5C29]/10 rounded-lg transition-colors" on:click={() => sidebarOpen.set(true)} aria-label="Open menu">
            <svg class="h-6 w-6 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <div class="h-8 w-px bg-[#4A7C59]/30"></div>
          <h1 class="text-sm sm:text-2xl font-bold text-[#0D5C29]">
            {#if currentPath === "/dashboard" && user?.role}
              {capitalize(user.role)} Dashboard
            {:else}
              {$navigation.find(nav => nav.href === currentPath)?.name || "Dashboard"}
            {/if}
          </h1>
        </div>
        <div class="flex items-center space-x-4">
          <!-- Notification bell icon -->
          <div class="relative notification-bell">
            <button
              class="relative p-2 text-[#0D5C29] hover:text-[#E8B923] hover:bg-[#E8B923]/10 rounded-lg transition-colors"
              aria-label="Notifications"
              on:click={() => {
                showNotificationPanel = !showNotificationPanel;
              }}
            >
              <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7C18 6.279 15.464 4 12.25 4s-5.75 2.279-5.75 5.05v.7a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/>
              </svg>
              {#if $notifications.length > 0}
                <span class="absolute -top-1 -right-1 h-5 w-5 bg-[#E8B923] text-white text-xs rounded-full flex items-center justify-center font-semibold shadow-sm">
                  {$notifications.length > 9 ? '9+' : $notifications.length}
                </span>
              {:else}
                <span class="absolute top-1 right-1 h-3 w-3 bg-[#E8B923] rounded-full border-2 border-white shadow-sm"></span>
              {/if}
            </button>

            <!-- Notification Panel -->
            {#if showNotificationPanel}
              <div class="fixed sm:absolute right-4 sm:right-0 left-4 sm:left-auto mt-2 sm:mt-2 w-auto sm:w-96 max-h-[calc(100vh-8rem)] bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden notification-panel">
                <!-- Header -->
                <div class="bg-gradient-to-r from-[#0D5C29] to-[#4A7C59] text-white px-4 py-3 flex items-center justify-between">
                  <h3 class="font-semibold text-base sm:text-lg">Notifications</h3>
                  <div class="flex items-center space-x-2">
                    {#if $notifications.length > 0}
                      <button
                        on:click={() => notifications.clear()}
                        class="text-xs text-white/80 hover:text-white underline hidden sm:block"
                      >
                        Clear all
                      </button>
                    {/if}
                    <button
                      on:click={() => showNotificationPanel = false}
                      class="text-white hover:bg-white/20 rounded-full p-1"
                      aria-label="Close notifications panel"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- Content -->
                <div class="max-h-80 overflow-y-auto">
                  {#if $notifications.length === 0}
                    <div class="p-4 sm:p-6 text-center text-gray-500">
                      <svg class="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7C18 6.279 15.464 4 12.25 4s-5.75 2.279-5.75 5.05v.7a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/>
                      </svg>
                      <p class="text-sm">No notifications yet</p>
                    </div>
                  {:else}
                    <div class="divide-y divide-gray-100">
                      {#each $notifications as notification (notification.id)}
                        <div class="p-3 sm:p-4 hover:bg-gray-50 transition-colors cursor-pointer group">
                          <div class="flex items-start space-x-2 sm:space-x-3">
                            <!-- Icon -->
                            <div class="flex-shrink-0 mt-0.5">
                              <div class="w-7 h-7 sm:w-8 sm:h-8 {getNotificationIconColor(notification.type)} bg-white bg-opacity-50 rounded-full flex items-center justify-center shadow-sm">
                                {@html getNotificationIcon(notification.type)}
                              </div>
                            </div>

                            <!-- Content -->
                            <div class="flex-1 min-w-0">
                              {#if notification.title}
                                <h4 class="text-sm font-semibold text-gray-900 mb-1">{notification.title}</h4>
                              {/if}
                              <p class="text-sm text-gray-700 leading-relaxed">{notification.message}</p>

                              <!-- Timestamp and Action -->
                              <div class="flex items-center justify-between mt-2">
                                {#if notification.timestamp}
                                  <span class="text-xs text-gray-500">{formatTimestamp(notification.timestamp)}</span>
                                {:else}
                                  <span></span>
                                {/if}

                                {#if notification.actionText && notification.actionUrl}
                                  <button
                                    on:click={() => handleNotificationAction(notification)}
                                    class="text-xs font-medium text-[#0D5C29] hover:underline focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#0D5C29] rounded px-2 py-1"
                                  >
                                    {notification.actionText}
                                  </button>
                                {/if}
                              </div>
                            </div>

                            <!-- Close Button -->
                            <button
                              on:click={() => notifications.remove(notification.id)}
                              class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 rounded-full p-1 transition-opacity flex-shrink-0"
                              aria-label="Close notification"
                            >
                              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>

                <!-- Mobile Clear All Button -->
                {#if $notifications.length > 0}
                  <div class="sm:hidden border-t border-gray-200 p-3">
                    <button
                      on:click={() => notifications.clear()}
                      class="w-full text-sm text-gray-600 hover:text-gray-800 underline text-center"
                    >
                      Clear all notifications
                    </button>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
          <div class="h-8 w-px bg-[#4A7C59]/30"></div>
          <div class="w-10 h-10 bg-[#0D5C29] text-white rounded-full flex items-center justify-center border-2 border-white shadow-sm">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
        </div>
      </div>
    </header>

    <!-- Page content - Academic cream background with subtle green tint -->
    <main class="flex-1 overflow-x-hidden overflow-y-auto bg-[#F5F5DC] p-6">
      <slot />
    </main>
  </div>

  <!-- Overlay -->
  {#if $sidebarOpen}
    <div
      class="fixed inset-0 z-40 bg-[#0D5C29]/20 backdrop-blur-sm lg:hidden"
      on:click={() => sidebarOpen.set(false)}
      on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { sidebarOpen.set(false); e.preventDefault(); } }}
      role="button"
      tabindex="0"
      aria-label="Close sidebar"
    ></div>
  {/if}
</div>

<NotificationContainer />