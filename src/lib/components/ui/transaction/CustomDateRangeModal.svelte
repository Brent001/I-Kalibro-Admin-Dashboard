<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let open = false;
  let customFromDate = "";
  let customToDate = "";

  const dispatch = createEventDispatcher();

  function closeModal() {
    open = false;
  }

  function applyDateRange() {
    if (!customFromDate || !customToDate) {
      alert("Please select both from and to dates");
      return;
    }
    const fromDate = new Date(customFromDate);
    const toDate = new Date(customToDate);
    if (fromDate > toDate) {
      alert("From date must be before to date");
      return;
    }
    const daysCount = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    dispatch('apply', {
      fromDate: customFromDate,
      toDate: customToDate,
      daysCount,
      label: `${fromDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${toDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    });
    closeModal();
  }

  function initializeDefaultDates() {
    if (!customFromDate && !customToDate) {
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      customToDate = today.toISOString().split('T')[0];
      customFromDate = thirtyDaysAgo.toISOString().split('T')[0];
    }
  }

  $: if (open) initializeDefaultDates();

  $: computedDays = (customFromDate && customToDate)
    ? Math.ceil((new Date(customToDate).getTime() - new Date(customFromDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
    : null;
  $: isValid = customFromDate && customToDate && new Date(customFromDate) <= new Date(customToDate);
</script>

{#if open}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
    on:click|self={closeModal}
    role="dialog"
    aria-modal="true"
    aria-label="Select date range"
  >
    <div class="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-sm overflow-hidden">

      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div class="flex items-center gap-3">
          <div class="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center">
            <svg class="h-5 w-5 text-slate-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>
            </svg>
          </div>
          <div>
            <h3 class="text-base font-bold text-gray-900">Custom Date Range</h3>
            <p class="text-xs text-gray-400 mt-0.5">Filter transactions by period</p>
          </div>
        </div>
        <button
          on:click={closeModal}
          class="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-150"
          aria-label="Close"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="px-6 py-5 space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="fromDate" class="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">From</label>
            <input
              id="fromDate"
              type="date"
              bind:value={customFromDate}
              class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all duration-200"
            />
          </div>
          <div>
            <label for="toDate" class="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">To</label>
            <input
              id="toDate"
              type="date"
              bind:value={customToDate}
              class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all duration-200"
            />
          </div>
        </div>

        {#if computedDays !== null}
          <div class="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
            <div class="h-8 w-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 shadow-sm">
              <svg class="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div>
              <p class="text-[11px] text-gray-400 uppercase tracking-widest font-semibold">Selected range</p>
              <p class="text-sm font-bold text-gray-900 mt-0.5">
                {computedDays} {computedDays === 1 ? 'day' : 'days'}
              </p>
            </div>
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-gray-100 bg-gray-50/60 flex gap-3">
        <button
          on:click={closeModal}
          class="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-white hover:border-gray-300 transition-all duration-150"
        >
          Cancel
        </button>
        <button
          on:click={applyDateRange}
          disabled={!isValid}
          class="flex-1 px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 active:scale-95 transition-all duration-150 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
          </svg>
          Apply Filter
        </button>
      </div>

    </div>
  </div>
{/if}