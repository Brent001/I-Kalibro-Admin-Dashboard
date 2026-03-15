<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { writable, get, derived } from "svelte/store";
  import { browser } from "$app/environment";
  import { slide } from "svelte/transition";
  import { base } from '$app/paths';
  import NotificationContainer from "./notificationContainer.svelte";
  import { notifications } from "$lib/stores/notificationStore.js";
  import * as Lucide from "lucide-svelte";
  const Icons: any = Lucide;

  export let onLogout: () => void = () => {};
  
  const sidebarOpen = writable(false);
  let isLoggingOut = false;
  let showLogoutOptions = false;
  let showNotificationPanel = false;
  let showLogoutConfirm = false;
  let logoutAllDevices = false;
  let expandedMenus: { [key: string]: boolean } = {};
  
  const userStore = writable<{
    id?: string;
    uniqueId?: string;
    name?: string;
    username?: string;
    email?: string;
    userType?: string;
    isActive?: boolean;
  } | null>(null);
  
  const scanMethodStore = writable<'qrcode' | 'barcode' | 'both'>('qrcode');
  
  const isLoadingStore = writable(true);
  const sessionErrorStore = writable(false);
  
  type UserType = {
    id?: string;
    uniqueId?: string;
    name?: string;
    username?: string;
    email?: string;
    userType?: string;
    isActive?: boolean;
  } | null;

  let user: UserType = null;
  let scanMethod: 'qrcode' | 'barcode' | 'both' = 'qrcode';
  let isLoadingUser = true;
  let sessionError = false;
  
  $: user = $userStore;
  $: scanMethod = $scanMethodStore;
  $: isLoadingUser = $isLoadingStore;
  $: sessionError = $sessionErrorStore;

  // Server-backed notifications (admin/staff)
  let serverNotifications: Array<any> = [];
  let unreadCount = 0;
  let notifPollInterval: any = null;
  let prevUnreadCount = 0;
  let notifAudio: HTMLAudioElement | null = null;
  // track which notification IDs were unread when the panel was opened (for "New" badge)
  let newNotifIds = new Set<string>();

  function groupNotificationsByDate(notifs: Array<any>) {
    const today = new Date(); today.setHours(0,0,0,0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1);
    const groups: { label: string; items: any[] }[] = [
      { label: 'Today', items: [] },
      { label: 'Yesterday', items: [] },
      { label: 'Older', items: [] }
    ];
    for (const n of notifs) {
      const d = n.timestamp ? new Date(n.timestamp) : null;
      if (!d) { groups[2].items.push(n); continue; }
      const day = new Date(d); day.setHours(0,0,0,0);
      if (day.getTime() === today.getTime()) groups[0].items.push(n);
      else if (day.getTime() === yesterday.getTime()) groups[1].items.push(n);
      else groups[2].items.push(n);
    }
    return groups.filter(g => g.items.length > 0);
  }

  async function fetchUnreadCount() {
    try {
      const res = await fetch('/api/fetch_nof?unread=true', { credentials: 'include' });
      console.debug('fetchUnreadCount: status', res.status);
      if (!res.ok) {
        if (res.status === 401) {
          // session might be invalid — try refreshing session then retry once
          unreadCount = 0;
          try {
            await fetchUserSession();
            // retry once
            const retry = await fetch('/api/fetch_nof?unread=true', { credentials: 'include' });
            console.debug('fetchUnreadCount: retry status', retry.status);
            if (retry.ok) {
              const jr = await retry.json();
              console.debug('fetchUnreadCount: retry body', jr);
              if (jr?.success && Array.isArray(jr.data)) {
                unreadCount = jr.data.length;
                if (unreadCount > 0 && serverNotifications.length === 0) {
                  await fetchAllNotifications();
                }
              }
            }
          } catch (e) {
            console.error('fetchUnreadCount retry error', e);
          }
        }
        return;
      }
      const j = await res.json();
      console.debug('fetchUnreadCount: body', j);
      if (j?.success && Array.isArray(j.data)) {
        unreadCount = j.data.length;
        // if we have unread items and haven't loaded details yet, fetch full list
        if (unreadCount > 0 && serverNotifications.length === 0) {
          await fetchAllNotifications();
        }
      }
    } catch (e) {
      console.error('fetchUnreadCount error', e);
    }
  }

  async function fetchAllNotifications() {
    try {
      const res = await fetch('/api/fetch_nof', { credentials: 'include' });
      console.debug('fetchAllNotifications: status', res.status);
      if (!res.ok) return;
      const j = await res.json();
      console.debug('fetchAllNotifications: body', j);
      if (j?.success && Array.isArray(j.data)) {
        const newList = j.data.map((r: any) => {
          // compute action properties locally as fallback
          let actionUrl: string | null = r.actionUrl || null;
          let actionText: string | null = r.actionText || null;
          if (!actionUrl && r.type === 'reservation') {
            actionUrl = '/dashboard/transactions?tab=reserve';
            actionText = 'View reservation';
          }
          return {
            id: String(r.id),
            title: r.title,
            message: r.message,
            type: r.type || 'info',
            isRead: Boolean(r.isRead),
            timestamp: r.sentAt ? new Date(r.sentAt) : (r.createdAt ? new Date(r.createdAt) : undefined),
            actionUrl,
            actionText,
            relatedItemId: r.relatedItemId ?? null,
            relatedItemType: r.relatedItemType ?? null
          };
        });

        // compute unread counts and play sound when new unread notifications arrive
        const newUnread = newList.filter((n: any) => !n.isRead).length;
        try {
          if (newUnread > prevUnreadCount && newUnread > 0) {
            if (notifAudio) {
              // attempt to play; ignore errors (autoplay policy may block until user interacts)
              notifAudio.currentTime = 0;
              notifAudio.play().catch((e) => console.debug('notifAudio play failed', e));
            }
          } else if (prevUnreadCount === 0 && newUnread > 0) {
            // first load and we have unread items - try once more
            if (notifAudio) {
              notifAudio.currentTime = 0;
              notifAudio.play().catch((e) => console.debug('notifAudio play failed on initial load', e));
            }
          }
        } catch (e) {
          console.debug('notification sound play error', e);
        }

        serverNotifications = newList;
        unreadCount = newUnread;
        prevUnreadCount = newUnread;
      }
    } catch (e) {
      console.error('fetchAllNotifications error', e);
    }
  }

  async function markNotifications(ids: number[], isRead: boolean) {
    try {
      console.debug('markNotifications: ids', ids, 'isRead', isRead);
      const res = await fetch('/api/fetch_nof', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ids, isRead })
      });
      if (!res.ok) {
        console.error('markNotifications failed', res.status);
      } else {
        console.debug('markNotifications: success');
      }
    } catch (e) {
      console.error('markNotifications error', e);
    }
  }

  async function markAllRead() {
    const ids = serverNotifications.filter((n: any) => !n.isRead).map((n: any) => Number(n.id));
    if (ids.length === 0) return;
    await markNotifications(ids, true);
    // update local state
    serverNotifications = serverNotifications.map(n => ({ ...n, isRead: true }));
    unreadCount = 0;
  }

  async function dismissNotification(id: string) {
    const numId = Number(id);
    await markNotifications([numId], true);
    serverNotifications = serverNotifications.filter((n: any) => n.id !== id);
    unreadCount = serverNotifications.filter((n: any) => !n.isRead).length;
  }

  const allNavigation = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: Icons.Home,
      userTypes: ["admin", "super_admin", "staff"]
    },
    {
      name: "Inventory",
      icon: Icons.Archive,
      userTypes: ["admin", "super_admin", "staff"],
      submenu: [
        {
          name: "Books",
          href: "/dashboard/inventory/books",
          icon: Icons.Book,
          userTypes: ["admin", "super_admin", "staff"]
        },
        {
          name: "Magazines",
          href: "/dashboard/inventory/magazines",
          icon: Icons.BookOpen,
          userTypes: ["admin", "super_admin", "staff"]
        },
        {
          name: "Thesis & Research",
          href: "/dashboard/inventory/research",
          icon: Icons.FileText,
          userTypes: ["admin", "super_admin", "staff"]
        },
        {
          name: "Journals",
          href: "/dashboard/inventory/journals",
          icon: Icons.Film,
          userTypes: ["admin", "super_admin", "staff"]
        }
      ]
    },
    {
      name: "User",
      href: "/dashboard/members",
      icon: Icons.Users,
      userTypes: ["admin", "super_admin", "staff"]
    },
    {
      name: "QR Scanner",
      href: "/dashboard/scanner",
      icon: Icons.QrCode,
      userTypes: ["admin", "super_admin", "staff"]
    },
    {
      name: "Staff",
      href: "/dashboard/staff",
      icon: Icons.UserCheck,
      userTypes: ["admin", "super_admin"]
    },
    {
      name: "Transactions",
      href: "/dashboard/transactions",
      icon: Icons.CreditCard,
      userTypes: ["admin", "super_admin", "staff"]
    },
    {
      name: "Reports",
      href: "/dashboard/reports",
      icon: Icons.BarChart2,
      userTypes: ["admin", "super_admin", "staff"]
    },
    {
      name: "Logs",
      href: "/dashboard/security_logs",
      icon: Icons.Clipboard,
      userTypes: ["admin", "super_admin"]
    },
    {
      name: "Settings",
      href: "/dashboard/settings",
      icon: Icons.Settings,
      userTypes: ["admin", "super_admin"]
    },
  ];

  const navigation = derived([userStore, scanMethodStore], ([$user, $scanMethod]) => {
    if (!$user || !$user.userType) return allNavigation;
    let nav = allNavigation
      .filter(item => item.userTypes.includes($user.userType!))
      .map(item => ({
        ...item,
        submenu: item.submenu?.filter(sub => sub.userTypes.includes($user.userType!))
      }));
    
    // Update scanner name and icon based on scan method
    nav = nav.map(item => {
      if (item.href === '/dashboard/scanner') {
        return {
          ...item,
          name: $scanMethod === 'barcode' ? 'Barcode Scanner' : $scanMethod === 'both' ? 'QR/Barcode Scanner' : 'QR Scanner',
          icon: $scanMethod === 'barcode' ? Icons.Barcode : Icons.QrCode
        };
      }
      return item;
    });
    
    return nav;
  });

  let currentPath = "";
  $: currentPath = $page.url.pathname;

  $: activeNavHref = (() => {
    const matching = $navigation
      .filter(nav => nav.href && (currentPath === nav.href || currentPath.startsWith(nav.href + "/")))
      .sort((a, b) => (b.href?.length ?? 0) - (a.href?.length ?? 0));
    return matching.length > 0 ? (matching[0].href ?? "") : "";
  })();

  $: activeSubmenuParent = (() => {
    for (const nav of $navigation) {
      if (nav.submenu) {
        for (const sub of nav.submenu) {
          if (sub.href && (currentPath === sub.href || currentPath.startsWith(sub.href + '/'))) {
            return nav.name;
          }
        }
      }
    }
    return null;
  })();

  $: if (activeSubmenuParent && expandedMenus[activeSubmenuParent] === undefined) {
    expandedMenus[activeSubmenuParent] = true;
  }

  async function fetchScanMethod() {
    if (!browser) return;
    try {
      const response = await fetch('/api/settings/scan-method', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.visitScanMethod) {
          scanMethodStore.set(result.visitScanMethod);
        }
      }
    } catch (error) {
      console.warn('Failed to fetch scan method:', error);
    }
  }

  async function fetchUserSession() {
    if (!browser) return;
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
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.user) {
          userStore.set(result.data.user);
        } else {
          sessionErrorStore.set(true);
        }
      } else if (response.status === 401) {
        userStore.set(null);
        if (browser) await goto('/', { replaceState: true, noScroll: true });
      } else {
        sessionErrorStore.set(true);
      }
    } catch (error) {
      sessionErrorStore.set(true);
    } finally {
      isLoadingStore.set(false);
    }
  }

  async function handleLogout(logoutAllDevicesFlag: boolean = false) {
    if (isLoggingOut) return;
    isLoggingOut = true;
    showLogoutOptions = false;
    showLogoutConfirm = false;
    try {
      const response = await fetch('/api/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ logoutAllDevices: logoutAllDevicesFlag, reason: 'user_logout' })
      });
      const result = await response.json();
      if (result.success) {
        userStore.set(null);
        onLogout();
        notifications.show(
          logoutAllDevicesFlag ? 'Logged out from all devices successfully' : 'Logged out successfully',
          'success'
        );
        if (browser) await goto('/', { replaceState: true, noScroll: true });
      } else {
        notifications.show(result.message || 'Logout completed with some issues', 'warning');
        if (browser) await goto('/', { replaceState: true, noScroll: true });
      }
    } catch (error) {
      notifications.show('Network error during logout. Redirecting...', 'error');
      if (browser) await goto('/', { replaceState: true, noScroll: true });
    } finally {
      isLoggingOut = false;
    }
  }

  function handleClickOutside(event: Event) {
    if (showLogoutOptions) {
      const target = event.target as Element;
      if (!target.closest('.logout-menu')) showLogoutOptions = false;
    }
    if (showNotificationPanel) {
      const target = event.target as Element;
      if (!target.closest('.notification-panel') && !target.closest('.notification-bell')) {
        showNotificationPanel = false;
      }
    }
  }

  function getNotificationIconColor(type: string) {
    switch (type) {
      case 'success': return 'text-emerald-600';
      case 'error': return 'text-red-600';
      case 'warning': return 'text-amber-600';
      default: return 'text-blue-600';
    }
  }

  function getNotificationIcon(type: string) {
    switch (type) {
      case 'success':
        return `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`;
      case 'error':
        return `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>`;
      case 'warning':
        return `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`;
      default:
        return `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>`;
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
      showNotificationPanel = false;
      let url = notification.actionUrl;
      // append highlight param so the target page can scroll to & highlight the item
      if (notification.relatedItemId) {
        const sep = url.includes('?') ? '&' : '?';
        url += `${sep}highlight=${notification.relatedItemId}`;
      }
      goto(url);
    }
  }

  onMount(() => {
    if (browser) {
      fetchUserSession();
      fetchScanMethod();
      // initialize notification audio (use base path in case app is not hosted at root)
      try {
        const src = `${base}/assets/sound/new_nof.ogg`;
        console.debug('loading notif audio from', src);
        notifAudio = new Audio(src);
        notifAudio.preload = 'auto';
        notifAudio.addEventListener('error', (e) => console.warn('notifAudio load error', e));
      } catch (e) {
        console.debug('notifAudio init failed', e);
        notifAudio = null;
      }

      // Unlock audio on first user interaction (works around autoplay policies)
      const unlockAudio = async () => {
        try {
          if (notifAudio) {
            notifAudio.muted = true;
            await notifAudio.play();
            notifAudio.pause();
            notifAudio.currentTime = 0;
            notifAudio.muted = false;
          }
        } catch (e) {
          // ignore play errors
        } finally {
          document.removeEventListener('click', unlockAudio);
        }
      };
      document.addEventListener('click', unlockAudio, { once: true });
      let isCheckPending = false;
      const sessionCheckInterval = setInterval(async () => {
        if (isCheckPending || !$userStore) return;
        try {
          isCheckPending = true;
          const response = await fetch('/api/auth/session', {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
          });
          if (response.status === 401) {
            userStore.set(null);
            notifications.show('Your session has been revoked. Please log in again.', 'error');
            if (browser) await goto('/', { replaceState: true, noScroll: true });
          } else if (!response.ok) {
            userStore.set(null);
            if (browser) await goto('/', { replaceState: true, noScroll: true });
          }
        } catch (error) {
          console.error('Session check failed:', error);
        } finally {
          isCheckPending = false;
        }
      }, 60000);
      // start notifications polling
      fetchUnreadCount();
      notifPollInterval = setInterval(() => fetchUnreadCount(), 20000);
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
        clearInterval(sessionCheckInterval);
        if (notifPollInterval) clearInterval(notifPollInterval);
      };
    }
  });

  // when panel opens, fetch and mark unread as read
  $: if (showNotificationPanel) {
    (async () => {
      await fetchAllNotifications();
      const unreadIds = serverNotifications.filter(n => !n.isRead).map(n => Number(n.id));
      // capture which were unread for "New" badge display
      newNotifIds = new Set(serverNotifications.filter(n => !n.isRead).map(n => n.id));
      if (unreadIds.length) {
        await markNotifications(unreadIds, true);
        serverNotifications = serverNotifications.map(n => ({ ...n, isRead: true }));
        unreadCount = 0;
      }
    })();
  }

  function capitalize(str: string | undefined) {
    if (!str) return "";
    return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }
