<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { writable } from "svelte/store";

  export let onLogout: () => void = () => {};
  
  const sidebarOpen = writable(false);

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: "📊" },
    { name: "Books", href: "/books", icon: "📚" },
    { name: "Members", href: "/members", icon: "👥" },
    { name: "Transactions", href: "/transactions", icon: "🔄" },
    { name: "Reports", href: "/reports", icon: "📈" },
    { name: "Settings", href: "/settings", icon: "⚙️" },
  ];

  let currentPath = "";
  $: currentPath = $page.url.pathname;
</script>

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
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5V6.5A2.5 2.5 0 016.5 4H20v13M4 19.5V21h16"></path>
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
              <span class="text-lg">{item.icon}</span>
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
          <svg class="h-4 w-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
        </div>
        <div>
          <p class="text-sm font-medium text-gray-900">Admin User</p>
          <p class="text-xs text-gray-500">admin@kalibro.com</p>
        </div>
      </div>
      <button
        on:click={onLogout}
        class="flex items-center space-x-2 w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors duration-200"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
        </svg>
        <span>Sign out</span>
      </button>
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
          <h1 class="text-2xl font-semibold text-gray-900">
            {navigation.find(nav => nav.href === currentPath)?.name || "Dashboard"}
          </h1>
        </div>
        <div class="flex items-center space-x-4">
          <button class="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-5 5-5-5h5V3h0z"/>
            </svg>
            <span class="absolute top-1 right-1 h-3 w-3 bg-red-500 rounded-full"></span>
          </button>
          <div class="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center">
            <svg class="h-4 w-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
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
      class="fixed inset-0 z-40 bg-black bg-opacity-25 lg:hidden"
      on:click={() => sidebarOpen.set(false)}
    ></div>
  {/if}
</div>