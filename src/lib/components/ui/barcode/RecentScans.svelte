<script lang="ts">
  import { formatScanDate, getMemberTypeColor } from '$lib/utils/barcode.js';

  interface Scan {
    id: string | number;
    memberType: string;
    memberName: string;
    purpose: string;
    timestamp: string;
  }

  export let scans: Scan[] = [];
  export let onRefresh: () => void = () => {};
</script>

<div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-lg font-semibold text-slate-900">Recent Scans</h3>
    <button
      on:click={onRefresh}
      class="inline-flex items-center justify-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors duration-200"
    >
      Refresh
    </button>
  </div>

  {#if scans.length === 0}
    <p class="text-slate-500 text-center py-8">No recent scans</p>
  {:else}
    <div class="space-y-3">
      {#each scans as scan}
        <div class="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <svg class="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <p class="text-sm font-medium text-slate-900">{scan.memberName}</p>
              {#if scan.purpose}
                <p class="text-xs text-slate-500">{scan.purpose}</p>
              {/if}
            </div>
          </div>
          <div class="text-right">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getMemberTypeColor(scan.memberType)}">
              {scan.memberType}
            </span>
            <p class="text-xs text-slate-500 mt-1">{formatScanDate(scan.timestamp)}</p>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
