<script lang="ts">
  export let open = false;
  export let transaction: {
    id: number;
    bookTitle?: string;
    memberName?: string;
    memberId?: string;
    bookId?: string;
    borrowDate?: string;
    dueDate?: string;
    status?: string;
  } | null = null;

  import { createEventDispatcher } from "svelte";
  const dispatch = createEventDispatcher();

  function close() {
    dispatch("close");
  }
  function confirm() {
    dispatch("confirm");
  }

  function formatDate(dateString: string | undefined) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  function calculateDaysRemaining(dueDate: string | undefined) {
    if (!dueDate) return null;
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
</script>

{#if open && transaction}
  <div class="fixed inset-0 flex items-center justify-center p-4 z-50"
       style="backdrop-filter: blur(8px); background: rgba(30, 41, 59, 0.15);">
    <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
      <div class="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-5 rounded-t-2xl">
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <div class="p-2 bg-white bg-opacity-20 rounded-lg mr-3">
              <svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>
              </svg>
            </div>
            <h3 class="text-xl font-bold text-white">Return Book</h3>
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
            <div class="flex-shrink-0 h-12 w-12 flex items-center justify-center bg-emerald-100 rounded-lg mr-3">
              <svg class="h-7 w-7 text-emerald-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/>
              </svg>
            </div>
            <div class="flex-1">
              <h4 class="font-semibold text-gray-900 mb-1">{transaction.bookTitle}</h4>
              <p class="text-sm text-gray-600">ID: {transaction.bookId}</p>
            </div>
          </div>
          <div class="pt-3 border-t border-slate-200 space-y-2">
            <div class="flex items-center text-sm">
              <div class="flex-shrink-0 h-8 w-8 flex items-center justify-center bg-emerald-100 rounded-full mr-2">
                <span class="text-xs font-semibold text-emerald-700">
                  {transaction.memberName?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p class="font-medium text-gray-900">{transaction.memberName}</p>
                <p class="text-xs text-gray-500">{transaction.memberId}</p>
              </div>
            </div>
            <div class="flex items-center justify-between text-sm pt-2">
              <span class="text-gray-600">Borrowed:</span>
              <span class="font-medium text-gray-900">{formatDate(transaction.borrowDate)}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-600">Due Date:</span>
              <span class="font-medium text-gray-900">{formatDate(transaction.dueDate)}</span>
            </div>
            {#if transaction.status === 'borrowed'}
              {@const daysLeft = calculateDaysRemaining(transaction.dueDate)}
              {#if daysLeft !== null && daysLeft < 0}
                <div class="bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                  <div class="flex items-center">
                    <svg class="h-5 w-5 text-red-600 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
                    </svg>
                    <span class="text-sm font-medium text-red-800">
                      {Math.abs(daysLeft)} day{Math.abs(daysLeft) !== 1 ? 's' : ''} overdue
                    </span>
                  </div>
                </div>
              {/if}
            {/if}
          </div>
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
            class="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition-colors shadow-sm"
          >
            Confirm Return
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}