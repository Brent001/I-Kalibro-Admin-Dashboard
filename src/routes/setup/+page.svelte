<script lang="ts">
    import { enhance } from '$app/forms';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';
    
    type SetupForm = {
        name?: string;
        email?: string;
        username?: string;
        errorMsg?: string;
    };
    
    export let form: SetupForm = {};
    export let data: { setupRequired?: boolean } = {};
    
    let isSubmitting = false;
    let showPassword = false;
    let showConfirmPassword = false;
    let passwordValue = '';

    // Password strength indicator
    function checkPasswordStrength(password: string) {
        const checks = {
            length: password.length >= 8,
            lowercase: /[a-z]/.test(password),
            uppercase: /[A-Z]/.test(password),
            number: /\d/.test(password)
        };

        let score = 0;
        if (password) {
            score = Object.values(checks).filter(Boolean).length;
        }

        const strength = {
            0: { text: '', color: 'text-gray-400', bg: 'bg-gray-200' },
            1: { text: 'Very Weak', color: 'text-red-500', bg: 'bg-red-500' },
            2: { text: 'Weak', color: 'text-orange-500', bg: 'bg-orange-500' },
            3: { text: 'Fair', color: 'text-yellow-500', bg: 'bg-yellow-500' },
            4: { text: 'Strong', color: 'text-green-500', bg: 'bg-green-500' }
        };

        return { score, ...strength[score as keyof typeof strength], checks };
    }

    $: passwordStrength = checkPasswordStrength(passwordValue);

    // If setup is not required, redirect to login
    onMount(() => {
        if (data.setupRequired === false) {
            goto('/login', { replaceState: true });
        }
    });
</script>

<svelte:head>
  <title>System Setup | e-Kalibro Admin Portal</title>
</svelte:head>

