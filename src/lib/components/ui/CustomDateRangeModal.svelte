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

    // Dispatch event with selected dates
    const daysCount = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // Using Svelte dispatcher for better component communication
    dispatch('apply', {
        fromDate: customFromDate,
        toDate: customToDate,
        daysCount: daysCount,
        label: `${fromDate.toLocaleDateString()} - ${toDate.toLocaleDateString()}`
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

  $: if (open) {
    initializeDefaultDates();
  }
</script>

{#if open}
  <div class="fixed inset-0 bg-emerald-950/60 backdrop-blur-sm z-40 flex items-center justify-center p-4 transition-all">
    
    <div class="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border-t-4 border-amber-500 transform transition-all">
      
      <div class="p-6 pb-2">
        <div class="flex justify-between items-start">
            <div>
                 <h3 class="text-2xl font-bold text-green-900">Select Date Range</h3>
                <p class="text-sm text-green-700/70 mt-1 font-medium">Filter transactions by duration</p>
            </div>
            <button on:click={closeModal} class="text-gray-400 hover:text-green-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
      </div>

      <div class="p-6 space-y-5">
        
        <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="fromDate" class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">From</label>
              <input
                id="fromDate"
                type="date"
                bind:value={customFromDate}
                class="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 focus:bg-white transition-all duration-200 text-sm outline-none"
              />
            </div>

            <div>
              <label for="toDate" class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">To</label>
              <input
                id="toDate"
                type="date"
                bind:value={customToDate}
                class="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 focus:bg-white transition-all duration-200 text-sm outline-none"
              />
            </div>
        </div>

        {#if customFromDate && customToDate}
          <div class="bg-green-50 border border-green-100 p-4 rounded-lg flex items-center gap-3">
            <div class="bg-white p-2 rounded-full shadow-sm text-amber-500">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
            <div>
                <p class="text-xs text-green-800 uppercase font-bold tracking-wide">Selected Duration</p>
                <p class="text-green-900 font-medium">
                  {Math.ceil((new Date(customToDate).getTime() - new Date(customFromDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} days
                </p>
            </div>
          </div>
        {/if}
      </div>

      <div class="bg-gray-50 px-6 py-4 flex gap-3 border-t border-gray-100">
        <button
          on:click={closeModal}
          class="flex-1 px-4 py-2.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-white hover:border-amber-400 hover:text-amber-600 transition-all duration-200 text-sm font-semibold"
        >
          Cancel
        </button>
        <button
          on:click={applyDateRange}
          class="flex-1 px-4 py-2.5 bg-green-800 text-white rounded-lg hover:bg-green-700 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 text-sm font-bold flex justify-center items-center gap-2"
        >
          <span>Apply Filter</span>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-amber-300" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  </div>
{/if}