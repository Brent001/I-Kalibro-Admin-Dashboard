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
<div class="min-h-screen flex">
    <!-- Left Side - Form -->
    <div class="w-full lg:w-2/5 bg-white flex flex-col justify-center p-6 lg:p-12">
        <div class="max-w-sm mx-auto w-full">
            <!-- Logo & Header -->
            <div class="mb-8">
                <div class="flex items-center mb-6">
                    <div class="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center mr-3">
                        <svg class="h-5 w-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5V6.5A2.5 2.5 0 016.5 4H20v13M4 19.5V21h16"></path>
                        </svg>
                    </div>
                    <div>
                        <h1 class="text-xl font-semibold text-slate-900">i/Kalibro</h1>
                        <p class="text-sm text-slate-600">Library Management</p>
                    </div>
                </div>
                
                <div>
                    <h2 class="text-2xl font-bold text-slate-900 mb-2">Administrator Setup</h2>
                    <p class="text-slate-600">Create your admin account to access the system</p>
                </div>
            </div>

            <!-- Form -->
            <form 
                method="POST" 
                class="space-y-4"
                use:enhance={() => {
                    isSubmitting = true;
                    return async ({ update }) => {
                        await update();
                        isSubmitting = false;
                    };
                }}
            >
                <div>
                    <label for="name" class="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                    <input 
                        id="name"
                        name="name" 
                        required 
                        placeholder="Enter your full name" 
                        value={form?.name ?? ''}
                        class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors" 
                    />
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                    <input 
                        name="email" 
                        type="email" 
                        required 
                        placeholder="admin@mdc.edu.ph" 
                        value={form?.email ?? ''}
                        class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors" 
                    />
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-2">Username</label>
                    <input
                        name="username"
                        required
                        placeholder="Username (letters, numbers, _, - only)"
                        value={form?.username ?? ''}
                        pattern="[a-zA-Z0-9_-]+"
                        class="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors"
                    />
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-2">Password</label>
                    <div class="relative">
                        <input 
                            name="password" 
                            type={showPassword ? 'text' : 'password'}
                            required 
                            minlength="8" 
                            placeholder="Password"
                            bind:value={passwordValue}
                            class="w-full border rounded-lg px-3 py-2 pr-10 focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors" 
                        />
                        <button 
                            type="button"
                            class="absolute inset-y-0 right-0 pr-3 flex items-center"
                            on:click={() => showPassword = !showPassword}
                        >
                            <svg class="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {#if showPassword}
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"></path>
                                {:else}
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                {/if}
                            </svg>
                        </button>
                    </div>
                    
                    <!-- Password Strength Indicator -->
                    {#if passwordValue}
                        <div class="mt-2">
                            <div class="flex space-x-1 mb-1">
                                {#each Array(5) as _, i}
                                    <div class="h-1 flex-1 rounded-full bg-slate-200">
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
                                    <span class="text-slate-500">
                                        - Need: 
                                        {#if !passwordStrength.checks?.length}length 8+, {/if}
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
                    <label class="block text-sm font-medium text-slate-700 mb-2">Confirm Password</label>
                    <div class="relative">
                        <input 
                            name="confirmPassword" 
                            type={showConfirmPassword ? 'text' : 'password'}
                            required 
                            minlength="8" 
                            placeholder="Confirm Password"
                            class="w-full border rounded-lg px-3 py-2 pr-10 focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors" 
                        />
                        <button 
                            type="button"
                            class="absolute inset-y-0 right-0 pr-3 flex items-center"
                            on:click={() => showConfirmPassword = !showConfirmPassword}
                        >
                            <svg class="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {#if showConfirmPassword}
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"></path>
                                {:else}
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                {/if}
                            </svg>
                        </button>
                    </div>
                </div>
                
                <button 
                    type="submit" 
                    disabled={isSubmitting}
                    class="w-full mt-6 py-3 px-4 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                    {#if isSubmitting}
                        <svg class="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating Account...
                    {:else}
                        Create Administrator Account
                    {/if}
                </button>
                
                <!-- Error Messages -->
                {#if form?.errorMsg}
                    <div class="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p class="text-red-600 text-sm">{form.errorMsg}</p>
                    </div>
                {/if}

                <!-- Terms -->
                <p class="text-xs text-slate-500 text-center mt-4">
                    By creating an account, you agree to the library's terms and policies.
                </p>
            </form>
        </div>
    </div>

    <!-- Right Side - Clean Professional Background -->
    <div class="hidden lg:flex w-3/5 bg-slate-50 relative">
        <!-- Minimal Background Pattern -->
        <div class="absolute inset-0">
            <div class="absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-100"></div>
            <!-- Subtle Grid Pattern -->
            <div class="absolute inset-0 opacity-[0.02]" style="background-image: radial-gradient(circle at 1px 1px, #000 1px, transparent 0); background-size: 24px 24px;"></div>
        </div>

        <!-- Main Content Area -->
        <div class="relative z-10 flex flex-col justify-center p-12 max-w-lg mx-auto text-center">
            <!-- Clean Building Illustration -->
            <div class="mb-8">
                <div class="w-32 h-32 mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center mb-6">
                    <svg class="w-16 h-16 text-slate-700" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M6.75 7.364V3h-1.5m1.5 4.364l6-2.182 6 2.182M21 14.25v5.25H3v-5.25M21 10.75H3"/>
                    </svg>
                </div>
                
                <h3 class="text-2xl font-bold text-slate-900 mb-3">{libraryName}</h3>
                <p class="text-slate-600 text-lg mb-6">Modern Library Management System</p>
                
                <!-- Clean Stats/Features -->
                <div class="grid grid-cols-3 gap-6 mb-8">
                    <div class="text-center">
                        <div class="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center mx-auto mb-2">
                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"/>
                            </svg>
                        </div>
                        <p class="text-xs font-medium text-slate-700">Book Management</p>
                    </div>
                    
                    <div class="text-center">
                        <div class="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center mx-auto mb-2">
                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/>
                            </svg>
                        </div>
                        <p class="text-xs font-medium text-slate-700">User Management</p>
                    </div>
                    
                    <div class="text-center">
                        <div class="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center mx-auto mb-2">
                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z"/>
                            </svg>
                        </div>
                        <p class="text-xs font-medium text-slate-700">Reports & Analytics</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Bottom Info -->
        <div class="absolute bottom-6 left-12 right-12">
            <div class="text-center">
                <p class="text-sm text-slate-500">Secure • Reliable • Professional</p>
                <p class="text-xs text-slate-400 mt-1">Kalibro © 2025 - Library Management System</p>
            </div>
        </div>
    </div>
</div>
{:else}
<!-- Loading state while redirecting -->
<div class="min-h-screen flex items-center justify-center bg-slate-50">
    <div class="text-center">
        <div class="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center mx-auto mb-4">
            <svg class="h-6 w-6 text-white animate-spin" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0a8.003 8.003 0 0115.357 2m-7.478 11c-.392.027-.783.044-1.179.044-4.418 0-8-3.582-8-8 0-1.061.207-2.074.581-3m6.96 2.481a3 3 0 113.397 3.397 7.001 7.001 0 01-9.933 1.05"/>
            </svg>
        </div>
        <p class="text-slate-600">Setup already completed. Redirecting to login...</p>
    </div>
</div>
{/if}