<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';

  let errorMessage = 'An unexpected error occurred';
  let errorCode = '500';
  let showDetails = false;

  $: if ($page.error) {
    errorMessage = $page.error.message || 'An unexpected error occurred';
    errorCode = $page.status?.toString() || '500';
  }

  async function goToDashboard() {
    if (browser) {
      await goto('/dashboard', { replaceState: true });
    }
  }

  async function goHome() {
    if (browser) {
      await goto('/', { replaceState: true });
    }
  }

  function toggleDetails() {
    showDetails = !showDetails;
  }

  function getErrorTitle(code: string): string {
    const titles: Record<string, string> = {
      '404': 'Page Not Found',
      '401': 'Authentication Required',
      '403': 'Access Forbidden',
      '500': 'Server Error',
      '503': 'Service Unavailable'
    };
    return titles[code] || 'An Error Occurred';
  }

  function getErrorDescription(code: string): string {
    const descriptions: Record<string, string> = {
      '404': 'The page you\'re looking for seems to have been misplaced in the library.',
      '401': 'Please log in to access this section of the system.',
      '403': 'You don\'t have permission to access this area.',
      '500': 'Our system encountered an issue. We\'re working to resolve it.',
      '503': 'The system is temporarily unavailable for maintenance.'
    };
    return descriptions[code] || errorMessage;
  }
</script>

<svelte:head>
  <title>Error {errorCode} | e-Kalibro</title>
</svelte:head>

<div class="min-h-screen flex">
  <!-- Left side - Error Info (Desktop) / Full (Mobile) -->
  <div class="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-[#FFF9E6]">
    <div class="max-w-md w-full space-y-6">
      <div class="text-center">
        <img src="/assets/logo.png" alt="E-Kalibro Logo" class="mx-auto h-16 w-16 rounded-full object-cover" />
        <h2 class="mt-4 text-3xl font-bold text-[#0D5C29]">
          e-Kalibro System
        </h2>
        <p class="mt-2 text-sm text-gray-600">
          Metro Dagupan Colleges
        </p>
      </div>

      <!-- Error Card -->
      <div class="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
        <!-- Error Header -->
        <div class="bg-gradient-to-r from-red-500 to-red-600 px-6 py-6 text-center">
          <h1 class="text-5xl font-bold text-white mb-2">{errorCode}</h1>
          <p class="text-red-100 text-sm">{getErrorTitle(errorCode)}</p>
        </div>

        <!-- Error Content -->
        <div class="px-6 py-6">
          <p class="text-gray-600 text-center mb-6 text-sm">
            {getErrorDescription(errorCode)}
          </p>

          <!-- Error Details Toggle -->
          {#if errorMessage && !['404', '401', '403'].includes(errorCode)}
            <div class="mb-6">
              <button
                on:click={toggleDetails}
                class="text-sm text-gray-500 hover:text-gray-700 mx-auto block"
              >
                {showDetails ? 'Hide' : 'Show'} Details
              </button>

              {#if showDetails}
                <div class="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                  <p class="text-xs font-mono text-gray-600 break-all">{errorMessage}</p>
                </div>
              {/if}
            </div>
          {/if}

          <!-- Action Buttons -->
          <div class="space-y-3">
            <button
              on:click={goToDashboard}
              type="button"
              class="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#0D5C29] hover:bg-[#0D5C29]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0D5C29] transition-colors duration-200"
            >
              Back to Dashboard
            </button>
            <button
              on:click={goHome}
              type="button"
              class="w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0D5C29] transition-colors duration-200"
            >
              Go to Homepage
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-3 bg-gray-50 border-t border-gray-200">
          <p class="text-xs text-gray-500 text-center">
            Error ID: {Date.now()}
          </p>
        </div>
      </div>
    </div>
  </div>

  <!-- Right side - Help & Info (Desktop Only) -->
  <div class="hidden lg:block lg:flex-1 relative bg-gradient-to-br from-[#0D5C29] to-[#1a8c42]">
    <div class="relative flex flex-col justify-center items-center h-full p-12 text-white z-10">
      <div class="max-w-md">
        <h1 class="text-3xl font-bold mb-4">
          Need Assistance?
        </h1>
        <p class="text-lg mb-8 text-slate-200">
          We're here to help you get back on track
        </p>
        <div class="space-y-6">
          <div class="flex items-center space-x-4">
            <div class="bg-[#E8B923] p-3 rounded-full">
              <svg class="h-6 w-6 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
            </div>
            <div class="text-left">
              <h3 class="font-semibold">Contact Support</h3>
              <p class="text-sm text-slate-300">Reach out to our technical team</p>
            </div>
          </div>
          <div class="flex items-center space-x-4">
            <div class="bg-[#E8B923] p-3 rounded-full">
              <svg class="h-6 w-6 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
              </svg>
            </div>
            <div class="text-left">
              <h3 class="font-semibold">Documentation</h3>
              <p class="text-sm text-slate-300">Browse our help center</p>
            </div>
          </div>
          <div class="flex items-center space-x-4">
            <div class="bg-[#E8B923] p-3 rounded-full">
              <svg class="h-6 w-6 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </div>
            <div class="text-left">
              <h3 class="font-semibold">Try Again</h3>
              <p class="text-sm text-slate-300">Refresh or clear your cache</p>
            </div>
          </div>
        </div>

        <div class="mt-12 pt-8 border-t border-white/20">
          <p class="text-sm text-slate-300">
            e-Kalibro Library Management System
          </p>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  :global(body) {
    background-color: #FFF9E6;
    min-height: 100vh;
  }
</style>