<!-- Only show setup form if setup is required -->
{#if data.setupRequired !== false}
<div class="min-h-screen flex">
  <!-- Left side - Setup Form -->
  <div class="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-[#FFF9E6]">
    <div class="max-w-md w-full space-y-6">
      <!-- Header -->
      <div class="text-center">
        <h2 class="text-3xl font-bold text-[#0D5C29]">
          System Setup
        </h2>
        <p class="mt-2 text-sm text-gray-600">
          Create your administrator account
        </p>
        <p class="text-xs text-gray-500 mt-1">
          Metro Dagupan Colleges
        </p>
      </div>

      <!-- Form -->
      <form 
        method="POST" 
        class="mt-6 space-y-4"
        use:enhance={() => {
          isSubmitting = true;
          return async ({ result, update }) => {
            isSubmitting = false;
            
            if (result.type === 'redirect') {
              goto(result.location);
            } else {
              await update();
            }
          };
        }}
      >
        <div class="space-y-3">
          <!-- Full Name -->
          <div>
            <label for="name" class="block text-sm font-medium text-[#0D5C29]">
              Full Name
            </label>
            <input 
              id="name"
              name="name" 
              type="text"
              required 
              placeholder="John Doe"
              value={form?.name ?? ''}
              class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#0D5C29] focus:border-[#0D5C29]"
            />
          </div>
          
          <!-- Email -->
          <div>
            <label for="email" class="block text-sm font-medium text-[#0D5C29]">
              Email Address
            </label>
            <input 
              id="email"
              name="email" 
              type="email" 
              required 
              placeholder="admin@library.edu.ph"
              value={form?.email ?? ''}
              class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#0D5C29] focus:border-[#0D5C29]"
            />
          </div>
          
          <!-- Username -->
          <div>
            <label for="username" class="block text-sm font-medium text-[#0D5C29]">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              minlength="3"
              placeholder="admin_username"
              value={form?.username ?? ''}
              class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#0D5C29] focus:border-[#0D5C29]"
            />
            <p class="text-xs text-gray-500 mt-1">At least 3 characters</p>
          </div>
          
          <!-- Password -->
          <div>
            <label for="password" class="block text-sm font-medium text-[#0D5C29]">
              Password
            </label>
            <div class="mt-1 relative">
              <input 
                id="password"
                name="password" 
                type={showPassword ? 'text' : 'password'}
                required 
                minlength="8" 
                placeholder="Enter secure password"
                bind:value={passwordValue}
                class="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#0D5C29] focus:border-[#0D5C29]"
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
            
            <!-- Password Strength -->
            {#if passwordValue}
              <div class="mt-2 space-y-1.5">
                <div class="flex space-x-1">
                  {#each Array(4) as _, i}
                    <div class="h-1 flex-1 rounded-full bg-gray-200">
                      <div 
                        class="h-full rounded-full transition-all duration-300 {
                          i < passwordStrength.score 
                            ? passwordStrength.bg
                            : ''
                        }"
                      ></div>
                    </div>
                  {/each}
                </div>
                <p class="text-xs {passwordStrength.color} font-medium">
                  {passwordStrength.text || 'Enter a password'}
                </p>
              </div>
            {/if}
          </div>
          
          <!-- Confirm Password -->
          <div>
            <label for="confirmPassword" class="block text-sm font-medium text-[#0D5C29]">
              Confirm Password
            </label>
            <div class="mt-1 relative">
              <input 
                id="confirmPassword"
                name="confirmPassword" 
                type={showConfirmPassword ? 'text' : 'password'}
                required 
                minlength="8" 
                placeholder="Confirm password"
                class="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#0D5C29] focus:border-[#0D5C29]"
              />
              <button 
                type="button"
                class="absolute inset-y-0 right-0 pr-3 flex items-center"
                on:click={() => showConfirmPassword = !showConfirmPassword}
                tabindex="-1"
              >
                {#if showConfirmPassword}
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

        <!-- Error Messages -->
        {#if form?.errorMsg}
          <div class="text-red-600 text-sm">{form.errorMsg}</div>
        {/if}

        <!-- Submit Button -->
        <div class="pt-2">
          <button 
            type="submit" 
            disabled={isSubmitting}
            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#0D5C29] hover:bg-[#0D5C29]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0D5C29] disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {#if isSubmitting}
              <svg class="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating Account...
            {:else}
              Create Super Admin Account
            {/if}
          </button>
        </div>

        <!-- Terms -->
        <p class="text-xs text-gray-500 text-center pt-2">
          By creating an account, you agree to the library's terms and policies.
        </p>
      </form>
    </div>
  </div>

  <!-- Right side - Feature showcase -->
  <div class="hidden lg:block lg:flex-1 relative bg-gradient-to-br from-[#0D5C29] to-[#1a8c42]">
    <!-- Content overlay -->
    <div class="relative flex flex-col justify-center items-center h-full p-12 text-white z-10">
      <div class="max-w-md text-center">
        <img src="/assets/logo.png" alt="E-Kalibro Logo" class="mx-auto h-20 w-20 rounded-full object-cover mb-6 shadow-lg ring-4 ring-white/20" />
        <h1 class="text-4xl font-bold mb-6">
          Welcome to e-Kalibro
        </h1>
        <p class="text-xl mb-8 text-slate-200">
          Modern library management system for Metro Dagupan Colleges
        </p>
        <div class="space-y-6">
          <div class="flex items-center space-x-4">
            <div class="bg-[#E8B923] p-3 rounded-full">
              <!-- Shield Check Icon -->
              <svg class="h-6 w-6 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
              </svg>
            </div>
            <div class="text-left">
              <h3 class="font-semibold">Secure Administration</h3>
              <p class="text-sm text-slate-300">Full control over system settings</p>
            </div>
          </div>
          <div class="flex items-center space-x-4">
            <div class="bg-[#E8B923] p-3 rounded-full">
              <!-- Users Icon -->
              <svg class="h-6 w-6 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
              </svg>
            </div>
            <div class="text-left">
              <h3 class="font-semibold">User Management</h3>
              <p class="text-sm text-slate-300">Manage staff and member accounts</p>
            </div>
          </div>
          <div class="flex items-center space-x-4">
            <div class="bg-[#E8B923] p-3 rounded-full">
              <!-- Cog Icon -->
              <svg class="h-6 w-6 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            <div class="text-left">
              <h3 class="font-semibold">System Configuration</h3>
              <p class="text-sm text-slate-300">Customize library operations</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
{:else}
<!-- Loading state -->
<div class="min-h-screen flex items-center justify-center bg-[#FFF9E6]">
  <div class="text-center">
    <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#0D5C29]"></div>
    <h3 class="mt-4 text-lg font-semibold text-gray-900">Setup Complete</h3>
    <p class="text-sm text-gray-600">Redirecting to login page...</p>
  </div>
</div>
{/if}