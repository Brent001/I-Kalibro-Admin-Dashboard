<script lang="ts">
  export let barcodeInput: string = '';
  export let action: 'time_in' | 'time_out' = 'time_in';
  export let purpose: string = '';
  export let scanning: boolean = false;
  export let scanError: string = '';
  export let showScanSuccess: boolean = false;
  export let scanResult: {
    memberName: string;
    memberType: string;
    department: string;
  } = { memberName: '', memberType: '', department: '' };
  export let onBarcodeChange: (value: string) => void = () => {};
  export let onActionChange: (value: 'time_in' | 'time_out') => void = () => {};
  export let onPurposeChange: (value: string) => void = () => {};
  export let onProcess: () => void = () => {};
  export let onKeyDown: (e: KeyboardEvent) => void = () => {};
</script>

<div class="space-y-4">
  {#if scanError}
    <div class="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
      {scanError}
    </div>
  {/if}

  {#if showScanSuccess}
    <div class="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
      <div class="font-semibold">✓ Success!</div>
      <div class="mt-1">{scanResult.memberName} - {scanResult.memberType}</div>
      {#if scanResult.department}
        <div class="text-xs mt-1">{scanResult.department}</div>
      {/if}
    </div>
  {/if}

  <div>
    <label for="barcode" class="block text-sm font-medium text-slate-700 mb-2">
      Barcode / Member ID
    </label>
    <input
      id="barcode"
      type="text"
      value={barcodeInput}
      on:change={(e) => onBarcodeChange(e.currentTarget.value)}
      on:keydown={onKeyDown}
      placeholder="Scan or enter barcode..."
      class="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D5C29] bg-white text-slate-900"
      autofocus
    />
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
    <div>
      <label class="block text-sm font-medium text-slate-700 mb-1">Action</label>
      <select 
        value={action}
        on:change={(e) => onActionChange(e.currentTarget.value as 'time_in' | 'time_out')}
        class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0D5C29]"
      >
        <option value="time_in">Time In</option>
        <option value="time_out">Time Out</option>
      </select>
    </div>
    <div class="sm:col-span-2">
      <label class="block text-sm font-medium text-slate-700 mb-1">Purpose</label>
      <input 
        type="text" 
        value={purpose}
        on:change={(e) => onPurposeChange(e.currentTarget.value)}
        placeholder="Purpose (optional)" 
        class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0D5C29]" 
      />
    </div>
  </div>

  <button
    on:click={onProcess}
    disabled={scanning}
    class="w-full px-6 py-3 bg-[#0D5C29] text-white rounded-lg font-semibold hover:bg-[#0a4820] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
  >
    {scanning ? 'Processing...' : 'Process Scan'}
  </button>
</div>
