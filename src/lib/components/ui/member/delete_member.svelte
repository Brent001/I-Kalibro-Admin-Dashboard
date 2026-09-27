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
    if (!isLoading) {
      dispatch('close');
      permanent = false;
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      closeModal();
    }
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <button
      class="fixed inset-0 bg-black/50 backdrop-blur-sm cursor-default"
      onclick={!isLoading ? closeModal : null}
      disabled={isLoading}
      aria-label="Close modal"
      type="button"
    ></button>

    <div class="relative w-full max-w-lg transform transition-all duration-300 scale-100">
      <div class="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-red-200/60 overflow-hidden">
        <form onsubmit={(event) => { event.preventDefault(); handleDelete(); }}>

          <!-- ── Header ── -->
          <div class="px-6 py-4 border-b border-red-200/50 bg-white/80 flex-shrink-0">
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <div class="flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-red-600 to-red-500 shadow-lg flex-shrink-0">
                  <svg class="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
                  </svg>
                </div>
                <div class="min-w-0">
                  <h3 class="text-lg sm:text-xl font-bold text-red-900 truncate">Delete User</h3>
                  <p class="text-xs sm:text-sm text-red-600 hidden sm:block">This action cannot be undone</p>
                </div>
              </div>
              <button
                type="button" onclick={closeModal}
                disabled={isLoading}
                aria-label="Close modal"
                class="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-100/60 transition-colors duration-200 disabled:opacity-50 flex-shrink-0"
              >
                <svg class="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- ── Body ── -->
          <div class="px-6 py-5 space-y-4">

            <p class="text-sm text-gray-700">
              Are you sure you want to delete <span class="font-semibold text-gray-900">{member?.name}</span>?
            </p>

            {#if member}
              <div class="bg-[#f8faf9] border border-[#4A7C59]/20 rounded-xl p-4">
                <h5 class="text-xs font-semibold text-[#0D5C29] uppercase tracking-wide mb-3 flex items-center gap-2">
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                  User Details
                </h5>
                <div class="space-y-1.5">
                  <div class="flex justify-between text-sm">
                    <span class="text-gray-500">Name</span>
                    <span class="font-medium text-gray-900">{member.name}</span>
                  </div>
                  {#if member.email}
                    <div class="flex justify-between text-sm">
                      <span class="text-gray-500">Email</span>
                      <span class="font-medium text-gray-900">{member.email}</span>
                    </div>
                  {/if}
                  {#if member.role}
                    <div class="flex justify-between text-sm">
                      <span class="text-gray-500">Role</span>
                      <span class="font-medium text-gray-900 capitalize">{member.role}</span>
                    </div>
                  {/if}
                </div>
              </div>
            {/if}

            <div class="bg-red-50 border border-red-200 rounded-lg p-3">
              <p class="text-xs text-red-800">
                <strong>This will permanently remove:</strong> Account data, permissions, activity logs, and associated records.
              </p>
            </div>

            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" bind:checked={permanent} disabled={isLoading} class="h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-2 focus:ring-red-500" />
              <span class="text-sm text-red-700">Delete permanently (cannot be undone)</span>
            </label>

          </div>

          <!-- ── Footer ── -->
          <div class="px-6 py-4 border-t border-red-200/50 bg-white/80 flex flex-col sm:flex-row-reverse gap-3">
            <button
              type="submit"
              disabled={isLoading}
              class="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-red-600 text-sm font-semibold text-white hover:bg-red-700 shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {#if isLoading}
                <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Deleting…
              {:else}
                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/>
                </svg>
                Delete User
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