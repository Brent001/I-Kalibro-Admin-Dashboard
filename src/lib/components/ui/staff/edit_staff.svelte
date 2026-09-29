<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let isOpen = false;
  export let staff: any = null;
  export let permissionsList: { key: string; label: string; icon?: string }[] = [];

  const dispatch = createEventDispatcher();

  type EditFormErrors = {
    username?: string;
    password?: string;
    confirmPassword?: string;
  };

  let username = '';
  let password = '';
  let confirmPassword = '';
  let selectedPermissions: Record<string, boolean> = {};
  let errors: EditFormErrors = {};
  let isLoading = false;
  let showPassword = false;
  let showConfirmPassword = false;

  // When modal opens or staff changes, load current values
  $: if (isOpen && staff && staff.uniqueId) {
    username = staff.username ?? '';
    password = '';
    confirmPassword = '';
    errors = {};

    selectedPermissions = {};
    if (staff.permissions && typeof staff.permissions === 'object') {
      Object.entries(staff.permissions).forEach(([perm, val]) => {
        if (val) selectedPermissions[perm] = true;
      });
    }
  }

  $: if (!isOpen) {
    resetTransient();
  }

  function resetTransient() {
    password = '';
    confirmPassword = '';
    errors = {};
    isLoading = false;
    showPassword = false;
    showConfirmPassword = false;
  }

  function validateForm() {
    errors = {};
    if (!username.trim()) {
      errors.username = 'Username is required';
    } else if (username.trim().length < 3) {
      errors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
      errors.username = 'Username can only contain letters, numbers, dots, underscores, and hyphens';
    }

    if (password || confirmPassword) {
      if (password.length < 8) {
        errors.password = 'Password must be at least 8 characters';
      } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
        errors.password = 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
      }
      if (!confirmPassword) {
        errors.confirmPassword = 'Please confirm the new password';
      } else if (password !== confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
    }

    return Object.keys(errors).length === 0;
  }

  function handleSubmit() {
    if (!validateForm()) return;
    isLoading = true;

    // build boolean permission object
    const permsObj: Record<string, boolean> = {};
    permissionsList.forEach(p => {
      permsObj[p.key] = selectedPermissions[p.key] || false;
    });

    dispatch('editStaff', {
      uniqueId: staff.uniqueId,
      id: staff.id,
      username,
      password: password || undefined,
      permissions: staff.role === 'staff' ? permsObj : {}
    });

    isLoading = false;
  }

  function closeModal() {
    if (!isLoading) {
      dispatch('close');
      resetTransient();
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      closeModal();
    }
  }
</script>

