<script lang="ts">
    import { enhance } from '$app/forms';
    import { page } from '$app/stores';
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
    
    const libraryName = 'Metro Dagupan Colleges Library';
    const libraryCode = 'MDC-LIB';
    
    let isSubmitting = false;
    let showPassword = false;
    let showConfirmPassword = false;
    
    // If setup is not required, redirect to login
    onMount(() => {
        if (data.setupRequired === false) {
            goto('/login', { replaceState: true });
        }
    });
    
    // Password strength indicator
    function checkPasswordStrength(password: string) {
        const checks = {
            length: password.length >= 8,
            lowercase: /[a-z]/.test(password),
            uppercase: /[A-Z]/.test(password),
            number: /\d/.test(password),
            special: /[@$!%*?&]/.test(password)
        };

        let score = 0;
        if (password) {
            score = Object.values(checks).filter(Boolean).length;
        }

        const strength = {
            0: { text: '', color: '' },
            1: { text: 'Very Weak', color: 'text-red-500' },
            2: { text: 'Weak', color: 'text-orange-500' },
            3: { text: 'Fair', color: 'text-yellow-500' },
            4: { text: 'Good', color: 'text-blue-500' },
            5: { text: 'Strong', color: 'text-green-500' }
        };

        return { score, ...strength[score as keyof typeof strength], checks };
    }
    
    let passwordValue = '';
    $: passwordStrength = checkPasswordStrength(passwordValue);
    
    // Check if setup was successful
    $: setupSuccess = $page.url.searchParams.get('setup') === 'success';
</script>

