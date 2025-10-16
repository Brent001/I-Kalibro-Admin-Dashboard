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

    type FieldState = 'default' | 'focused' | 'filled' | 'error';
    
    export let form: SetupForm = {};
    export let data: { setupRequired?: boolean } = {};
    
    const libraryName = 'Metro Dagupan Colleges Library';
    
    let isSubmitting = false;
    let showPassword = false;
    let showConfirmPassword = false;
    let passwordValue = '';
    let focusedField: string | null = null;
    
    let fieldStates: { [key: string]: FieldState } = {
        name: 'default',
        email: 'default',
        username: 'default',
        password: 'default',
        confirmPassword: 'default'
    };

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
            0: { text: '', color: 'text-gray-400', bg: 'bg-gray-200' },
            1: { text: 'Very Weak', color: 'text-red-500', bg: 'bg-red-500' },
            2: { text: 'Weak', color: 'text-orange-500', bg: 'bg-orange-500' },
            3: { text: 'Fair', color: 'text-yellow-500', bg: 'bg-yellow-500' },
            4: { text: 'Good', color: 'text-blue-500', bg: 'bg-blue-500' },
            5: { text: 'Strong', color: 'text-green-500', bg: 'bg-green-500' }
        };

        return { score, ...strength[score as keyof typeof strength], checks };
    }

    $: passwordStrength = checkPasswordStrength(passwordValue);

    function getFieldClass(fieldName: string) {
        const state = fieldStates[fieldName];
        const baseClasses = 'w-full px-3 py-2 rounded border text-sm transition-all duration-200 focus:outline-none';
        
        const states: { [key in FieldState]: string } = {
            default: `${baseClasses} border-gray-200 bg-gray-50`,
            focused: `${baseClasses} border-slate-500 bg-white ring-2 ring-slate-500/10`,
            filled: `${baseClasses} border-gray-300 bg-white`,
            error: `${baseClasses} border-red-500 bg-red-50`
        };
        
        return states[state];
    }

    function handleFieldFocus(fieldName: string) {
        focusedField = fieldName;
        fieldStates[fieldName] = 'focused';
    }

    function handleFieldBlur(fieldName: string, event: Event) {
        focusedField = null;
        const target = event.target as HTMLInputElement;
        if (form?.errorMsg) {
            fieldStates[fieldName] = 'error';
        } else if (target.value.trim()) {
            fieldStates[fieldName] = 'filled';
        } else {
            fieldStates[fieldName] = 'default';
        }
    }

    function handlePasswordInput(event: Event) {
        const target = event.target as HTMLInputElement;
        passwordValue = target.value;
    }

    // If setup is not required, redirect to login
    onMount(() => {
        if (data.setupRequired === false) {
            goto('/login', { replaceState: true });
        }
    });
</script>

