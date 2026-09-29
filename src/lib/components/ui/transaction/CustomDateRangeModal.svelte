<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let open = false;
  let customFromDate = "";
  let customToDate = "";

  const dispatch = createEventDispatcher();

  function closeModal() {
    open = false;
    dispatch('close');
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
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <button
      class="fixed inset-0 bg-black/50 backdrop-blur-sm cursor-default"
      onclick={closeModal}
      aria-label="Close modal"
      type="button"
    ></button>

    <div class="relative w-full max-w-sm transform transition-all duration-300 scale-100">
      <div class="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-[#4A7C59]/30 overflow-hidden">

        <!-- ── Header ── -->
        <div class="px-6 py-4 border-b border-[#4A7C59]/20 bg-white/80">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <div class="flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-[#0D5C29] to-[#4A7C59] shadow-lg flex-shrink-0">
                <svg class="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>
                </svg>
              </div>
              <div class="min-w-0">
                <h3 class="text-lg sm:text-xl font-bold text-[#0D5C29] truncate">Custom Date Range</h3>
                <p class="text-xs sm:text-sm text-[#4A7C59] hidden sm:block">Filter transactions by period</p>
              </div>
            </div>
            <button
              type="button" onclick={closeModal}
              aria-label="Close modal"
              class="p-2 rounded-lg text-gray-400 hover:text-[#0D5C29] hover:bg-[#0D5C29]/10 transition-colors duration-200 flex-shrink-0"
            >
              <svg class="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- ── Body ── -->
        <div class="px-6 py-6">
          <div class="bg-[#f8faf9] border border-[#4A7C59]/20 rounded-xl p-4 sm:p-5">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="fromDate" class="block text-xs font-medium text-gray-500 mb-1">From</label>
                <input
                  id="fromDate"
                  type="date"
                  bind:value={customFromDate}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 bg-white"
                />
              </div>
              <div>
                <label for="toDate" class="block text-xs font-medium text-gray-500 mb-1">To</label>
                <input
                  id="toDate"
                  type="date"
                  bind:value={customToDate}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 bg-white"
                />
              </div>
            </div>

            {#if computedDays !== null}
              <div class="mt-4 flex items-center gap-3 bg-white border border-[#4A7C59]/20 rounded-lg px-4 py-3">
                <div class="h-8 w-8 rounded-lg bg-[#E8B923]/20 flex items-center justify-center flex-shrink-0">
                  <svg class="h-4 w-4 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
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
        </div>

        <!-- ── Footer ── -->
        <div class="px-6 py-4 border-t border-[#4A7C59]/20 bg-white/80 flex flex-col sm:flex-row-reverse gap-3">
          <button
            type="button" onclick={applyDateRange}
            disabled={!isValid}
            class="w-full sm:w-auto flex-1 px-6 py-2.5 rounded-lg bg-gradient-to-r from-[#0D5C29] to-[#4A7C59] text-sm font-semibold text-white hover:from-[#0A4520] hover:to-[#3D664A] shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
            </svg>
            Apply Filter
          </button>
          <button
            type="button" onclick={closeModal}
            class="w-full sm:w-auto flex-1 px-6 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  </div>
{/if}