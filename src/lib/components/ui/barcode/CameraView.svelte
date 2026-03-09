<script lang="ts">
import { checkScannerEnvironment } from '$lib/utils/debugScanner.js';

  export let isScanning: boolean = false;
  export let cameraError: string = '';
  export let scanError: string = '';
  export let showScanSuccess: boolean = false;
  export let scanResult: {
    memberName: string;
    memberType: string;
    department: string;
  } = { memberName: '', memberType: '', department: '' };
  export let action: 'time_in' | 'time_out' = 'time_in';
  export let purpose: string = '';
  export let onActionChange: (value: 'time_in' | 'time_out') => void = () => {};
  export let onPurposeChange: (value: string) => void = () => {};
  export let onProcess: () => void = () => {};
  export let scanning: boolean = false;
  export let barcodeInput: string = '';
  
  let browser: boolean;
  let cameraReady: boolean;

  $: {
    const { checks, ready } = checkScannerEnvironment();
    browser = checks.browser;
    cameraReady = ready;
  }

</script>

<div class="mb-6">
  <input
    bind:value={barcodeInput}
    type="text"
    style="position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0;"
    aria-hidden="true"
  />

  <div class="flex items-center gap-4 mb-4 flex-wrap">
    <div>
      <label for="action-select" class="block text-sm font-medium text-slate-700 mb-1">Action</label>
      <select 
        id="action-select"
        value={action} 
        on:change={(e) => onActionChange(e.currentTarget.value as 'time_in' | 'time_out')}
        class="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0D5C29]"
      >
        <option value="time_in">Time In</option>
        <option value="time_out">Time Out</option>
      </select>
    </div>

    <div class="flex-1 min-w-[200px]">
      <label for="purpose-input" class="block text-sm font-medium text-slate-700 mb-1">Purpose</label>
      <input 
        id="purpose-input"
        type="text" 
        value={purpose}
        on:change={(e) => onPurposeChange(e.currentTarget.value)}
        placeholder="Purpose (optional)" 
        class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0D5C29]" 
      />
    </div>

    <div class="pt-6">
      <button 
        on:click={onProcess} 
        disabled={scanning || !barcodeInput.trim()}
        class="px-4 py-2 bg-[#0D5C29] text-white rounded-lg hover:bg-[#0a4820] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {scanning ? 'Processing...' : 'Process'}
      </button>
    </div>
  </div>

  {#if cameraError}
    <div class="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
      <div class="font-semibold">Camera Error</div>
      <div class="mt-1">{cameraError}</div>
    </div>
  {/if}

  {#if scanError}
    <div class="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
      <div class="font-semibold">Scan Error</div>
      <div class="mt-1">{scanError}</div>
    </div>
  {/if}

  {#if showScanSuccess}
    <div class="mb-4 p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
      <div class="font-semibold">✓ Success!</div>
      <div class="mt-1">{scanResult.memberName} - {scanResult.memberType}</div>
      {#if scanResult.department}
        <div class="text-xs mt-1">{scanResult.department}</div>
      {/if}
    </div>
  {/if}

  <div class="relative bg-black rounded-lg overflow-hidden">
    <div id="scanner-container"></div>
  </div>

  <p class="text-sm text-slate-600 text-center mt-4">
    {isScanning ? 'Point the camera at the barcode. Ensure good lighting and hold steady.' : 'Camera is starting...'}
  </p>

  {#if !cameraReady && browser}
    <div class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
      <p class="text-sm text-yellow-800">
        <strong>Camera not available:</strong> 
        {cameraError || 'Please check your browser permissions and camera connections.'}
      </p>
      <p class="text-xs text-yellow-700 mt-1">
        Tip: Make sure you are using HTTPS and have granted camera permissions.
      </p>
    </div>
  {/if}
</div>

<style>
  :global(#scanner-container) {
    width: 100% !important;
    height: 400px !important;
    display: block !important;
    position: relative !important;
    background-color: #000 !important;
    border-radius: 0.5rem !important;
    overflow: hidden !important;
  }

  :global(#scanner-container video) {
    width: 100% !important;
    height: 100% !important;
    display: block !important;
    object-fit: cover !important;
    background-color: #000 !important;
    visibility: visible !important;
    opacity: 1 !important;
  }

  :global(#scanner-container > div) {
    width: 100% !important;
    height: 100% !important;
  }

  :global(#scanner-container .qrcode-shaded-region) {
    display: none !important;
  }

  :global(#scanner-container .qrcode-video-container) {
    width: 100% !important;
    height: 100% !important;
    display: block !important;
  }

  :global(#scanner-container canvas) {
    display: none !important;
  }

  :global(#scanner-container input[type="file"]) {
    display: none !important;
  }

  :global(.qrcode-scanner-container) {
    width: 100% !important;
    height: 100% !important;
    display: block !important;
  }

  :global(.qrcode-video) {
    width: 100% !important;
    height: 100% !important;
    display: block !important;
  }

  :global(#scanner-container button) {
    display: none !important;
  }

  :global(#scanner-container .hidden) {
    display: none !important;
  }
</style>
