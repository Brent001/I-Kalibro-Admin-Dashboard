<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';

  let showPassword = false;
  let username = '';
  let password = '';
  let errorMsg = '';
  const dispatch = createEventDispatcher();

  async function handleSubmit(e: Event) {
    e.preventDefault();
    errorMsg = '';
    if (username && password) {
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) {
          // Optionally: redirect or reload
          window.location.href = '/dashboard'; // or your dashboard route
        } else {
          errorMsg = data.message || 'Login failed';
        }
      } catch (err) {
        errorMsg = 'Network error. Please try again.';
      }
    }
  }
</script>

<svelte:head>
  <title>Login | i/Kalibro Admin Portal</title>
</svelte:head>

<!-- Main Layout -->
<div class="min-h-screen flex">
  <!-- Left side - Login Form -->
  <div class="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <div class="text-center">
        <div class="mx-auto h-16 w-16 bg-slate-900 rounded-full flex items-center justify-center">
          <!-- Updated BookOpen SVG to match layout.svelte -->
          <svg class="h-8 w-8 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
            <circle cx="12" cy="12" r="2"/>
          </svg>
        </div>
        <h2 class="mt-6 text-3xl font-bold text-gray-900">
          i/Kalibro Admin Portal
        </h2>
        <p class="mt-2 text-sm text-gray-600">
          Smart Library Management System
        </p>
        <p class="text-xs text-gray-500">
          Metro Dagupan Colleges
        </p>
      </div>

      <form class="mt-8 space-y-6" on:submit|preventDefault={handleSubmit}>
        <div class="space-y-4">
          <div>
            <label for="username" class="block text-sm font-medium text-gray-700">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              bind:value={username}
              class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-slate-500 focus:border-slate-500"
              placeholder="Enter your username"
            />
          </div>
          <div>
            <label for="password" class="block text-sm font-medium text-gray-700">
              Password
            </label>
            <div class="mt-1 relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                bind:value={password}
                class="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-slate-500 focus:border-slate-500"
                placeholder="Enter your password"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 pr-3 flex items-center"
                on:click={() => showPassword = !showPassword}
                tabindex="-1"
              >
                {#if showPassword}
                  <!-- EyeOff SVG -->
                  <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M17.94 17.94A10.94 10.94 0 0112 19c-5 0-9.27-3.11-10.94-7.5a10.97 10.97 0 012.92-4.19M1 1l22 22" />
                    <path d="M9.53 9.53A3.5 3.5 0 0012 15.5a3.5 3.5 0 003.5-3.5c0-.88-.32-1.69-.85-2.32" />
                  </svg>
                {:else}
                  <!-- Eye SVG -->
                  <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                {/if}
              </button>
            </div>
          </div>
        </div>

        {#if errorMsg}
          <div class="text-red-600 text-sm mb-2">{errorMsg}</div>
        {/if}

        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              class="h-4 w-4 text-slate-600 focus:ring-slate-500 border-gray-300 rounded"
            />
            <label for="remember-me" class="ml-2 block text-sm text-gray-900">
              Remember me
            </label>
          </div>
          <div class="text-sm">
            <a href="#" class="font-medium text-slate-600 hover:text-slate-500">
              Forgot password?
            </a>
          </div>
        </div>

        <div>
          <button
            type="submit"
            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition duration-150 ease-in-out"
          >
            Sign in to Dashboard
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- Right side - Feature showcase with solid background -->
  <div class="hidden lg:block lg:flex-1 relative bg-slate-900">
    <!-- Content overlay -->
    <div class="relative flex flex-col justify-center items-center h-full p-12 text-white z-10">
      <div class="max-w-md text-center">
        <h1 class="text-4xl font-bold mb-6">
          Smart Library Management
        </h1>
        <p class="text-xl mb-8 text-slate-200">
          Streamline your library operations with our comprehensive management system
        </p>
        <div class="space-y-6">
          <div class="flex items-center space-x-4">
            <div class="bg-white bg-opacity-30 p-3 rounded-full">
              <!-- Library/Database Icon -->
              <svg class="h-6 w-6 text-slate-900" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>
              </svg>
            </div>
            <div class="text-left">
              <h3 class="font-semibold">Book Management</h3>
              <p class="text-sm text-slate-300">Organize and track your entire collection</p>
            </div>
          </div>
          <div class="flex items-center space-x-4">
            <div class="bg-white bg-opacity-30 p-3 rounded-full">
              <!-- ID Card/Badge Icon -->
              <svg class="h-6 w-6 text-slate-900" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"/>
              </svg>
            </div>
            <div class="text-left">
              <h3 class="font-semibold">Member Management</h3>
              <p class="text-sm text-slate-300">Manage students and faculty accounts</p>
            </div>
          </div>
          <div class="flex items-center space-x-4">
            <div class="bg-white bg-opacity-30 p-3 rounded-full">
              <!-- Chart/Analytics Icon -->
              <svg class="h-6 w-6 text-slate-900" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
            <div class="text-left">
              <h3 class="font-semibold">Analytics & Reports</h3>
              <p class="text-sm text-slate-300">Insights to optimize library operations</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>