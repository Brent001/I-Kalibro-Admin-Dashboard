<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let isOpen = false;
  export let member: { name: string } | null = null;
  export let isLoading = false;

  const dispatch = createEventDispatcher();

  function handleDelete() {
    dispatch('delete');
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
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" on:click={handleBackdropClick} role="dialog" aria-modal="true" aria-labelledby="delete-member-title">
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm transition-all duration-300"></div>
    <div class="relative w-full max-w-lg max-h-[90vh] transform transition-all duration-300 scale-100">
      <div class="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200/50 overflow-hidden">
        <form on:submit|preventDefault={handleDelete}>
          <!-- Header -->
          <div class="px-6 py-4 border-b border-slate-200/50 bg-white/80">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-xl font-bold text-slate-900" id="delete-member-title">Delete Member</h3>
                <p class="text-sm text-slate-600">Are you sure you want to delete <span class="font-semibold">{member?.name}</span>? This action cannot be undone.</p>
              </div>
              <button
                type="button"
                class="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100/50 transition-colors duration-200"
                on:click={closeModal}
                disabled={isLoading}
                aria-label="Close"
              >
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <!-- Content -->
          <div class="px-6 py-8">
            <div class="flex items-center space-x-4">
              <div class="flex-shrink-0">
                <svg class="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" />
                </svg>
              </div>
              <div>
                <p class="text-lg font-semibold text-red-700">This action cannot be undone.</p>
                <p class="text-sm text-gray-600">All data related to this member will be lost.</p>
              </div>
            </div>
          </div>
          <!-- Footer -->
          <div class="px-6 py-4 border-t border-slate-200/50 bg-white/80 flex flex-col sm:flex-row-reverse gap-3">
            <button
              type="submit"
              class="flex-1 sm:flex-initial sm:min-w-[120px] inline-flex justify-center items-center rounded-xl border border-transparent shadow-lg px-6 py-3 bg-red-600 text-base font-medium text-white hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {#if isLoading}
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Deleting...
              {:else}
                <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
                Delete Member
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