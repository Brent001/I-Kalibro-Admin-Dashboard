<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import type { PageData } from './$types.js';
  import { scannerStore, updateScannerState, setScanSuccess, setScanError } from '$lib/stores/scannerStore.js';
  import type { ScannerState } from '$lib/stores/scannerStore.js';
  import { getAvailableCameras, requestCameraPermission, buildCameraConfig } from '$lib/utils/camera.js';
  import { processBarcodeScan, playSuccessSound, createScanDebounce } from '$lib/utils/barcode.js';
  import ScannerStats from '$lib/components/ui/barcode/ScannerStats.svelte';
  import CameraSelector from '$lib/components/ui/barcode/CameraSelector.svelte';
  import CameraView from '$lib/components/ui/barcode/CameraView.svelte';
  import BarcodeInput from '$lib/components/ui/barcode/BarcodeInput.svelte';
  import RecentScans from '$lib/components/ui/barcode/RecentScans.svelte';

  export let data: PageData;

  // --- Hardware scanner state ---
  let hardwareInput: HTMLInputElement | null = null;
  let hardwarePollingInterval: ReturnType<typeof setInterval> | null = null;
  let hardwareRefocusInterval: ReturnType<typeof setInterval> | null = null;

  // Buffer and timing used to distinguish a USB keyboard-wedge scanner
  // from a human typing. Scanners emit chars very fast (< 50 ms apart).
  let hwBuffer = '';
  let hwLastCharTime = 0;
  const HW_CHAR_GAP_MS = 60;       // gap threshold: scanner chars arrive < 60 ms apart
  const HW_MIN_LENGTH  = 3;        // ignore accidental single-key presses

  // Scanner status visible in the UI
  let hardwareConnected = false;    // becomes true after the first successful scan
  let hardwareScanCount = 0;
  let lastScanBarcode = '';

  let shouldDebounce = createScanDebounce(2500);

  let scannerState: ScannerState = {
    isScanning: false,
    // Hardware scanner is the default – camera is optional
    useCameraMode: false,
    cameraError: '',
    cameraAvailable: false,
    showCameraSelector: false,
    barcodeInput: '',
    action: 'time_in' as const,
    purpose: '',
    scanning: false,
    scanError: '',
    showScanSuccess: false,
    scanMessage: '',
    selectedCameraId: '',
    availableCameras: [],
    lastScannedTime: 0,
    scanResult: { memberName: '', memberType: '', department: '' },
    scanner: null
  };

  let recentScans: any[] = [];
  let stats = {
    totalScans: 0,
    studentsScanned: 0,
    facultyScanned: 0
  };

  const unsubscribe = scannerStore.subscribe((value: ScannerState) => {
    scannerState = value;
  });

  $: if (data?.authorized) {
    recentScans = data.recentScans || [];
    stats = data.stats || { totalScans: 0, studentsScanned: 0, facultyScanned: 0 };
  }

  // ----------------------------------------------------------------
  // Core scan processor
  // ----------------------------------------------------------------
  async function processScan(barcodeOverride?: string) {
    const barcode = (barcodeOverride ?? scannerState.barcodeInput).trim();
    if (!barcode) {
      setScanError('Please enter or scan a barcode');
      return;
    }

    updateScannerState({ scanning: true, scanError: '', barcodeInput: barcode });

    try {
      const result = await processBarcodeScan({
        barcode,
        action: scannerState.action,
        purpose: scannerState.purpose || 'Library Access'
      });

      if (result.success) {
        setScanSuccess(
          result.memberName || '',
          result.memberType || '',
          result.department || ''
        );
        playSuccessSound();
        lastScanBarcode = barcode;
        hardwareScanCount++;
        updateScannerState({
          barcodeInput: '',
          purpose: scannerState.action === 'time_in' ? '' : scannerState.purpose
        });
        await refreshScans();
      } else {
        setScanError(result.message || 'Failed to process scan');
      }
    } catch (err) {
      setScanError('Error processing barcode. Please try again.');
      console.error('Scan error:', err);
    } finally {
      updateScannerState({ scanning: false });
      // Return focus to the hidden hardware input
      if (hardwareInput) {
        try { hardwareInput.focus(); } catch (_) {}
      }
    }
  }

  async function refreshScans() {
    try {
      const response = await fetch('/api/barcode/recent-scans');
      const result = await response.json();
      if (result.success) {
        recentScans = result.data || [];
        stats = result.stats || stats;
      }
    } catch (err) {
      console.error('Error refreshing scans:', err);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !scannerState.scanning) {
      processScan();
    }
  }

  // ----------------------------------------------------------------
  // Hardware USB keyboard-wedge scanner capture
  // The Teklead (and most composite HID scanners) on Windows 10 emit
  // characters sequentially very fast and then send an Enter keystroke.
  // We capture that into a hidden off-screen input.
  // ----------------------------------------------------------------
  function setupHardwareInput() {
    hardwareInput = document.createElement('input');
    hardwareInput.type = 'text';
    hardwareInput.autocomplete = 'off';
    hardwareInput.spellcheck = false;
    // Visually off-screen but still focusable
    Object.assign(hardwareInput.style, {
      position: 'fixed',
      left: '-9999px',
      top: '0',
      width: '1px',
      height: '1px',
      opacity: '0',
      pointerEvents: 'none'
    });
    hardwareInput.setAttribute('aria-hidden', 'true');
    document.body.appendChild(hardwareInput);

    // Track each incoming character to measure inter-character delay.
    hardwareInput.addEventListener('input', () => {
      const now = Date.now();
      const gap = now - hwLastCharTime;
      hwLastCharTime = now;

      const currentVal = hardwareInput?.value ?? '';

      // If the gap is too large the user typed this character manually
      // (not a scanner burst) – reset the buffer.
      if (gap > HW_CHAR_GAP_MS && hwBuffer.length > 0) {
        hwBuffer = '';
      }

      hwBuffer = currentVal;
    });

    hardwareInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const barcode = hwBuffer.trim();

        if (barcode.length >= HW_MIN_LENGTH) {
          // Mark scanner as connected on first successful capture
          hardwareConnected = true;
          updateScannerState({ barcodeInput: barcode });
          shouldDebounce(() => processScan(barcode));
        }

        // Always clear
        if (hardwareInput) hardwareInput.value = '';
        hwBuffer = '';
        hwLastCharTime = 0;
      }
    });

    // Keep focus on the hidden input at all times so the scanner's
    // keystroke stream is always captured.
    hardwareInput.focus();

    hardwareRefocusInterval = setInterval(() => {
      // Only steal focus back if no modal / dialog is open and the user
      // is not actively typing in a visible field.
      const active = document.activeElement as HTMLElement | null;
      const isUserField =
        active &&
        active !== hardwareInput &&
        (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);

      if (!isUserField && hardwareInput) {
        try { hardwareInput.focus(); } catch (_) {}
      }
    }, 300);
  }

  // ----------------------------------------------------------------
  // Camera helpers (optional, secondary mode)
  // ----------------------------------------------------------------
  async function startCamera() {
    if (!browser || scannerState.isScanning) return;

    try {
      if (scannerState.availableCameras.length === 0) {
        const cameras = await getAvailableCameras();
        updateScannerState({
          availableCameras: cameras,
          ...(cameras.length > 0 && !scannerState.selectedCameraId
            ? { selectedCameraId: cameras[0].deviceId }
            : {})
        });

        if (cameras.length === 0) {
          setScanError('No cameras found. Please check camera permissions.');
          return;
        }

        if (cameras.length > 1) {
          updateScannerState({ showCameraSelector: true });
          return;
        }
      }

      await initializeScannerUI();
    } catch (err) {
      console.error('Camera error:', err);
      setScanError(err instanceof Error ? err.message : 'Unable to access camera.');
    }
  }

  async function initializeScannerUI() {
    try {
      const { Html5Qrcode } = await import('html5-qrcode');

      if (scannerState.scanner) {
        try { await scannerState.scanner.clear(); } catch (_) {}
      }

      const html5QrCode = new Html5Qrcode('scanner-container');
      const config = buildCameraConfig(scannerState.selectedCameraId) as any;

      const scannerConfig = {
        fps: config.fps || 10,
        qrbox: (w: number, h: number) => {
          const min = Math.min(w, h);
          return { width: Math.floor(min * 0.9), height: Math.floor(min * 0.45) };
        },
        disableFlip: config.disableFlip || false,
        aspectRatio: config.aspectRatio || 1.777778,
        rememberLastUsedCamera: true,
        formatsToSupport: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],
        experimentalFeatures: { useBarCodeDetectorIfSupported: true }
      };

      const onScanSuccess = (decodedText: string) => {
        updateScannerState({ barcodeInput: decodedText });
        shouldDebounce(() => processScan(decodedText));
      };

      const onScanFailure = (msg: string) => {
        if (!msg.includes('No barcode') && !msg.includes('No QR code')) {
          console.warn('Camera scan failure:', msg);
        }
      };

      const constraints = scannerState.selectedCameraId
        ? { deviceId: { exact: scannerState.selectedCameraId } }
        : { facingMode: { ideal: 'environment' } };

      await html5QrCode.start(constraints, scannerConfig, onScanSuccess, onScanFailure);
      updateScannerState({ scanner: html5QrCode, isScanning: true, cameraError: '' });
    } catch (err) {
      console.error('initializeScannerUI error:', err);
      setScanError(err instanceof Error ? err.message : 'Failed to initialize camera scanner.');
      updateScannerState({ isScanning: false });
    }
  }

  function stopCamera() {
    const sc = scannerState.scanner;
    if (sc) {
      try {
        if (typeof sc.clear === 'function') sc.clear().catch(() => {});
        else if (typeof sc.stop === 'function') sc.stop().catch(() => {});
      } catch (_) {}
    }

    try {
      const videoEl = document.querySelector('#scanner-container video') as HTMLVideoElement | null;
      if (videoEl?.srcObject) {
        (videoEl.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        videoEl.srcObject = null;
      }
    } catch (_) {}

    updateScannerState({ useCameraMode: false, isScanning: false, lastScannedTime: 0, scanner: null });
  }

  async function handleCameraToggle() {
    if (scannerState.useCameraMode) {
      stopCamera();
    } else {
      // Trigger permission prompt via navigator.mediaDevices.getUserMedia
      // on the user gesture. Some mobile browsers only show prompts when
      // called directly from a gesture.
      if (!browser) return;

      const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      let granted = false;

      if (hasGetUserMedia) {
        try {
          const cfg = buildCameraConfig(scannerState.selectedCameraId);
          const constraints: any = { video: cfg.videoConstraints || { facingMode: { ideal: 'environment' } } };

          // Check Permissions API first (if available) to provide clearer feedback
          try {
            if (navigator.permissions && typeof navigator.permissions.query === 'function') {
              // Some browsers use 'camera' or 'microphone' permission names
              const p = await navigator.permissions.query({ name: 'camera' as PermissionName }).catch(() => null);
              if (p && p.state === 'denied') {
                setScanError('Camera permission is denied for this site. Please enable camera access in your browser settings.');
                updateScannerState({ useCameraMode: false });
                return;
              }
            }
          } catch (permErr) {
            // ignore permission query errors and continue to request getUserMedia
            console.warn('Permission query failed:', permErr);
          }

          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          // Immediately stop tracks - we only needed to prompt for permission.
          stream.getTracks().forEach((t) => t.stop());
          granted = true;
        } catch (err) {
          granted = false;
        }
      } else {
        // Fallback to helper which also uses getUserMedia
        granted = await requestCameraPermission().catch(() => false);
      }

      if (!granted) {
        setScanError('Camera permission denied or unavailable.');
        updateScannerState({ useCameraMode: false });
        return;
      }

      updateScannerState({ useCameraMode: true });
      // small delay to allow UI to update before starting camera
      setTimeout(startCamera, 100);
    }
  }

  async function handleCameraSelect(cameraId: string) {
    updateScannerState({ selectedCameraId: cameraId, showCameraSelector: false });
    if (scannerState.isScanning) {
      stopCamera();
      setTimeout(startCamera, 300);
    }
  }

  // ----------------------------------------------------------------
  // Lifecycle
  // ----------------------------------------------------------------
  onMount(() => {
    if (!browser) return;

    if (!data?.authorized) {
      window.location.href = '/';
      return;
    }

    // Setup hardware scanner capture immediately
    try {
      setupHardwareInput();
    } catch (err) {
      console.warn('Unable to setup hardware input capture:', err);
    }

    // Probe camera availability in the background (for the optional toggle)
    const hasCameraSupport = !!(navigator.mediaDevices?.getUserMedia);
    updateScannerState({ cameraAvailable: hasCameraSupport });

    if (hasCameraSupport) {
      // Do not prompt for camera permission automatically on mobile.
      // Many mobile browsers block or suppress permission prompts unless
      // triggered by an explicit user gesture. We'll request permission
      // when the user clicks "Use Camera" (see handleCameraToggle).
    }

    // Poll recent scans for real-time updates (hardware scanner POSTs come in here too)
    refreshScans();
    if (data?.hardwareSupport) {
      hardwarePollingInterval = setInterval(refreshScans, 2000);
    }
  });

  onDestroy(() => {
    unsubscribe();
    if (browser && scannerState.isScanning && scannerState.scanner) stopCamera();
    if (hardwarePollingInterval) { clearInterval(hardwarePollingInterval); hardwarePollingInterval = null; }
    if (hardwareRefocusInterval) { clearInterval(hardwareRefocusInterval); hardwareRefocusInterval = null; }
    if (hardwareInput) { try { hardwareInput.remove(); } catch (_) {} hardwareInput = null; }
  });
</script>

<svelte:head>
  <title>Barcode Scanner | E-Kalibro Admin Portal</title>
</svelte:head>

{#if data?.authorized}
  <div class="min-h-screen">

    <!-- Page Header -->
    <div class="mb-4">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 class="text-2xl font-bold text-slate-900">Barcode Scanner</h2>
          <p class="text-slate-600">Scan member barcodes for library access</p>
        </div>

        <div class="flex gap-2">
          <!-- Debug button -->
          <button
            on:click={async () => {
              const { checkScannerEnvironment, testCameraAccess, listCameras } = await import('$lib/utils/debugScanner.js');
              const env = checkScannerEnvironment();
              const cameraResult = await testCameraAccess();
              const cameras = await listCameras();
              alert(
                `Environment: ${env.ready ? 'Ready' : 'Issues found'}\n` +
                `Camera: ${cameraResult.success ? 'Available' : cameraResult.error}\n` +
                `Cameras found: ${cameras.length}\n` +
                `Hardware scans captured: ${hardwareScanCount}`
              );
            }}
            class="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Debug
          </button>
        </div>
      </div>
    </div>

    <main class="space-y-4">

      <!-- Stats -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ScannerStats label="Total Scans" value={stats.totalScans} icon="clipboard" />
        <ScannerStats label="Students"    value={stats.studentsScanned} icon="users" />
        <ScannerStats label="Faculty"     value={stats.facultyScanned}  icon="briefcase" />
      </div>

      <!-- ── Hardware Scanner Status Banner ── -->
      <div class="rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3
        {hardwareConnected ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}">

        <div class="flex items-center gap-3">
          <!-- USB icon -->
          <div class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
            {hardwareConnected ? 'bg-green-100' : 'bg-blue-100'}">
            <svg class="w-5 h-5 {hardwareConnected ? 'text-green-600' : 'text-blue-600'}"
                 fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p class="text-sm font-semibold {hardwareConnected ? 'text-green-900' : 'text-blue-900'}">
              {hardwareConnected ? 'USB Barcode Scanner Active' : 'Waiting for USB Barcode Scanner'}
            </p>
            <p class="text-xs {hardwareConnected ? 'text-green-700' : 'text-blue-700'}">
              {#if hardwareConnected}
                {hardwareScanCount} barcode{hardwareScanCount !== 1 ? 's' : ''} scanned
                {lastScanBarcode ? `· Last: ${lastScanBarcode}` : ''}
              {:else}
                Plug in your Teklead scanner and scan any barcode — no extra setup needed.
              {/if}
            </p>
          </div>
        </div>

        <!-- Pulsing dot -->
        <div class="flex items-center gap-2">
          {#if hardwareConnected}
            <span class="relative flex h-3 w-3">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span class="text-xs text-green-700 font-medium">Ready</span>
          {:else}
            <span class="relative flex h-3 w-3">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60"></span>
              <span class="relative inline-flex rounded-full h-3 w-3 bg-blue-400"></span>
            </span>
            <span class="text-xs text-blue-700 font-medium">Listening…</span>
          {/if}
        </div>
      </div>

      <!-- ── Quick Tip ── -->
      {#if !hardwareConnected}
        <div class="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
          <svg class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-sm text-amber-800">
            <strong>Windows 10 tip:</strong> Your Teklead USB scanner works as a <em>keyboard device</em> — Windows installs it
            automatically with no drivers needed. Simply plug it in and scan; the barcode will be captured instantly even
            when this page is in the background.
          </p>
        </div>
      {/if}

      <!-- ── Scanner Input Panel ── -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h3 class="text-lg font-semibold text-slate-900">Scanner Input</h3>

          <div class="flex gap-2 flex-wrap items-center">
            <!-- Manual entry toggle label -->
            <span class="text-xs text-slate-500">Manual fallback:</span>

            <!-- Camera toggle (optional) -->
            {#if browser && scannerState.cameraAvailable}
              <button
                on:click={handleCameraToggle}
                class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-600 transition-colors"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {scannerState.useCameraMode ? 'Close Camera' : 'Use Camera'}
              </button>

              {#if scannerState.availableCameras.length > 1 && scannerState.useCameraMode}
                <button
                  on:click={() => updateScannerState({ showCameraSelector: !scannerState.showCameraSelector })}
                  class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-600 transition-colors"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Switch Camera
                </button>
              {/if}
            {/if}
          </div>
        </div>

        <!-- Camera Selector -->
        {#if scannerState.showCameraSelector && scannerState.availableCameras.length > 1}
          <CameraSelector
            cameras={scannerState.availableCameras}
            selectedCameraId={scannerState.selectedCameraId}
            onCameraSelect={handleCameraSelect}
          />
        {/if}

        <!-- Camera view (only when explicitly enabled) -->
        {#if scannerState.useCameraMode && browser}
          <div class="mb-4">
            <CameraView
              isScanning={scannerState.isScanning}
              cameraError={scannerState.cameraError}
              scanError={scannerState.scanError}
              showScanSuccess={scannerState.showScanSuccess}
              scanResult={scannerState.scanResult}
              action={scannerState.action}
              purpose={scannerState.purpose}
              scanning={scannerState.scanning}
              barcodeInput={scannerState.barcodeInput}
              onActionChange={(v) => updateScannerState({ action: v })}
              onPurposeChange={(v) => updateScannerState({ purpose: v })}
              onProcess={processScan}
            />
          </div>
        {/if}

        <!-- Manual / fallback barcode input (always visible) -->
        <BarcodeInput
          barcodeInput={scannerState.barcodeInput}
          action={scannerState.action}
          purpose={scannerState.purpose}
          scanning={scannerState.scanning}
          scanError={scannerState.scanError}
          showScanSuccess={scannerState.showScanSuccess}
          scanResult={scannerState.scanResult}
          onBarcodeChange={(v) => updateScannerState({ barcodeInput: v })}
          onActionChange={(v) => updateScannerState({ action: v })}
          onPurposeChange={(v) => updateScannerState({ purpose: v })}
          onProcess={processScan}
          onKeyDown={handleKeyDown}
        />

        <!-- Focus recovery helper -->
        {#if browser}
          <p class="mt-3 text-center text-xs text-slate-400">
            Hardware scanner active — point and scan. Click below if scanner stops responding.
          </p>
          <div class="mt-1 flex justify-center">
            <button
              on:click={() => { if (hardwareInput) try { hardwareInput.focus(); } catch (_) {} }}
              class="text-xs text-blue-600 hover:underline"
            >
              Re-activate scanner capture
            </button>
          </div>
        {/if}
      </div>

      <!-- Recent Scans -->
      <RecentScans scans={recentScans} onRefresh={refreshScans} />
    </main>
  </div>

{:else}
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-center">
      <h1 class="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
      <p class="text-slate-600">You do not have permission to access this page.</p>
    </div>
  </div>
{/if}

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
  :global(#scanner-container > div)          { width: 100% !important; height: 100% !important; }
  :global(#scanner-container .qrcode-shaded-region) { display: none !important; }
  :global(#scanner-container .qrcode-video-container) {
    width: 100% !important; height: 100% !important; display: block !important;
  }
  :global(#scanner-container canvas)          { display: none !important; }
  :global(#scanner-container input[type="file"]) { display: none !important; }
  :global(.qrcode-scanner-container)         { width: 100% !important; height: 100% !important; display: block !important; }
  :global(.qrcode-video)                     { width: 100% !important; height: 100% !important; display: block !important; }
  :global(#scanner-container button)         { display: none !important; }
  :global(#scanner-container .hidden)        { display: none !important; }
</style>