{#if isOpen && staff}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <button
      class="fixed inset-0 bg-black/50 backdrop-blur-sm cursor-default"
      onclick={!isLoading ? closeModal : null}
      disabled={isLoading}
      aria-label="Close modal"
      type="button"
    ></button>

    <div class="relative w-full max-w-5xl transform transition-all duration-300 scale-100">
      <div class="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-[#4A7C59]/30 overflow-hidden flex flex-col h-[90vh]">
        <form onsubmit={(event) => { event.preventDefault(); handleSubmit(); }} class="flex flex-col h-full">

          <!-- ── Header ── -->
          <div class="px-6 py-4 border-b border-[#4A7C59]/20 bg-white/80 flex-shrink-0">
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <div class="flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-[#0D5C29] to-[#4A7C59] shadow-lg flex-shrink-0">
                  <svg class="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                </div>
                <div class="min-w-0">
                  <h3 class="text-lg sm:text-xl font-bold text-[#0D5C29] truncate">Edit Staff: {staff.name}</h3>
                  <p class="text-xs sm:text-sm text-[#4A7C59] hidden sm:block">Update account details and permissions</p>
                </div>
              </div>
              <button
                type="button" onclick={closeModal}
                disabled={isLoading}
                aria-label="Close modal"
                class="p-2 rounded-lg text-gray-400 hover:text-[#0D5C29] hover:bg-[#0D5C29]/10 transition-colors duration-200 disabled:opacity-50 flex-shrink-0"
              >
                <svg class="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- ── Body ── -->
          <div class="px-6 py-6 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
            <div class="space-y-5">

              <!-- ══ SECTION 1: Account Information ══ -->
              <div class="bg-[#f8faf9] border border-[#4A7C59]/20 rounded-xl p-4 sm:p-5">
                <div class="flex items-center gap-2 mb-4">
                  <svg class="h-5 w-5 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                  <h4 class="text-base sm:text-lg font-semibold text-[#0D5C29]">Account Information</h4>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">

                  <!-- Username -->
                  <div class="sm:col-span-2">
                    <label for="username-edit" class="block text-xs font-medium text-gray-500 mb-1">Username <span class="text-red-400">*</span></label>
                    <div class="relative">
                      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span class="text-gray-400 text-sm">@</span>
                      </div>
                      <input
                        type="text" id="username-edit" bind:value={username}
                        disabled={isLoading}
                        placeholder="username"
                        autocomplete="username"
                        class="w-full pl-7 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white {errors.username ? 'border-red-300 bg-red-50' : 'border-gray-300'}"
                      />
                    </div>
                    {#if errors.username}
                      <p class="text-red-600 text-xs mt-1">{errors.username}</p>
                    {:else}
                      <p class="text-xs text-gray-400 mt-1">Letters, numbers, dots, underscores, and hyphens only</p>
                    {/if}
                  </div>

                  <!-- Read-only info -->
                  <div class="sm:col-span-2">
                    <div class="text-xs text-[#0D5C29] bg-[#E8B923]/10 p-2.5 rounded-lg border border-[#E8B923]/30 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span>Role: <span class="font-semibold capitalize">{staff.role}</span></span>
                      {#if staff.email}<span>Email: <span class="font-mono">{staff.email}</span></span>{/if}
                    </div>
                  </div>

                </div>
              </div>

              <!-- ══ SECTION 2: Security ══ -->
              <div class="bg-[#f8faf9] border border-[#4A7C59]/20 rounded-xl p-4 sm:p-5">
                <div class="flex items-center gap-2 mb-4">
                  <svg class="h-5 w-5 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                  <h4 class="text-base sm:text-lg font-semibold text-[#0D5C29]">Security</h4>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">

                  <!-- Password -->
                  <div>
                    <label for="password-edit" class="block text-xs font-medium text-gray-500 mb-1">New Password <span class="text-gray-400">(optional)</span></label>
                    <div class="relative">
                      <input
                        type={showPassword ? 'text' : 'password'} id="password-edit" bind:value={password}
                        disabled={isLoading}
                        placeholder="Leave blank to keep current"
                        autocomplete="new-password"
                        class="w-full pl-3 pr-9 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white {errors.password ? 'border-red-300 bg-red-50' : 'border-gray-300'}"
                      />
                      <button
                        type="button"
                        class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-[#0D5C29] transition-colors"
                        onclick={() => showPassword = !showPassword}
                        tabindex="-1"
                      >
                        {#if showPassword}
                          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.464 8.464M21.536 15.536l-1.414-1.414M21.536 15.536L9.878 9.878"/>
                          </svg>
                        {:else}
                          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                          </svg>
                        {/if}
                      </button>
                    </div>
                    {#if errors.password}<p class="text-red-600 text-xs mt-1">{errors.password}</p>{/if}
                  </div>

                  <!-- Confirm Password -->
                  <div>
                    <label for="confirmPassword-edit" class="block text-xs font-medium text-gray-500 mb-1">Confirm Password</label>
                    <div class="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'} id="confirmPassword-edit" bind:value={confirmPassword}
                        disabled={isLoading}
                        placeholder="Confirm new password"
                        autocomplete="new-password"
                        class="w-full pl-3 pr-9 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white {errors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-gray-300'}"
                      />
                      <button
                        type="button"
                        class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-[#0D5C29] transition-colors"
                        onclick={() => showConfirmPassword = !showConfirmPassword}
                        tabindex="-1"
                      >
                        {#if showConfirmPassword}
                          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.464 8.464M21.536 15.536l-1.414-1.414M21.536 15.536L9.878 9.878"/>
                          </svg>
                        {:else}
                          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                          </svg>
                        {/if}
                      </button>
                    </div>
                    {#if errors.confirmPassword}<p class="text-red-600 text-xs mt-1">{errors.confirmPassword}</p>{/if}
                  </div>

                  <!-- Password Requirements -->
                  {#if password || confirmPassword}
                    <div class="sm:col-span-2 bg-white border border-gray-200 rounded-lg p-3">
                      <p class="text-xs font-medium text-gray-500 mb-2">Password Requirements</p>
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        <div class="flex items-center text-xs" class:text-[#0D5C29]={password.length >= 8} class:text-gray-400={password.length < 8}>
                          <svg class="h-3.5 w-3.5 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                          </svg>
                          At least 8 characters
                        </div>
                        <div class="flex items-center text-xs" class:text-[#0D5C29]={/[A-Z]/.test(password)} class:text-gray-400={!/[A-Z]/.test(password)}>
                          <svg class="h-3.5 w-3.5 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                          </svg>
                          One uppercase letter
                        </div>
                        <div class="flex items-center text-xs" class:text-[#0D5C29]={/[a-z]/.test(password)} class:text-gray-400={!/[a-z]/.test(password)}>
                          <svg class="h-3.5 w-3.5 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                          </svg>
                          One lowercase letter
                        </div>
                        <div class="flex items-center text-xs" class:text-[#0D5C29]={/\d/.test(password)} class:text-gray-400={!/\d/.test(password)}>
                          <svg class="h-3.5 w-3.5 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                          </svg>
                          One number
                        </div>
                      </div>
                    </div>
                  {/if}

                </div>
              </div>

              <!-- ══ SECTION 3: Dashboard Access Permissions ══ -->
              {#if staff.role === 'staff' && permissionsList.length > 0}
                <div class="bg-[#f8faf9] border border-[#4A7C59]/20 rounded-xl p-4 sm:p-5">
                  <div class="flex items-center justify-between gap-2 mb-4">
                    <div class="flex items-center gap-2">
                      <svg class="h-5 w-5 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                      </svg>
                      <h4 class="text-base sm:text-lg font-semibold text-[#0D5C29]">Dashboard Access Permissions</h4>
                    </div>
                    <span class="text-xs bg-[#E8B923]/20 text-[#0D5C29] px-2.5 py-0.5 rounded-full font-semibold flex-shrink-0">
                      {Object.values(selectedPermissions).filter(Boolean).length} / {permissionsList.length}
                    </span>
                  </div>

                  <div class="mb-3 flex items-center justify-between border-b border-[#4A7C59]/20 pb-3">
                    <span class="text-xs font-medium text-slate-600">Current permission set</span>
                    <div class="flex gap-2">
                      <button type="button" onclick={() => { permissionsList.forEach(p => selectedPermissions[p.key] = true); selectedPermissions = selectedPermissions; }} class="text-xs font-medium text-[#0D5C29]" disabled={isLoading}>Select all</button>
                      <button type="button" onclick={() => { permissionsList.forEach(p => selectedPermissions[p.key] = false); selectedPermissions = selectedPermissions; }} class="text-xs font-medium text-slate-500" disabled={isLoading}>Clear all</button>
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {#each permissionsList as perm}
                      <label class="flex items-start gap-2 cursor-pointer group p-2 rounded-lg bg-white border border-gray-200 hover:border-[#4A7C59]/40 transition-colors">
                        <input type="checkbox" bind:checked={selectedPermissions[perm.key]} class="h-4 w-4 text-[#0D5C29] border-gray-300 rounded focus:ring-2 focus:ring-[#0D5C29] mt-0.5 flex-shrink-0" disabled={isLoading} />
                        <span class="text-xs text-gray-700 group-hover:text-[#0D5C29] font-medium leading-tight flex-1">{perm.label}</span>
                      </label>
                    {/each}
                  </div>

                  <!-- Info -->
                  <div class="text-xs text-[#0D5C29] bg-[#E8B923]/10 p-2.5 rounded-lg border border-[#E8B923]/30 mt-3">
                    Staff members can only access sections that are checked. Unchecked sections will be hidden from their dashboard.
                  </div>
                </div>
              {/if}

            </div>
          </div>

          <!-- ── Footer ── -->
          <div class="px-6 py-4 border-t border-[#4A7C59]/20 bg-white/80 flex flex-col sm:flex-row-reverse gap-3 flex-shrink-0">
            <button
              type="submit"
              disabled={isLoading}
              class="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-gradient-to-r from-[#0D5C29] to-[#4A7C59] text-sm font-semibold text-white hover:from-[#0A4520] hover:to-[#3D664A] shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {#if isLoading}
                <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Saving…
              {:else}
                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                </svg>
                Save Changes
              {/if}
            </button>
            <button
              type="button" onclick={closeModal}
              disabled={isLoading}
              class="w-full sm:w-auto px-6 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
  .custom-scrollbar::-webkit-scrollbar { width: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,.05); border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(74,124,89,.3); border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(74,124,89,.5); }
</style>