<!-- Only show setup form if setup is required -->
{#if data.setupRequired !== false}
<div class="min-h-screen flex bg-gray-50">
    <!-- Left Side - Form -->
    <div class="w-full lg:w-2/5 bg-white flex flex-col justify-center p-6 lg:p-12 shadow-lg">
        <div class="max-w-sm mx-auto w-full">
            <!-- Logo & Header -->
            <div class="mb-8">
                <div class="flex items-center mb-6">
                    <div class="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center mr-3">
                        <svg class="h-5 w-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                            <circle cx="12" cy="12" r="2"/>
                        </svg>
                    </div>
                    <div>
                        <h1 class="text-xl font-bold text-slate-900">i/Kalibro</h1>
                        <p class="text-sm text-slate-600">Library Management System</p>
                    </div>
                </div>
                
                <div>
                    <h2 class="text-2xl font-bold text-gray-900 mb-2">Administrator Setup</h2>
                    <p class="text-gray-600">Create your admin account to access the system</p>
                </div>
            </div>

            <!-- Form -->
            <form 
                method="POST" 
                class="space-y-6"
                use:enhance={() => {
                    isSubmitting = true;
                    return async ({ update }) => {
                        await update();
                        isSubmitting = false;
                    };
                }}
            >
                <div>
                    <label for="name" class="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                    <input 
                        id="name"
                        name="name" 
                        required 
                        placeholder="Enter your full name" 
                        value={form?.name ?? ''}
                        class="w-full border border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 bg-gray-50 focus:bg-white" 
                    />
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                    <input 
                        name="email" 
                        type="email" 
                        required 
                        placeholder="admin@mdc.edu.ph" 
                        value={form?.email ?? ''}
                        class="w-full border border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 bg-gray-50 focus:bg-white" 
                    />
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Username</label>
                    <input
                        name="username"
                        required
                        placeholder="Username (letters, numbers, _, - only)"
                        value={form?.username ?? ''}
                        pattern="[a-zA-Z0-9_\-]+"
                        class="w-full border border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                    />
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Password</label>
                    <div class="relative">
                        <input 
                            name="password" 
                            type={showPassword ? 'text' : 'password'}
                            required 
                            minlength="8" 
                            placeholder="Enter secure password"
                            bind:value={passwordValue}
                            class="w-full border border-gray-200 rounded-lg px-4 py-3 pr-12 focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 bg-gray-50 focus:bg-white" 
                        />
                        <button 
                            type="button"
                            class="absolute inset-y-0 right-0 pr-4 flex items-center hover:text-gray-600 transition-colors"
                            on:click={() => showPassword = !showPassword}
                        >
                            {#if showPassword}
                                <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"/>
                                </svg>
                            {:else}
                                <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                </svg>
                            {/if}
                        </button>
                    </div>
                    
                    <!-- Password Strength Indicator -->
                    {#if passwordValue}
                        <div class="mt-3">
                            <div class="flex space-x-1 mb-2">
                                {#each Array(5) as _, i}
                                    <div class="h-1.5 flex-1 rounded-full bg-gray-200">
                                        <div 
                                            class="h-full rounded-full transition-all duration-300 {
                                                i < passwordStrength.score 
                                                    ? passwordStrength.score === 5 
                                                        ? 'bg-green-500' 
                                                        : passwordStrength.score >= 4 
                                                            ? 'bg-blue-500'
                                                            : passwordStrength.score >= 3
                                                                ? 'bg-yellow-500'
                                                                : passwordStrength.score >= 2
                                                                    ? 'bg-orange-500'
                                                                    : 'bg-red-500'
                                                    : ''
                                            }"
                                        ></div>
                                    </div>
                                {/each}
                            </div>
                            <p class="text-xs {passwordStrength.color}">
                                {passwordStrength.text}
                                {#if passwordStrength.score < 5}
                                    <span class="text-gray-500">
                                        - Need: 
                                        {#if !passwordStrength.checks?.length}8+ chars, {/if}
                                        {#if !passwordStrength.checks?.lowercase}lowercase, {/if}
                                        {#if !passwordStrength.checks?.uppercase}uppercase, {/if}
                                        {#if !passwordStrength.checks?.number}number, {/if}
                                        {#if !passwordStrength.checks?.special}special char{/if}
                                    </span>
                                {/if}
                            </p>
                        </div>
                    {/if}
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
                    <div class="relative">
                        <input 
                            name="confirmPassword" 
                            type={showConfirmPassword ? 'text' : 'password'}
                            required 
                            minlength="8" 
                            placeholder="Confirm your password"
                            class="w-full border border-gray-200 rounded-lg px-4 py-3 pr-12 focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 bg-gray-50 focus:bg-white" 
                        />
                        <button 
                            type="button"
                            class="absolute inset-y-0 right-0 pr-4 flex items-center hover:text-gray-600 transition-colors"
                            on:click={() => showConfirmPassword = !showConfirmPassword}
                        >
                            {#if showConfirmPassword}
                                <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"/>
                                </svg>
                            {:else}
                                <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                </svg>
                            {/if}
                        </button>
                    </div>
                </div>
                
                <button 
                    type="submit" 
                    disabled={isSubmitting}
                    class="w-full mt-8 py-3 px-4 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center shadow-sm"
                >
                    {#if isSubmitting}
                        <svg class="animate-spin -ml-1 mr-3 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating Account...
                    {:else}
                        <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z"/>
                        </svg>
                        Create Administrator Account
                    {/if}
                </button>
                
                <!-- Error Messages -->
                {#if form?.errorMsg}
                    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div class="flex items-center">
                            <svg class="h-5 w-5 text-red-400 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M12 2L2 22h20L12 2z"/>
                            </svg>
                            <p class="text-red-700 text-sm font-medium">{form.errorMsg}</p>
                        </div>
                    </div>
                {/if}

                <!-- Terms -->
                <p class="text-xs text-gray-500 text-center mt-6">
                    By creating an account, you agree to the library's terms and policies.
                </p>
            </form>
        </div>
    </div>

    <!-- Right Side - Professional Background -->
    <div class="hidden lg:flex w-3/5 bg-gray-50 relative">
        <!-- Background Pattern -->
        <div class="absolute inset-0">
            <div class="absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-100"></div>
            <div class="absolute inset-0 opacity-[0.03]" style="background-image: radial-gradient(circle at 1px 1px, #000 1px, transparent 0); background-size: 24px 24px;"></div>
        </div>

        <!-- Main Content Area -->
        <div class="relative z-10 flex flex-col justify-center p-12 max-w-lg mx-auto text-center">
            <!-- Logo Illustration -->
            <div class="mb-8">
                <div class="w-32 h-32 mx-auto bg-white rounded-2xl shadow-lg border border-gray-200 flex items-center justify-center mb-8">
                    <svg class="w-16 h-16 text-slate-700" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                        <circle cx="12" cy="12" r="2"/>
                    </svg>
                </div>
                
                <h3 class="text-3xl font-bold text-gray-900 mb-4">{libraryName}</h3>
                <p class="text-gray-600 text-lg mb-8">Modern Library Management System</p>
                
                <!-- Features Grid -->
                <div class="grid grid-cols-3 gap-8 mb-12">
                    <div class="text-center">
                        <div class="w-14 h-14 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                            <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"/>
                            </svg>
                        </div>
                        <p class="text-sm font-medium text-gray-700">Book Management</p>
                        <p class="text-xs text-gray-500 mt-1">Comprehensive catalog system</p>
                    </div>
                    
                    <div class="text-center">
                        <div class="w-14 h-14 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                            <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/>
                            </svg>
                        </div>
                        <p class="text-sm font-medium text-gray-700">User Management</p>
                        <p class="text-xs text-gray-500 mt-1">Member & staff accounts</p>
                    </div>
                    
                    <div class="text-center">
                        <div class="w-14 h-14 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                            <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                            </svg>
                        </div>
                        <p class="text-sm font-medium text-gray-700">Reports & Analytics</p>
                        <p class="text-xs text-gray-500 mt-1">Detailed insights</p>
                    </div>
                </div>

                <!-- Additional Features -->
                <div class="bg-white/50 backdrop-blur-sm rounded-xl p-6 border border-gray-200 shadow-sm">
                    <h4 class="text-lg font-semibold text-gray-900 mb-4">Key Features</h4>
                    <div class="space-y-3 text-sm text-gray-600">
                        <div class="flex items-center">
                            <svg class="h-4 w-4 text-green-500 mr-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                            </svg>
                            <span>Digital catalog with search functionality</span>
                        </div>
                        <div class="flex items-center">
                            <svg class="h-4 w-4 text-green-500 mr-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                            </svg>
                            <span>Automated borrowing & return system</span>
                        </div>
                        <div class="flex items-center">
                            <svg class="h-4 w-4 text-green-500 mr-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                            </svg>
                            <span>Real-time inventory tracking</span>
                        </div>
                        <div class="flex items-center">
                            <svg class="h-4 w-4 text-green-500 mr-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                            </svg>
                            <span>Comprehensive reporting dashboard</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Bottom Info -->
        <div class="absolute bottom-6 left-12 right-12">
            <div class="text-center">
                <p class="text-sm text-gray-500 mb-2">Secure • Reliable • Professional</p>
                <p class="text-xs text-gray-400">Kalibro © 2025 - Library Management System</p>
            </div>
        </div>
    </div>
</div>
{:else}
<!-- Loading state while redirecting -->
<div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="text-center">
        <div class="w-16 h-16 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <svg class="h-8 w-8 text-white animate-spin" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0a8.003 8.003 0 0115.357 2m-15.357 0A8.001 8.001 0 009 1.25a8.003 8.003 0 006.058 2.317 8.001 8.001 0 00-1.925 5.707"/>
            </svg>
        </div>
        <h3 class="text-lg font-semibold text-gray-900 mb-2">Setup Complete</h3>
        <p class="text-gray-600">Redirecting to login page...</p>
    </div>
</div>
{/if}