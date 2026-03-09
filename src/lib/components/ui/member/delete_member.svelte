<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let isOpen = false;
  export let member: { name: string; email?: string; role?: string } | null = null;
  export let isLoading = false;

  const dispatch = createEventDispatcher();
  let permanent = false;

  function handleDelete() {
    dispatch('delete', { permanent });
  }

  function closeModal() {
    dispatch('close');
  }

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      closeModal();
    }
  }
</script>

{#if isOpen}
  <!-- Modal Backdrop -->
  <div 
    class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" 
    on:click={handleBackdropClick} 
    role="dialog" 
    aria-modal="true" 
    aria-labelledby="delete-member-title"
  >
    <!-- Background Overlay -->
    <div class="fixed inset-0 bg-black/60 backdrop-blur-sm transition-all duration-300"></div>
    
    <!-- Modal Container -->
    <div class="relative w-full max-w-4xl transform transition-all duration-300 scale-100">
      <!-- Modal Panel -->
      <div class="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-red-200/50 overflow-hidden">
        <form on:submit|preventDefault={handleDelete}>
          <!-- Mobile Header -->
          <div class="block md:hidden px-4 py-3 border-b border-red-200/50 bg-red-50/80">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <div class="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <svg class="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <h3 class="text-lg font-bold text-red-900" id="delete-member-title">Delete User</h3>
              </div>
              <button
                type="button"
                class="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-100/50 transition-colors duration-200"
                on:click={closeModal}
                disabled={isLoading}
                aria-label="Close"
              >
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Desktop Landscape Layout -->
          <div class="hidden md:flex">
            <!-- Left Side - Icon and Warning -->
            <div class="w-72 bg-gradient-to-br from-red-50 to-red-100/50 p-6 flex flex-col justify-center items-center border-r border-red-200/50">
              <!-- Large Warning Icon -->
              <div class="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4 shadow-lg">
                <svg class="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h3 class="text-2xl font-bold text-red-900 text-center mb-2">Delete User</h3>
              <p class="text-sm text-red-700 text-center">This action cannot be undone</p>
            </div>

            <!-- Right Side - Content and Actions -->
            <div class="flex-1 p-6">
              <!-- Close Button -->
              <div class="flex justify-end mb-4">
                <button
                  type="button"
                  class="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100/50 transition-colors duration-200"
                  on:click={closeModal}
                  disabled={isLoading}
                  aria-label="Close"
                >
                  <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <!-- Member Details -->
              {#if member}
                <div class="bg-gray-50 rounded-xl p-4 mb-4">
                  <h5 class="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                    <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    User Details
                  </h5>
                  <div class="grid grid-cols-1 gap-2">
                    <div class="flex justify-between py-1">
                      <span class="text-sm text-gray-500">Name:</span>
                      <span class="text-sm font-medium text-gray-900">{member.name}</span>
                    </div>
                    {#if member.email}
                      <div class="flex justify-between py-1">
                        <span class="text-sm text-gray-500">Email:</span>
                        <span class="text-sm font-medium text-gray-900">{member.email}</span>
                      </div>
                    {/if}
                    {#if member.role}
                      <div class="flex justify-between py-1">
                        <span class="text-sm text-gray-500">Role:</span>
                        <span class="text-sm font-medium text-gray-900 capitalize">{member.role}</span>
                      </div>
                    {/if}
                  </div>
                </div>
              {/if}

              <!-- Confirmation Message -->
              <div class="mb-6">
                <p class="text-gray-700 mb-3">
                  Are you sure you want to delete <span class="font-semibold text-gray-900">{member?.name}</span>? 
                </p>
                <div class="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p class="text-sm text-red-800">
                    <strong>This will permanently remove:</strong> Account data, permissions, activity logs, and associated records.
                  </p>
                </div>
              </div>

              <!-- Permanent Delete Option -->
              <div class="mb-4">
                <label class="inline-flex items-center">
                  <input type="checkbox" bind:checked={permanent} class="form-checkbox text-red-600" />
                  <span class="ml-2 text-sm text-red-700">Delete permanently (cannot be undone)</span>
                </label>
              </div>

              <!-- Action Buttons -->
              <div class="flex gap-3">
                <button
                  type="button"
                  on:click={closeModal}
                  disabled={isLoading}
                  class="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  class="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  disabled={isLoading}
                >
                  {#if isLoading}
                    <svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  {:else}
                    <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                    Delete User
                  {/if}
                </button>
              </div>
            </div>
          </div>

          <!-- Mobile Layout -->
          <div class="block md:hidden p-4 space-y-4">
            <!-- Warning Message -->
            <div class="text-center">
              <p class="text-gray-700 mb-3">
                Are you sure you want to delete <span class="font-semibold text-gray-900">{member?.name}</span>?
              </p>
            </div>

            <!-- Member Details -->
            {#if member}
              <div class="bg-gray-50 rounded-xl p-3">
                <h5 class="text-sm font-semibold text-gray-900 mb-2 flex items-center">
                  <svg class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  User Details
                </h5>
                <div class="space-y-1">
                  <div class="text-sm"><span class="text-gray-500">Name:</span> <span class="font-medium">{member.name}</span></div>
                  {#if member.email}
                    <div class="text-sm"><span class="text-gray-500">Email:</span> <span class="font-medium">{member.email}</span></div>
                  {/if}
                  {#if member.role}
                    <div class="text-sm"><span class="text-gray-500">Role:</span> <span class="font-medium capitalize">{member.role}</span></div>
                  {/if}
                </div>
              </div>
            {/if}

            <!-- Warning -->
            <div class="bg-red-50 border border-red-200 rounded-lg p-3">
              <p class="text-xs text-red-800">
                <strong>Warning:</strong> This will permanently remove account data, permissions, and associated records.
              </p>
            </div>

            <!-- Permanent Delete Option -->
            <div class="mb-4">
              <label class="inline-flex items-center">
                <input type="checkbox" bind:checked={permanent} class="form-checkbox text-red-600" />
                <span class="ml-2 text-sm text-red-700">Delete permanently (cannot be undone)</span>
              </label>
            </div>

            <!-- Action Buttons -->
            <div class="flex gap-3">
              <button
                type="button"
                on:click={closeModal}
                disabled={isLoading}
                class="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                disabled={isLoading}
              >
                {#if isLoading}
                  <svg class="animate-spin -ml-1 mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Deleting...
                {:else}
                  <svg class="h-3 w-3 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                  Delete
                {/if}
              </button>
            </div>
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