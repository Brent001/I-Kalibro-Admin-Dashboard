<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let isOpen = false;

  const dispatch = createEventDispatcher();

  type StaffForm = {
    name: string;
    email: string;
    username: string;
    password: string;
    confirmPassword: string;
    role: 'admin' | 'staff';
  };

  type StaffFormErrors = {
    name?: string;
    email?: string;
    username?: string;
    password?: string;
    confirmPassword?: string;
    role?: string;
  };

  let formData: StaffForm = {
    name: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    role: 'staff'
  };

  let errors: StaffFormErrors = {};
  let isLoading = false;
  let showPassword = false;
  let showConfirmPassword = false;

  function validateForm() {
    errors = {};
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!formData.username.trim()) {
      errors.username = 'Username is required';
    } else if (formData.username.trim().length < 3) {
      errors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9._-]+$/.test(formData.username)) {
      errors.username = 'Username can only contain letters, numbers, dots, underscores, and hyphens';
    }
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      errors.password = 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
    }
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit() {
    if (!validateForm()) return;
    isLoading = true;
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const newStaff = {
        id: Date.now(),
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        username: formData.username.trim().toLowerCase(),
        role: formData.role,
        isActive: true,
        tokenVersion: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      dispatch('staffAdded', newStaff);
      resetForm();
      closeModal();
    } catch (error) {
      console.error('Error adding staff:', error);
    } finally {
      isLoading = false;
    }
  }

  function resetForm() {
    formData = {
      name: '',
      email: '',
      username: '',
      password: '',
      confirmPassword: '',
      role: 'staff'
    };
    errors = {};
    showPassword = false;
    showConfirmPassword = false;
  }

  function closeModal() {
    dispatch('close');
    resetForm();
  }

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      closeModal();
    }
  }

  function generateUsername() {
    if (formData.name.trim()) {
      const suggested = formData.name
        .trim()
        .toLowerCase()
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, '.');
      formData.username = suggested;
    }
  }

  function generateEmail() {
    if (formData.name.trim()) {
      const suggested = formData.name
        .trim()
        .toLowerCase()
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, '.');
      formData.email = `${suggested}@staff.mdc.edu.ph`;
    }
  }
</script>

