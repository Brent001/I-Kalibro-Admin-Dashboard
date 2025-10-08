<script lang="ts">
  export let open = false;
  export let transaction: {
    id: number;
    bookTitle?: string;
    memberName?: string;
    memberId?: string;
    bookId?: string;
  } | null = null;
  export let customDueDate: string = "";

  import { createEventDispatcher } from "svelte";
  const dispatch = createEventDispatcher();

  function close() {
    dispatch("close");
  }
  function confirm() {
    dispatch("confirm");
  }
</script>

{#if open && transaction}
  <div class="fixed inset-0 flex items-center justify-center p-4 z-50"
       style="backdrop-filter: blur(8px); background: rgba(30, 41, 59, 0.15);">
    <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
      <div class="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 rounded-t-2xl">
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <div class="p-2 bg-white bg-opacity-20 rounded-lg mr-3">
              <svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h3 class="text-xl font-bold text-white">Confirm Borrow</h3>
          </div>
          <button
            on:click={close}
            class="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
            aria-label="Close modal"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="px-6 py-5">
        <div class="bg-slate-50 rounded-xl p-4 mb-5">
          <div class="flex items-start mb-3">
            <div class="flex-shrink-0 h-12 w-12 flex items-center justify-center bg-blue-100 rounded-lg mr-3">
              <svg class="h-7 w-7 text-blue-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/>
              </svg>
            </div>
            <div class="flex-1">
              <h4 class="font-semibold text-gray-900 mb-1">{transaction.bookTitle}</h4>
              <p class="text-sm text-gray-600">ID: {transaction.bookId}</p>
            </div>
          </div>
          <div class="pt-3 border-t border-slate-200">
            <div class="flex items-center text-sm">
              <div class="flex-shrink-0 h-8 w-8 flex items-center justify-center bg-blue-100 rounded-full mr-2">
                <span class="text-xs font-semibold text-blue-700">
                  {transaction.memberName?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p class="font-medium text-gray-900">{transaction.memberName}</p>
                <p class="text-xs text-gray-500">{transaction.memberId}</p>
              </div>
            </div>
          </div>
        </div>
        <div class="mb-5">
          <label for="due-date-input" class="block text-sm font-semibold text-gray-700 mb-2">
            Due Date & Time
          </label>
          <div class="relative">
            <input
              id="due-date-input"
              type="datetime-local"
              bind:value={customDueDate}
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div class="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25"/>
              </svg>
            </div>
          </div>
          <p class="text-xs text-gray-500 mt-2">Default: 24 hours from now</p>
        </div>
        <div class="flex gap-3">
          <button
            on:click={close}
            class="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            on:click={confirm}
            class="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
          >
            Confirm Borrow
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}