</script>

<style>
  ::-webkit-scrollbar { display: none; }
  * { scrollbar-width: none; }
  div, main, nav, aside { -ms-overflow-style: none; }
</style>

<div class="flex h-screen bg-[#4A7C59]/5">
  {#if $sidebarOpen}
    <div 
      class="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
      on:click={() => sidebarOpen.set(false)}
      aria-label="Close sidebar"
    ></div>
  {/if}

  <!-- Sidebar -->
  <div class="sidebar-container fixed inset-y-0 left-0 z-50 w-64 bg-[#0D5C29] shadow-lg border-r border-[#E8B923]/30 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col h-full"
    class:translate-x-0={$sidebarOpen}
    class:-translate-x-full={!$sidebarOpen}
  >
    <!-- Logo -->
    <div class="flex-none flex items-center justify-between h-16 px-6 bg-[#0D5C29] text-white border-b border-[#B8860B]/30">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-lg flex items-center justify-center">
          <img src="/assets/logo.png" alt="e-Kalibro Logo" class="w-full h-full object-contain" />
        </div>
        <div class="pt-1">
          <h1 class="text-lg font-bold text-white">e-Kalibro</h1>
          <p class="text-xs text-[#E8B923] whitespace-nowrap">Library Management System</p>
        </div>
      </div>
    </div>

    <!-- Nav items -->
    <nav class="flex-1 overflow-y-auto custom-scrollbar py-6 px-4 bg-[#0D5C29]">
      <ul class="space-y-1">
        {#each $navigation as item}
          <li>
            {#if item.submenu}
              {#if !(user?.userType && item.userTypes.includes(user.userType))}
                <div class="px-4 py-3 rounded-lg bg-gradient-to-r from-[#4A7C59]/20 via-[#E8B923]/10 to-[#4A7C59]/20 animate-pulse h-10 border border-[#B8860B]/20 shadow-sm">
                  <div class="flex items-center space-x-3">
                    <div class="w-5 h-5 bg-[#B8860B]/30 rounded animate-pulse"></div>
                    <div class="h-4 bg-[#4A7C59]/30 rounded animate-pulse flex-1"></div>
                  </div>
                </div>
              {:else}
                <div class="space-y-1">
                  <button
                    on:click={() => {
                      expandedMenus[item.name] = !expandedMenus[item.name];
                      expandedMenus = expandedMenus;
                    }}
                    class="flex items-center justify-between w-full px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 border
                    {activeSubmenuParent === item.name 
                      ? 'bg-[#E8B923] text-[#0D5C29] border-[#B8860B] shadow-sm' 
                      : 'text-white hover:bg-[#4A7C59]/30 hover:text-[#E8B923] border-transparent hover:border-[#B8860B]/30'}"
                  >
                    <div class="flex items-center space-x-3">
                      {#if typeof item.icon === 'string'}
                        {@html item.icon}
                      {:else}
                        <svelte:component this={item.icon} class="h-5 w-5" />
                      {/if}
                      <span>{item.name}</span>
                    </div>
                    <svg
                      class="h-4 w-4 transition-transform duration-200"
                      class:rotate-180={expandedMenus[item.name]}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {#if expandedMenus[item.name]}
                    <div 
                      transition:slide|local={{ duration: 250 }} 
                      class="relative bg-[#08401c] rounded-lg overflow-hidden border border-[#0A4520]"
                    >
                      <div class="absolute left-6 top-0 bottom-0 w-px bg-[#4A7C59]/30"></div>
                      <div class="py-2 space-y-1">
                        {#each item.submenu || [] as subitem}
                          <a
                            href={subitem.href}
                            class="relative flex items-center pl-10 pr-4 py-2.5 text-sm transition-all duration-200 group
                              {currentPath === subitem.href || currentPath.startsWith(subitem.href + '/')
                                ? 'text-[#E8B923] font-medium bg-[#4A7C59]/20'
                                : 'text-gray-300 hover:text-white hover:bg-[#4A7C59]/20'}"
                            on:click|preventDefault={async () => {
                              sidebarOpen.set(false);
                              if (subitem.href) await goto(subitem.href, { noScroll: true });
                            }}
                          >
                            <span class="absolute left-6 top-1/2 w-3 h-px bg-[#4A7C59]/30"></span>
                            {#if currentPath === subitem.href || currentPath.startsWith(subitem.href + '/')}
                              <span class="absolute left-2.5 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#E8B923] rounded-r-sm"></span>
                            {/if}
                            <span>{subitem.name}</span>
                          </a>
                        {/each}
                      </div>
                    </div>
                  {/if}
                </div>
              {/if}
            {:else}
              {#if !(user?.userType && item.userTypes.includes(user.userType))}
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
                    {activeNavHref === item.href && !activeSubmenuParent
                      ? 'bg-[#E8B923] text-[#0D5C29] border-[#B8860B] shadow-sm'
                      : 'text-white hover:bg-[#4A7C59]/30 hover:text-[#E8B923] hover:border-[#B8860B]/30'}"
                  on:click|preventDefault={async () => {
                    sidebarOpen.set(false);
                    if (item.href) await goto(item.href, { noScroll: true });
                  }}
                >
                  {#if typeof item.icon === 'string'}
                    {@html item.icon}
                  {:else}
                    <svelte:component this={item.icon} class="h-5 w-5" />
                  {/if}
                  <span>{item.name}</span>
                </a>
              {/if}
            {/if}
          </li>
        {/each}
      </ul>
    </nav>

    <!-- User + Logout -->
    <div class="flex-none p-4 border-t border-[#B8860B]/30 bg-[#0D5C29]">
      <div class="flex items-center space-x-3 mb-3">
        <div class="w-8 h-8 bg-[#B8860B] text-[#0D5C29] rounded-full flex items-center justify-center border border-[#E8B923]/50">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
        </div>
        <div class="overflow-hidden">
          <p class="text-sm font-medium text-white truncate">{user?.username || 'User'}</p>
          <p class="text-xs text-[#E8B923] truncate">{capitalize(user?.userType || 'guest')}</p>
        </div>
      </div>

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

        {#if showLogoutOptions && !isLoggingOut}
          <div class="absolute bottom-full left-0 right-0 mb-2 bg-[#0D5C29] border border-[#B8860B]/30 rounded-lg shadow-lg py-1 z-20">
            <button
              on:click={() => { logoutAllDevices = false; showLogoutConfirm = true; }}
              class="flex items-center space-x-2 w-full px-3 py-2 text-sm text-white hover:bg-[#4A7C59]/30 hover:text-[#E8B923] transition-colors"
            >
              <span>Logout from this device</span>
            </button>
            <button
              on:click={() => { logoutAllDevices = true; showLogoutConfirm = true; }}
              class="flex items-center space-x-2 w-full px-3 py-2 text-sm text-[#E8B923] hover:bg-[#4A7C59]/30 transition-colors"
            >
              <span>Logout from all devices</span>
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Main content area -->
  <div class="flex-1 flex flex-col overflow-hidden min-w-0">
    <!-- Header -->
    <header class="bg-white shadow-lg border-b border-[#4A7C59]/20">
      <div class="flex items-center justify-between px-3 py-3 sm:px-6 sm:py-4">
        <div class="flex items-center space-x-2 sm:space-x-4 min-w-0">
          <button
            class="mobile-menu-button lg:hidden p-2 hover:bg-[#0D5C29]/10 rounded-lg transition-colors shrink-0"
            on:click={() => sidebarOpen.set(true)}
            aria-label="Open menu"
          >
            <svg class="h-6 w-6 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <div class="h-8 w-px bg-[#4A7C59]/30 hidden lg:block"></div>
          <h1 class="text-base sm:text-2xl font-bold text-[#0D5C29] truncate">
            {#if currentPath === "/dashboard" && user?.userType}
              {capitalize(user.userType)} Dashboard
            {:else}
              {$navigation.find(nav => nav.href === currentPath)?.name || "Dashboard"}
            {/if}
          </h1>
        </div>

        <!-- Notification bell -->
        <div class="flex items-center space-x-2 sm:space-x-4 shrink-0">
          <div class="relative notification-bell">
            <button
              class="relative p-2 text-[#0D5C29] hover:text-[#E8B923] hover:bg-[#E8B923]/10 rounded-lg transition-colors"
              aria-label="Notifications"
              on:click={() => { showNotificationPanel = !showNotificationPanel; }}
            >
              <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7C18 6.279 15.464 4 12.25 4s-5.75 2.279-5.75 5.05v.7a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/>
              </svg>
              {#if unreadCount > 0}
                <span class="absolute -top-1 -right-1 h-5 w-5 bg-[#E8B923] text-white text-xs rounded-full flex items-center justify-center font-semibold shadow-sm">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              {/if}
            </button>

            {#if showNotificationPanel}
              <div class="fixed sm:absolute right-2 sm:right-0 left-2 sm:left-auto top-16 sm:top-auto sm:mt-2 w-auto sm:w-96 max-h-[calc(100vh-5rem)] bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden notification-panel">
                <div class="bg-gradient-to-r from-[#0D5C29] to-[#4A7C59] text-white px-4 py-3 flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <h3 class="font-semibold text-base sm:text-lg">Notifications</h3>
                    {#if serverNotifications.length > 0}
                      <span class="text-xs bg-white/20 px-2 py-0.5 rounded-full">{serverNotifications.length}</span>
                    {/if}
                  </div>
                  <div class="flex items-center space-x-2">
                    {#if serverNotifications.some(n => newNotifIds.has(n.id))}
                      <button on:click={markAllRead} class="text-xs text-white/80 hover:text-white underline hidden sm:block">
                        Mark all read
                      </button>
                    {/if}
                    <button on:click={() => showNotificationPanel = false} class="text-white hover:bg-white/20 rounded-full p-1" aria-label="Close notifications panel">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <div class="max-h-[28rem] overflow-y-auto">
                  {#if serverNotifications.length === 0}
                    <div class="p-4 sm:p-6 text-center text-gray-500">
                      <svg class="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7C18 6.279 15.464 4 12.25 4s-5.75 2.279-5.75 5.05v.7a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/>
                      </svg>
                      <p class="text-sm">No notifications yet</p>
                    </div>
                  {:else}
                    {@const groups = groupNotificationsByDate(serverNotifications)}
                    {#each groups as group}
                      <div class="sticky top-0 z-10 px-4 py-1.5 bg-gray-50/95 backdrop-blur-sm border-b border-gray-100">
                        <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">{group.label}</span>
                      </div>
                      <div class="divide-y divide-gray-50">
                        {#each group.items as notification (notification.id)}
                          {@const isNew = newNotifIds.has(notification.id)}
                          <div
                            class="p-3 sm:p-4 transition-colors group relative
                              {notification.actionUrl ? 'cursor-pointer hover:bg-[#0D5C29]/5 active:bg-[#0D5C29]/10' : 'hover:bg-gray-50'}
                              {isNew ? 'bg-blue-50/50' : ''}"
                            on:click={() => { if (notification.actionUrl) handleNotificationAction(notification); }}
                            role={notification.actionUrl ? 'button' : undefined}
                            tabindex={notification.actionUrl ? 0 : undefined}
                            on:keydown={(e) => { if (e.key === 'Enter' && notification.actionUrl) handleNotificationAction(notification); }}
                          >
                            {#if isNew}
                              <span class="absolute top-3.5 right-10 flex h-2 w-2">
                                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span class="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                              </span>
                            {/if}
                            <div class="flex items-start space-x-2 sm:space-x-3">
                              <div class="flex-shrink-0 mt-0.5">
                                <div class="w-7 h-7 sm:w-8 sm:h-8 {getNotificationIconColor(notification.type)} bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100">
                                  {@html getNotificationIcon(notification.type)}
                                </div>
                              </div>
                              <div class="flex-1 min-w-0">
                                {#if notification.title}
                                  <div class="flex items-center gap-2 mb-0.5 flex-wrap">
                                    <h4 class="text-sm font-semibold text-gray-900">{notification.title}</h4>
                                    {#if isNew}
                                      <span class="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full leading-none">New</span>
                                    {/if}
                                  </div>
                                {/if}
                                <p class="text-sm text-gray-700 leading-relaxed">{notification.message}</p>
                                <div class="flex items-center justify-between mt-1.5">
                                  {#if notification.timestamp}
                                    <span class="text-xs text-gray-400">{formatTimestamp(notification.timestamp)}</span>
                                  {:else}
                                    <span></span>
                                  {/if}
                                  {#if notification.actionText && notification.actionUrl}
                                    <span class="text-xs font-semibold text-[#0D5C29] flex items-center gap-0.5 group-hover:underline pointer-events-none">
                                      {notification.actionText}
                                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/>
                                      </svg>
                                    </span>
                                  {/if}
                                </div>
                              </div>
                              <button
                                on:click|stopPropagation={() => dismissNotification(notification.id)}
                                class="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all flex-shrink-0 mt-0.5 p-0.5 rounded"
                                aria-label="Dismiss"
                              >
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                              </button>
                            </div>
                          </div>
                        {/each}
                      </div>
                    {/each}
                  {/if}
                </div>

                {#if serverNotifications.length > 0}
                  <div class="border-t border-gray-100 px-4 py-2 bg-gray-50 flex items-center justify-between">
                    <span class="text-xs text-gray-400">
                      {#if newNotifIds.size > 0}{newNotifIds.size} new · {/if}{serverNotifications.length} total
                    </span>
                    <button on:click={markAllRead} class="text-xs font-medium text-[#0D5C29] hover:underline">
                      Clear all
                    </button>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </div>
      </div>
    </header>

    <!-- Page content -->
    <main class="flex-1 overflow-x-hidden overflow-y-auto bg-[#f8faf9] p-[10px] sm:p-6 relative">
      <slot />
    </main>
  </div>
</div>

<!-- Logout confirm modal -->
{#if showLogoutConfirm}
  <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" on:click={() => showLogoutConfirm = false}>
    <div class="bg-white rounded-xl shadow-2xl p-5 sm:p-6 max-w-md w-full" on:click|stopPropagation>
      <h3 class="text-lg sm:text-xl font-bold text-[#0D5C29] mb-3 sm:mb-4">Confirm Logout</h3>
      <p class="text-sm sm:text-base text-gray-600 mb-5 sm:mb-6">
        {#if logoutAllDevices}
          Are you sure you want to log out from all devices? This will end all active sessions.
        {:else}
          Are you sure you want to log out from this device?
        {/if}
      </p>
      <div class="flex space-x-3">
        <button
          on:click={() => showLogoutConfirm = false}
          class="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors text-sm sm:text-base"
        >
          Cancel
        </button>
        <button
          on:click={() => handleLogout(logoutAllDevices)}
          class="flex-1 px-4 py-2 bg-[#0D5C29] hover:bg-[#4A7C59] text-white rounded-lg transition-colors text-sm sm:text-base"
        >
          Logout
        </button>
      </div>
    </div>
  </div>
{/if}