{#if isOpen}
  <!-- Modal Backdrop with Blur Effect -->
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" on:click={handleBackdropClick} role="dialog" aria-modal="true" aria-labelledby="add-staff-title">
    <!-- Blurred Background Overlay -->
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm transition-all duration-300"></div>
    <!-- Modal Container -->
    <div class="relative w-full max-w-4xl max-h-[90vh] transform transition-all duration-300 scale-100">
      <!-- Modal Panel - Floating Card -->
      <div class="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200/50 overflow-hidden">
        <form on:submit|preventDefault={handleSubmit}>
          <!-- Header -->
          <div class="px-6 py-4 border-b border-slate-200/50 bg-white/80">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-xl font-bold text-slate-900" id="add-staff-title">Add New Staff Member</h3>
                <p class="text-sm text-slate-600">Create a new staff account for the library management system</p>
              </div>
              <button
                type="button"
                class="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100/50 transition-colors duration-200"
                on:click={closeModal}
                disabled={isLoading}
              >
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <!-- Form Content with Scroll and Desktop Grid -->
          <div class="px-6 py-6 max-h-[60vh] overflow-y-auto">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
              <!-- Left Column -->
              <div class="space-y-6">
                <!-- Name -->
                <div>
                  <label for="name" class="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span class="text-red-500">*</span>
                  </label>
                  <div class="relative">
                    <input
                      type="text"
                      id="name"
                      bind:value={formData.name}
                      on:blur={generateUsername}
                      class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-slate-500 focus:border-slate-500"
                      class:border-red-300={errors.name}
                      class:focus:ring-red-500={errors.name}
                      class:focus:border-red-500={errors.name}
                      placeholder="Enter full name"
                      disabled={isLoading}
                    />
                    {#if errors.name}
                      <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <svg class="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                        </svg>
                      </div>
                    {/if}
                  </div>
                  {#if errors.name}
                    <p class="mt-1 text-sm text-red-600">{errors.name}</p>
                  {/if}
                </div>
                <!-- Email -->
                <div>
                  <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
                    Email Address <span class="text-red-500">*</span>
                  </label>
                  <div class="relative">
                    <input
                      type="email"
                      id="email"
                      bind:value={formData.email}
                      class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-slate-500 focus:border-slate-500"
                      class:border-red-300={errors.email}
                      class:focus:ring-red-500={errors.email}
                      class:focus:border-red-500={errors.email}
                      placeholder="staff.member@mdc.edu.ph"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      class="absolute inset-y-0 right-0 pr-3 flex items-center text-sm text-gray-400 hover:text-gray-600"
                      on:click={generateEmail}
                      title="Auto-generate email"
                    >
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                      </svg>
                    </button>
                    {#if errors.email}
                      <div class="absolute inset-y-0 right-8 pr-3 flex items-center pointer-events-none">
                        <svg class="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                        </svg>
                      </div>
                    {/if}
                  </div>
                  {#if errors.email}
                    <p class="mt-1 text-sm text-red-600">{errors.email}</p>
                  {/if}
                </div>
                <!-- Username -->
                <div>
                  <label for="username" class="block text-sm font-medium text-gray-700 mb-1">
                    Username <span class="text-red-500">*</span>
                  </label>
                  <div class="relative">
                    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span class="text-gray-500 text-sm">@</span>
                    </div>
                    <input
                      type="text"
                      id="username"
                      bind:value={formData.username}
                      class="block w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-slate-500 focus:border-slate-500"
                      class:border-red-300={errors.username}
                      class:focus:ring-red-500={errors.username}
                      class:focus:border-red-500={errors.username}
                      placeholder="username"
                      disabled={isLoading}
                    />
                    {#if errors.username}
                      <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <svg class="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                        </svg>
                      </div>
                    {/if}
                  </div>
                  {#if errors.username}
                    <p class="mt-1 text-sm text-red-600">{errors.username}</p>
                  {:else}
                    <p class="mt-1 text-sm text-gray-500">Username must be unique and contain only letters, numbers, dots, underscores, and hyphens</p>
                  {/if}
                </div>
                <!-- Role -->
                <div>
                  <label for="role" class="block text-sm font-medium text-gray-700 mb-1">
                    Role <span class="text-red-500">*</span>
                  </label>
                  <select
                    id="role"
                    bind:value={formData.role}
                    class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-slate-500 focus:border-slate-500"
                    disabled={isLoading}
                  >
                    <option value="staff">Staff</option>
                    <option value="admin">Administrator</option>
                  </select>
                  <p class="mt-1 text-sm text-gray-500">
                    {formData.role === 'admin' ? 'Full system access and user management' : 'Standard library operations access'}
                  </p>
                </div>
              </div>
              <!-- Right Column -->
              <div class="space-y-6">
                <!-- Password -->
                <div>
                  <label for="password" class="block text-sm font-medium text-gray-700 mb-1">
                    Password <span class="text-red-500">*</span>
                  </label>
                  <div class="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      bind:value={formData.password}
                      class="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-slate-500 focus:border-slate-500"
                      class:border-red-300={errors.password}
                      class:focus:ring-red-500={errors.password}
                      class:focus:border-red-500={errors.password}
                      placeholder="Enter password"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      class="absolute inset-y-0 right-0 pr-3 flex items-center"
                      on:click={() => showPassword = !showPassword}
                    >
                      {#if showPassword}
                        <svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.464 8.464M21.536 15.536l-1.414-1.414M21.536 15.536L9.878 9.878" />
                        </svg>
                      {:else}
                        <svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      {/if}
                    </button>
                  </div>
                  {#if errors.password}
                    <p class="mt-1 text-sm text-red-600">{errors.password}</p>
                  {/if}
                </div>
                <!-- Confirm Password -->
                <div>
                  <label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password <span class="text-red-500">*</span>
                  </label>
                  <div class="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      bind:value={formData.confirmPassword}
                      class="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-slate-500 focus:border-slate-500"
                      class:border-red-300={errors.confirmPassword}
                      class:focus:ring-red-500={errors.confirmPassword}
                      class:focus:border-red-500={errors.confirmPassword}
                      placeholder="Confirm password"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      class="absolute inset-y-0 right-0 pr-3 flex items-center"
                      on:click={() => showConfirmPassword = !showConfirmPassword}
                    >
                      {#if showConfirmPassword}
                        <svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.464 8.464M21.536 15.536l-1.414-1.414M21.536 15.536L9.878 9.878" />
                        </svg>
                      {:else}
                        <svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      {/if}
                    </button>
                  </div>
                  {#if errors.confirmPassword}
                    <p class="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                  {/if}
                </div>
                <!-- Password Requirements -->
                <div class="bg-gray-50 rounded-md p-4">
                  <h4 class="text-sm font-medium text-gray-900 mb-2">Password Requirements:</h4>
                  <ul class="text-sm text-gray-600 space-y-1">
                    <li class="flex items-center">
                      <svg class="h-4 w-4 mr-2" class:text-green-500={formData.password.length >= 8} class:text-gray-400={formData.password.length < 8} fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                      </svg>
                      At least 8 characters
                    </li>
                    <li class="flex items-center">
                      <svg class="h-4 w-4 mr-2" class:text-green-500={/[A-Z]/.test(formData.password)} class:text-gray-400={!/[A-Z]/.test(formData.password)} fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                      </svg>
                      One uppercase letter
                    </li>
                    <li class="flex items-center">
                      <svg class="h-4 w-4 mr-2" class:text-green-500={/[a-z]/.test(formData.password)} class:text-gray-400={!/[a-z]/.test(formData.password)} fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                      </svg>
                      One lowercase letter
                    </li>
                    <li class="flex items-center">
                      <svg class="h-4 w-4 mr-2" class:text-green-500={/\d/.test(formData.password)} class:text-gray-400={!/\d/.test(formData.password)} fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                      </svg>
                      One number
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <!-- Footer -->
          <div class="px-6 py-4 border-t border-slate-200/50 bg-white/80 flex flex-col sm:flex-row-reverse gap-3">
            <button
              type="submit"
              class="flex-1 sm:flex-initial sm:min-w-[120px] inline-flex justify-center items-center rounded-xl border border-transparent shadow-lg px-6 py-3 bg-slate-900 text-base font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {#if isLoading}
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating...
              {:else}
                <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                </svg>
                Create Staff Account
              {/if}
            </button>
            <button
              type="button"
              on:click={closeModal}
              disabled={isLoading}
              class="flex-1 sm:flex-initial sm:min-w-[120px] inline-flex justify-center items-center rounded-xl border border-slate-300 shadow-sm px-6 py-3 bg-white/80 text-base font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}

<style>
  .overflow-y-auto::-webkit-scrollbar {
    width: 6px;
  }
  .overflow-y-auto::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 10px;
  }
  .overflow-y-auto::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 10px;
  }
  .overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.3);
  }
</style>