<!-- Only show setup form if setup is required -->
{#if data.setupRequired !== false}
<div class="min-h-screen flex bg-gray-50">
    <!-- Left Side - Form -->
    <div class="w-full lg:w-1/2 bg-white flex flex-col justify-center p-6 sm:p-8 lg:p-10 shadow-lg">
        <div class="max-w-sm mx-auto w-full">
            <!-- Header -->
            <div class="mb-6">
                <div class="flex items-center mb-4">
                    <div class="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center mr-2.5">
                        <svg class="h-5 w-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                            <circle cx="12" cy="12" r="2"/>
                        </svg>
                    </div>
                    <div>
                        <h1 class="text-lg font-bold text-slate-900">i/Kalibro</h1>
                        <p class="text-xs text-slate-600">Library System</p>
                    </div>
                </div>
                
                <h2 class="text-xl font-bold text-gray-900">Admin Setup</h2>
                <p class="text-xs text-gray-600 mt-1">Create your administrator account</p>
            </div>

            <!-- Form -->
            <form 
                method="POST" 
                class="space-y-4"
                use:enhance={() => {
                    isSubmitting = true;
                    return async ({ result, update }) => {
                        isSubmitting = false;
                        
                        if (result.type === 'redirect') {
                            goto(result.location);
                        } else {
                            await update();
                            if (form?.errorMsg) {
                                Object.keys(fieldStates).forEach(field => {
                                    fieldStates[field] = 'error';
                                });
                            }
                        }
                    };
                }}
            >
                <!-- Full Name -->
                <div>
                    <label for="name" class="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
                    <input 
                        id="name"
                        name="name" 
                        required 
                        placeholder="John Doe"
                        value={form?.name ?? ''}
                        class={getFieldClass('name')}
                        on:focus={() => handleFieldFocus('name')}
                        on:blur={(e) => handleFieldBlur('name', e)}
                    />
                </div>
                
                <!-- Email -->
                <div>
                    <label for="email" class="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
                    <input 
                        id="email"
                        name="email" 
                        type="email" 
                        required 
                        placeholder="admin@mdc.edu.ph"
                        value={form?.email ?? ''}
                        class={getFieldClass('email')}
                        on:focus={() => handleFieldFocus('email')}
                        on:blur={(e) => handleFieldBlur('email', e)}
                    />
                </div>
                
                <!-- Username -->
                <div>
                    <label for="username" class="block text-xs font-semibold text-gray-700 mb-1">Username</label>
                    <input
                        id="username"
                        name="username"
                        required
                        placeholder="username_123"
                        value={form?.username ?? ''}
                        pattern="[a-zA-Z0-9_\-]+"
                        class={getFieldClass('username')}
                        on:focus={() => handleFieldFocus('username')}
                        on:blur={(e) => handleFieldBlur('username', e)}
                    />
                    <p class="text-xs text-gray-500 mt-1">Letters, numbers, _ and - only</p>
                </div>
                
                <!-- Password -->
                <div>
                    <label for="password" class="block text-xs font-semibold text-gray-700 mb-1">Password</label>
                    <div class="relative">
                        <input 
                            id="password"
                            name="password" 
                            type={showPassword ? 'text' : 'password'}
                            required 
                            minlength="8" 
                            placeholder="Secure password"
                            on:input={(e) => handlePasswordInput(e)}
                            on:focus={() => handleFieldFocus('password')}
                            on:blur={(e) => handleFieldBlur('password', e)}
                            class={`${getFieldClass('password')} pr-8`}
                        />
                        <button 
                            type="button"
                            class="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                            on:click={() => showPassword = !showPassword}
                        >
                            {#if showPassword}
                                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"/>
                                </svg>
                            {:else}
                                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                </svg>
                            {/if}
                        </button>
                    </div>
                    
                    <!-- Password Strength -->
                    {#if passwordValue}
                        <div class="mt-2 space-y-1.5">
                            <div class="flex space-x-1">
                                {#each Array(5) as _, i}
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
                                {passwordStrength.text}
                            </p>
                        </div>
                    {/if}
                </div>
                
                <!-- Confirm Password -->
                <div>
                    <label for="confirmPassword" class="block text-xs font-semibold text-gray-700 mb-1">Confirm Password</label>
                    <div class="relative">
                        <input 
                            id="confirmPassword"
                            name="confirmPassword" 
                            type={showConfirmPassword ? 'text' : 'password'}
                            required 
                            minlength="8" 
                            placeholder="Confirm password"
                            on:focus={() => handleFieldFocus('confirmPassword')}
                            on:blur={(e) => handleFieldBlur('confirmPassword', e)}
                            class={`${getFieldClass('confirmPassword')} pr-8`}
                        />
                        <button 
                            type="button"
                            class="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                            on:click={() => showConfirmPassword = !showConfirmPassword}
                        >
                            {#if showConfirmPassword}
                                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"/>
                                </svg>
                            {:else}
                                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                </svg>
                            {/if}
                        </button>
                    </div>
                </div>
                
                <!-- Submit Button -->
                <button 
                    type="submit" 
                    disabled={isSubmitting}
                    class="w-full mt-5 py-2.5 px-3 text-xs font-semibold rounded bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                    {#if isSubmitting}
                        <svg class="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Creating...</span>
                    {:else}
                        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z"/>
                        </svg>
                        <span>Create Account</span>
                    {/if}
                </button>
                
                <!-- Error Messages -->
                {#if form?.errorMsg}
                    <div class="bg-red-50 border border-red-200 rounded p-3 flex gap-2">
                        <svg class="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M12 2L2 22h20L12 2z"/>
                        </svg>
                        <p class="text-xs text-red-700 font-medium">{form.errorMsg}</p>
                    </div>
                {/if}

                <!-- Terms -->
                <p class="text-xs text-gray-500 text-center mt-4">
                    By creating an account, you agree to the library's terms and policies.
                </p>
            </form>
        </div>
    </div>

    <!-- Right Side - Info -->
    <div class="hidden lg:flex lg:w-1/2 bg-slate-900 relative overflow-hidden flex-col justify-center items-center p-8">
        <!-- Decorative elements -->
        <div class="absolute top-0 right-0 w-96 h-96 bg-slate-800 rounded-full blur-3xl opacity-30 -mr-32 -mt-32"></div>
        <div class="absolute bottom-0 left-0 w-96 h-96 bg-slate-800 rounded-full blur-3xl opacity-30 -ml-32 -mb-32"></div>
        
        <!-- Content -->
        <div class="relative z-10 text-center max-w-md">
            <div class="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/20">
                <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                    <circle cx="12" cy="12" r="2"/>
                </svg>
            </div>
            
            <h3 class="text-2xl font-bold text-white mb-2">{libraryName}</h3>
            <p class="text-sm text-slate-300 mb-8">Modern Library Management System</p>
            
            <!-- Features -->
            <div class="space-y-3 mb-8">
                <div class="flex items-center gap-2 text-slate-200 text-sm">
                    <svg class="h-4 w-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                    <span>Digital Catalog & Search</span>
                </div>
                <div class="flex items-center gap-2 text-slate-200 text-sm">
                    <svg class="h-4 w-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                    <span>Automated Borrowing System</span>
                </div>
                <div class="flex items-center gap-2 text-slate-200 text-sm">
                    <svg class="h-4 w-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                    <span>Real-time Inventory Tracking</span>
                </div>
                <div class="flex items-center gap-2 text-slate-200 text-sm">
                    <svg class="h-4 w-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                    <span>Reports & Analytics</span>
                </div>
            </div>
            
            <p class="text-xs text-slate-400">Secure • Reliable • Professional</p>
        </div>
    </div>
</div>
{:else}
<!-- Loading state -->
<div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="text-center">
        <div class="w-14 h-14 bg-slate-900 rounded-lg flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg class="h-7 w-7 text-white animate-spin" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0a8.003 8.003 0 0115.357 2m-15.357 0A8.001 8.001 0 009 1.25a8.003 8.003 0 016.058 2.317 8.001 8.001 0 00-1.925 5.707"/>
            </svg>
        </div>
        <h3 class="text-lg font-semibold text-gray-900 mb-1">Setup Complete</h3>
        <p class="text-sm text-gray-600">Redirecting to login page...</p>
    </div>
</div>
{/if}