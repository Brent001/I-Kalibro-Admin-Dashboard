<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import { afterNavigate } from '$app/navigation';
  import type { PageData } from './$types.js';

  export let data: PageData;

  // Core state
  let html5QrCode: any = null;
  let isScanning = false;
  let cameraId: string | null = null;
  let cameras: Array<{ id: string; label: string }> = [];
  let scanHistory: Array<{text: string, timestamp: Date, action: string}> = [];
  let scanResult: string | null = null;
  let errorMsg = "";
  let cameraPermission: 'granted' | 'denied' | 'pending' | 'checking' = 'pending';
  let isStopping = false;

  // Processing state
  let isProcessing = false;
  let processingQrCode: string | null = null;
  let lastProcessedTime = 0;

  // Menu state
  let currentStep: 'menu' | 'scanning' = 'menu';
  let selectedAction: 'time_in' | 'time_out' | null = null;
  let purpose = '';
  let customPurpose = '';
  let showPurposeError = false;
  let showDropdown = false;
  let showCameraDropdown = false;

  interface RecentVisit {
    id: number;
    visitorName: string | null;
    visitorType: string | null;
    idNumber: string | null;
    purpose: string;
    timeIn: string | null;
    timeOut: string | null;
    status: 'checked_in' | 'checked_out';
    duration: string;
  }
  let recentVisits: RecentVisit[] = [];
  let recentVisitsLoading = true;
  let recentVisitsError = "";

  const commonPurposes = [
    'Study', 'Research', 'Borrow Books', 'Return Books', 'Reading',
    'Group Study', 'Use Computer/Internet', 'Print Documents',
    'Attend Workshop/Seminar', 'Meet with Librarian', 'Custom'
  ];

  $: ({ scanner, user } = data);
  $: scanMethod = scanner?.visitScanMethod || 'qrcode';
  $: isBarcodeMode = scanMethod === 'barcode' || scanMethod === 'both';
  $: config = scanner?.config || { fps: 10, qrboxPercentage: 0.7, preferredCamera: 'user' };
  $: hasRequirementErrors = scanMethod === 'qrcode' && (scanner?.errors?.httpsRequired || scanner?.errors?.unsupportedBrowser);
  $: isProceedDisabled = selectedAction === 'time_in'
    ? (!purpose || (purpose === 'Custom' && !customPurpose.trim()) || customPurpose.length > 100)
    : false;
  $: proceedBg = isProceedDisabled ? '#94a3b8' : (selectedAction === 'time_in' ? '#0d9488' : '#f59e0b');

  // Barcode (HID) state
  let barcodeInput = '';
  let barcodeInputRef: HTMLInputElement | null = null;
  let isBarcodeProcessing = false;

  async function loadRecentVisits() {
    recentVisitsLoading = true;
    recentVisitsError = "";
    try {
      const res = await fetch('/api/reports/visits?period=day');
      const json = await res.json();
      if (res.ok && json.success && Array.isArray(json.visits)) {
        recentVisits = json.visits.slice(0, 20);
      } else {
        recentVisitsError = json.message || "Failed to load recent visits.";
      }
    } catch {
      recentVisitsError = "Network error loading recent visits.";
    } finally {
      recentVisitsLoading = false;
    }
  }

  let Html5QrcodeClass: any = null;

  async function loadHtml5Qrcode() {
    if (Html5QrcodeClass) return Html5QrcodeClass;
    const { Html5Qrcode } = await import("html5-qrcode");
    Html5QrcodeClass = Html5Qrcode;
    return Html5Qrcode;
  }

  async function requestCameraAndEnumerate(): Promise<boolean> {
    cameraPermission = 'checking';
    errorMsg = "";
    if (!navigator.mediaDevices) {
      errorMsg = "Camera access is not supported in this browser.";
      cameraPermission = 'denied';
      return false;
    }
    try {
      const Html5Qrcode = await loadHtml5Qrcode();
      const deviceList = await Html5Qrcode.getCameras();
      if (deviceList && deviceList.length > 0) {
        cameras = deviceList.map((d: any, i: number) => ({
          id: d.id,
          label: d.label || `Camera ${i + 1}`
        }));
        if (!cameraId) {
          if (scanner?.device?.isMobile) {
            const rear = cameras.find(c =>
              c.label.toLowerCase().includes('back') ||
              c.label.toLowerCase().includes('rear') ||
              c.label.toLowerCase().includes('environment')
            );
            cameraId = rear?.id || cameras[cameras.length - 1]?.id || null;
          } else {
            cameraId = cameras[0]?.id || null;
          }
        }
      } else {
        cameras = [];
        cameraId = null;
      }
      cameraPermission = 'granted';
      return true;
    } catch (err: any) {
      cameraPermission = 'denied';
      const name = err?.name || '';
      const msg = (err?.message || '').toLowerCase();
      if (name === 'NotAllowedError' || msg.includes('permission') || msg.includes('denied')) {
        errorMsg = scanner?.device?.isIOS
          ? "Camera blocked. Go to Settings → Safari → Camera and allow access for this site."
          : "Camera permission denied. Open your browser's Site Settings and allow Camera, then try again.";
      } else if (name === 'NotFoundError' || msg.includes('not found') || msg.includes('no camera')) {
        errorMsg = "No camera found on this device.";
      } else if (name === 'NotReadableError' || msg.includes('in use')) {
        errorMsg = "Camera is already in use by another app. Close it and try again.";
      } else {
        errorMsg = `Camera error: ${err?.message || String(err)}`;
      }
      return false;
    }
  }

  // FIX: reset processing state reliably so the scanner is never permanently locked
  function resetProcessingState() {
    isProcessing = false;
    processingQrCode = null;
  }

  async function handleDecoded(decodedText: string) {
    if (isProcessing) return;
    if (!decodedText || decodedText.length < 3) return;
    const now = Date.now();
    // Per-code cooldown: ignore the same code scanned within 2 s
    if (processingQrCode === decodedText && (now - lastProcessedTime) < 2000) return;
    processingQrCode = decodedText;
    lastProcessedTime = now;
    isProcessing = true;
    try {
      await processQRCode(decodedText);
    } catch (e) {
      console.error('handleDecoded error:', e);
      errorMsg = "An unexpected error occurred while scanning.";
      // Always reset so the scanner can accept the next code
      resetProcessingState();
    }
  }

  async function startScanner() {
    errorMsg = "";
    const hasAccess = await requestCameraAndEnumerate();
    if (!hasAccess) return;
    await tick();
    const qrReaderElement = document.getElementById("qr-reader");
    if (!qrReaderElement) { errorMsg = "Scanner interface not ready. Please try again."; return; }
    try {
      await stopScanner();
      resetProcessingState();
      lastProcessedTime = 0;
      const Html5Qrcode = await loadHtml5Qrcode();
      html5QrCode = new Html5Qrcode("qr-reader");
      const scannerConfig = {
        fps: config.fps ?? 10,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.floor(minEdge * (config.qrboxPercentage ?? 0.7));
          return { width: size, height: size };
        },
        aspectRatio: 1.0,
        verbose: false
      };
      if (cameraId) {
        await html5QrCode.start(
          cameraId, scannerConfig,
          async (decodedText: string) => { try { await handleDecoded(decodedText); } catch { } },
          (_: any) => {}
        );
      } else {
        const facingMode = scanner?.device?.isMobile ? 'environment' : 'user';
        await html5QrCode.start(
          { facingMode }, scannerConfig,
          async (decodedText: string) => { try { await handleDecoded(decodedText); } catch { } },
          (_: any) => {}
        );
      }
      isScanning = true;
      errorMsg = "";
    } catch (err: any) {
      isScanning = false;
      resetProcessingState();
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('permission') || msg.includes('notallowed')) {
        errorMsg = scanner?.device?.isIOS
          ? "Camera permission denied. Check Settings → Safari → Camera."
          : "Camera permission denied. Check your browser's site settings.";
        cameraPermission = 'denied';
      } else if (msg.includes('in use') || msg.includes('notreadable')) {
        errorMsg = "Camera is in use by another app. Please close it and try again.";
      } else {
        errorMsg = `Could not start scanner: ${err?.message || 'Unknown error'}`;
      }
    }
  }

  async function stopScanner() {
    if (isStopping) return;
    isStopping = true;
    if (html5QrCode) {
      try {
        const state = html5QrCode.getState?.();
        if (!state || state === 2) await html5QrCode.stop();
        await html5QrCode.clear();
      } catch { }
      try {
        const videoEl = document.querySelector('#qr-reader video') as HTMLVideoElement | null;
        if (videoEl?.srcObject) {
          (videoEl.srcObject as MediaStream).getTracks().forEach(t => t.stop());
          videoEl.srcObject = null;
        }
      } catch { }
      html5QrCode = null;
    }
    isScanning = false;
    isStopping = false;
  }

  async function handleCameraChange(event: Event) {
    const newId = (event.target as HTMLSelectElement).value;
    if (newId === cameraId) return;
    cameraId = newId;
    if (isScanning) {
      await stopScanner();
      await new Promise(r => setTimeout(r, 300));
      await startScanner();
    }
  }

  function handleActionSelect(action: 'time_in' | 'time_out') {
    selectedAction = action;
    if (action === 'time_out') { purpose = ''; customPurpose = ''; showPurposeError = false; }
  }

  function handlePurposeSelect(p: string) {
    purpose = p; customPurpose = '';
    showDropdown = false; showPurposeError = false;
  }

  function handleClickOutside(event: MouseEvent) {
    if (!(event.target as HTMLElement).closest('.custom-dropdown')) {
      showDropdown = false; showCameraDropdown = false;
    }
  }

  function handleCameraSelect(id: string) {
    cameraId = id; showCameraDropdown = false;
  }

  async function handleProceedToScan() {
    if (selectedAction === 'time_in') {
      if (!purpose) { showPurposeError = true; return; }
      if (purpose === 'Custom' && !customPurpose.trim()) { showPurposeError = true; return; }
      if (customPurpose.trim().length > 100) { showPurposeError = true; return; }
    }
    showPurposeError = false;
    currentStep = 'scanning';
    if (isBarcodeMode) {
      await tick();
      barcodeInput = '';
      barcodeInputRef?.focus();
    } else {
      await startScanner();
    }
  }

  async function processBarcode() {
    const code = barcodeInput.trim();
    barcodeInput = '';
    if (!code || code.length < 3 || isBarcodeProcessing) {
      barcodeInputRef?.focus();
      return;
    }
    const now = Date.now();
    const cooldownMs = 2 * 60 * 1000;
    const recentScan = scanHistory.find(
      e => e.text === code && e.action === selectedAction &&
           now - new Date(e.timestamp).getTime() < cooldownMs
    );
    if (recentScan) {
      errorMsg = "This barcode was already scanned recently for this action.";
      setTimeout(() => { errorMsg = ""; }, 10000);
      barcodeInputRef?.focus();
      return;
    }
    isBarcodeProcessing = true;
    isProcessing = true;
    try {
      await processQRCode(code);
    } finally {
      isBarcodeProcessing = false;
      isProcessing = false;
      await tick();
      barcodeInputRef?.focus();
    }
  }

  function handleBackToMenu() {
    stopScanner();
    currentStep = 'menu'; selectedAction = null; purpose = ''; customPurpose = '';
    showPurposeError = false; showDropdown = false; errorMsg = ''; scanResult = null;
    barcodeInput = ''; isBarcodeProcessing = false;
    resetProcessingState();
  }

  async function processQRCode(content: string) {
    try {
      errorMsg = "";
      const now = new Date();
      const cooldownMs = 2 * 60 * 1000;

      // FIX: capture selectedAction at time of scan so it doesn't change underneath us
      const actionAtScanTime = selectedAction;

      const recentScan = scanHistory.find(
        e => e.text === content && e.action === actionAtScanTime &&
             now.getTime() - e.timestamp.getTime() < cooldownMs
      );
      if (recentScan) {
        errorMsg = "This QR code was already scanned recently for this action.";
        // FIX: reset immediately, don't leave the scanner locked
        resetProcessingState();
        setTimeout(() => { errorMsg = ""; }, 10000);
        return;
      }

      const validationApi = isBarcodeMode ? '/api/process-bar' : '/api/process-qr';
      const saveApi = isBarcodeMode ? '/api/process-bar/db_save' : '/api/process-qr/db_save';

      const validateRes = await fetch(validationApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content })
      });
      if (validateRes.status === 401) {
        // Auth failed (expired token / missing cookie). Redirect to login.
        errorMsg = "Session expired. Redirecting to login...";
        resetProcessingState();
        setTimeout(() => { window.location.href = '/'; }, 1200);
        return;
      }
      const validateData = await validateRes.json();
      if (!validateRes.ok || !validateData.success) {
        errorMsg = validateData.error || validateData.message || "Invalid code";
        // FIX: reset so the scanner can try again after showing the error
        resetProcessingState();
        setTimeout(() => { errorMsg = ""; }, 10000);
        return;
      }

      // Determine action if not yet set
      let resolvedAction = actionAtScanTime;
      if (!resolvedAction) {
        try {
          if (validateData.lastRecord) {
            const lastTs = validateData.lastRecord.timestamp || validateData.lastRecord.createdAt || validateData.lastRecord.time;
            const lastDate = lastTs ? new Date(lastTs) : null;
            const nowDate = new Date();
            if (lastDate && lastDate.toDateString() === nowDate.toDateString() &&
                (validateData.lastRecord.action === 'time_in' || validateData.lastRecord.type === 'time_in')) {
              resolvedAction = 'time_out';
            } else { resolvedAction = 'time_in'; }
          } else if (validateData.hasCheckInToday) { resolvedAction = 'time_out'; }
          else { resolvedAction = 'time_in'; }
        } catch { resolvedAction = 'time_in'; }
        selectedAction = resolvedAction;
      }

      const saveRes = await fetch(saveApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content, action: resolvedAction, username: user.username, fullName: user.name,
          purpose: resolvedAction === 'time_in' ? (purpose === 'Custom' ? customPurpose : purpose) : undefined
        })
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok || !saveData.success) {
        errorMsg = saveData.error || saveData.message || `Failed to save ${resolvedAction}`;
        // FIX: reset so the scanner can try again
        resetProcessingState();
        setTimeout(() => { errorMsg = ""; }, 10000);
        return;
      }

      // SUCCESS — record in history, show result, then return to menu
      scanHistory = [{ text: content, timestamp: now, action: resolvedAction! }, ...scanHistory];
      scanResult = content;

      // FIX: load visits in parallel; reset state BEFORE navigating back so
      //      no lingering isProcessing=true blocks re-entry into scan mode.
      loadRecentVisits(); // fire and forget — don't await so UI isn't held up
      setTimeout(() => {
        scanResult = null;
        resetProcessingState();
        handleBackToMenu();
      }, 3000);

    } catch (error) {
      console.error('processQRCode error:', error);
      errorMsg = "An error occurred while processing the QR code";
      // FIX: always reset on any thrown error
      resetProcessingState();
    }
  }

  async function cleanup() {
    try {
      await stopScanner();
      resetProcessingState();
      lastProcessedTime = 0;
    } catch (e) { console.error('Cleanup error:', e); }
  }

  function handleVisibilityChange() { if (document.hidden && isScanning) cleanup(); }
  function handleBeforeUnload() { cleanup(); }

  function formatDateTime(dateStr: string | null) {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
      });
    } catch { return dateStr; }
  }

  function getStatusColor(status: string) {
    return status === 'checked_in'
      ? 'bg-blue-100 text-blue-800 border-blue-200'
      : 'bg-emerald-100 text-emerald-800 border-emerald-200';
  }
  function getStatusDot(status: string) {
    return status === 'checked_in' ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500';
  }
  function getTypeColor(type: string | null) {
    switch ((type || '').toLowerCase()) {
      case 'student': return 'bg-slate-100 text-slate-800 border-slate-200';
      case 'faculty': return 'bg-violet-100 text-violet-800 border-violet-200';
      case 'staff':   return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'guest':   return 'bg-rose-100 text-rose-800 border-rose-200';
      default:        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }
  function getInitial(name: string | null) { return (name || 'V').charAt(0).toUpperCase(); }

  onMount(() => {
    selectedAction = 'time_in';
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('click', handleClickOutside);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    afterNavigate((nav) => {
      if (nav.from?.url.pathname === '/dashboard/qr_scanner' &&
          nav.to?.url.pathname !== '/dashboard/qr_scanner') cleanup();
    });
    loadRecentVisits();
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('click', handleClickOutside);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      cleanup();
    };
  });

  onDestroy(() => { cleanup(); });
</script>

<svelte:head>
  <title>QR Scanner | E-Kalibro Admin Portal</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
</svelte:head>

<div class="min-h-screen space-y-3">

  <!-- Header -->
  <div class="mb-3">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">QR Scanner</h2>
        <p class="text-slate-600">Scan QR codes for library attendance tracking</p>
      </div>
      {#if currentStep === 'scanning'}
        <div class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border
          {selectedAction === 'time_in' ? 'bg-teal-50 border-teal-200 text-teal-800' : 'bg-amber-50 border-amber-200 text-amber-800'}">
          <span class="w-2 h-2 rounded-full animate-pulse
            {selectedAction === 'time_in' ? 'bg-teal-500' : 'bg-amber-500'}"></span>
          <span class="text-sm font-semibold">
            {selectedAction === 'time_in' ? 'Time In Mode' : 'Time Out Mode'}
          </span>
        </div>
      {/if}
    </div>
  </div>

  <!-- Requirements Error -->
  {#if hasRequirementErrors}
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
      <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
      </div>
      <h3 class="text-lg font-bold text-slate-900 mb-2">QR Scanner Not Available</h3>
      {#if scanner.errors.httpsRequired}<p class="text-sm text-red-600 mb-1">{scanner.errors.httpsRequired}</p>{/if}
      {#if scanner.errors.unsupportedBrowser}<p class="text-sm text-red-600 mb-1">{scanner.errors.unsupportedBrowser}</p>{/if}
      <button
        class="mt-4 inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors"
        on:click={() => window.location.reload()}
      >
        <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        Refresh Page
      </button>
    </div>

  <!-- Menu Step -->
  {:else if currentStep === 'menu'}
    <div class="grid grid-cols-2 gap-2 sm:gap-3">
      <button
        class="bg-white rounded-xl shadow-sm border-2 p-4 sm:p-6 text-center hover:shadow-md hover:-translate-y-0.5 transition-all duration-200
          {selectedAction === 'time_in' ? 'border-teal-500 bg-teal-50/40' : 'border-gray-200 hover:border-teal-300'}"
        on:click={() => handleActionSelect('time_in')}
      >
        <div class="flex flex-col items-center">
          <div class="p-3 rounded-xl mb-3 bg-gradient-to-br from-teal-400 to-teal-600 shadow-sm">
            <svg class="h-6 w-6 sm:h-7 sm:w-7 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
            </svg>
          </div>
          <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Action</p>
          <p class="text-lg sm:text-xl font-bold text-gray-900">Time In</p>
          <p class="text-xs text-slate-500 mt-1">Check in to library</p>
        </div>
      </button>

      <button
        class="bg-white rounded-xl shadow-sm border-2 p-4 sm:p-6 text-center hover:shadow-md hover:-translate-y-0.5 transition-all duration-200
          {selectedAction === 'time_out' ? 'border-amber-500 bg-amber-50/40' : 'border-gray-200 hover:border-amber-300'}"
        on:click={() => handleActionSelect('time_out')}
      >
        <div class="flex flex-col items-center">
          <div class="p-3 rounded-xl mb-3 bg-gradient-to-br from-amber-400 to-amber-600 shadow-sm">
            <svg class="h-6 w-6 sm:h-7 sm:w-7 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </div>
          <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Action</p>
          <p class="text-lg sm:text-xl font-bold text-gray-900">Time Out</p>
          <p class="text-xs text-slate-500 mt-1">Check out from library</p>
        </div>
      </button>
    </div>

    {#if selectedAction}
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-4">
        {#if selectedAction === 'time_in'}
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-semibold text-slate-900">Purpose of Visit</h3>
              <p class="text-sm text-slate-500">Select why you're visiting the library today</p>
            </div>
            <div class="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
          </div>

          <div class="relative custom-dropdown">
            <button
              type="button"
              class="w-full px-4 py-2.5 border-2 rounded-lg text-sm text-left flex items-center justify-between transition-all
                {showPurposeError ? 'border-red-400 bg-red-50' : purpose ? 'border-teal-400 bg-teal-50/30' : 'border-slate-300 bg-white hover:border-slate-400'}"
              on:click|stopPropagation={() => showDropdown = !showDropdown}
            >
              <span class="{!purpose ? 'text-slate-400' : 'text-slate-900 font-medium'}">{purpose || 'Select your purpose of visit'}</span>
              <svg class="w-4 h-4 text-slate-400 transition-transform duration-200 {showDropdown ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
            {#if showDropdown}
              <div class="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                {#each commonPurposes as p}
                  <button
                    type="button"
                    class="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-slate-50
                      {purpose === p ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-700'}"
                    on:click|stopPropagation={() => handlePurposeSelect(p)}
                  >{p}</button>
                {/each}
              </div>
            {/if}
          </div>

          {#if cameras.length > 0}
            <div class="relative custom-dropdown">
              <p class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Camera</p>
              <button
                type="button"
                class="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg text-sm text-left flex items-center justify-between bg-white hover:border-slate-400 transition-all"
                on:click|stopPropagation={() => showCameraDropdown = !showCameraDropdown}
              >
                <span class="{!cameraId ? 'text-slate-400' : 'text-slate-900 font-medium'}">{cameras.find(c => c.id === cameraId)?.label || 'Select camera'}</span>
                <svg class="w-4 h-4 text-slate-400 transition-transform {showCameraDropdown ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
              {#if showCameraDropdown}
                <div class="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                  {#each cameras as cam}
                    <button
                      type="button"
                      class="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-slate-50
                        {cameraId === cam.id ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-700'}"
                      on:click|stopPropagation={() => handleCameraSelect(cam.id)}
                    >{cam.label}</button>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}

          {#if purpose === 'Custom'}
            <div>
              <input
                type="text"
                class="w-full px-4 py-2.5 border-2 rounded-lg text-sm transition-all
                  {showPurposeError && !customPurpose.trim() ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white focus:border-slate-500 focus:ring-2 focus:ring-slate-100'}"
                placeholder="Enter your custom purpose (max 100 characters)"
                maxlength="100"
                bind:value={customPurpose}
                on:input={() => showPurposeError = false}
              />
              <div class="mt-1.5 flex justify-between">
                <span class="text-xs text-slate-500">Be specific about your visit purpose</span>
                <span class="text-xs font-medium {customPurpose.length > 90 ? 'text-amber-600' : 'text-slate-400'}">{customPurpose.length}/100</span>
              </div>
            </div>
          {/if}

          {#if showPurposeError}
            <div class="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-2.5 rounded-lg">
              <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span>
                {purpose === 'Custom' && !customPurpose.trim()
                  ? 'Please enter your custom purpose'
                  : customPurpose.length > 100
                    ? 'Purpose must be 100 characters or less'
                    : 'Please select a purpose for your visit'}
              </span>
            </div>
          {/if}

          <div class="border-t border-slate-100 pt-2"></div>
        {/if}

        <button
          type="button"
          class="w-full inline-flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg text-white transition-colors duration-200 {isProceedDisabled ? 'opacity-60 cursor-not-allowed' : ''}"
          on:click={handleProceedToScan}
          disabled={isProceedDisabled}
          style="background-color: {proceedBg}"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
          </svg>
          {isBarcodeMode ? 'Proceed to Scan Barcode' : 'Proceed to Scan QR Code'}
        </button>
      </div>
    {/if}

  <!-- Scanning Step -->
  {:else if currentStep === 'scanning'}
    <div class="grid grid-cols-1 gap-3 lg:grid-cols-3">

      <!-- Scanner Panel -->
      <div class="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-200
          bg-gradient-to-r {selectedAction === 'time_in' ? 'from-teal-50 to-white' : 'from-amber-50 to-white'}
          flex items-center justify-between">
          <button
            class="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-medium text-sm transition-colors disabled:opacity-40"
            on:click={handleBackToMenu}
            disabled={isProcessing}
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
            Back to Menu
          </button>
          <h3 class="text-base font-semibold text-slate-900">Scanner Active</h3>
          <div class="w-24"></div>
        </div>

        <div class="p-4 space-y-4">
          <!-- Error message (both modes) -->
          {#if errorMsg}
            <div class="flex items-center justify-between gap-3 bg-red-50 border-l-4 border-red-400 px-4 py-3 rounded-lg">
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                </svg>
                <p class="text-sm text-red-800">{errorMsg}</p>
              </div>
              <button class="text-red-400 hover:text-red-600 transition-colors flex-shrink-0" on:click={() => errorMsg = ''}>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          {/if}

          {#if scanMethod === 'barcode'}
            <!-- ── BARCODE MODE: HID text input ── -->
            <div class="flex flex-col items-center gap-4 py-4">
              <div class="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center">
                <svg class="w-9 h-9 text-slate-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z"/>
                </svg>
              </div>
              <div class="text-center">
                <p class="text-sm font-semibold text-slate-800">Ready to Scan Barcode</p>
                <p class="text-xs text-slate-500 mt-1">Point the barcode scanner at the ID card</p>
              </div>

              <div class="w-full">
                <label for="barcode-input" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Barcode Input</label>
                <div class="flex gap-2">
                  <input
                    id="barcode-input"
                    bind:this={barcodeInputRef}
                    bind:value={barcodeInput}
                    type="text"
                    inputmode="none"
                    autocomplete="off"
                    autocorrect="off"
                    spellcheck={false}
                    placeholder="Scan barcode here…"
                    disabled={isBarcodeProcessing}
                    class="flex-1 px-4 py-3 border-2 rounded-xl text-sm font-mono transition-all bg-white
                      {isBarcodeProcessing ? 'border-slate-200 text-slate-400 cursor-not-allowed' : 'border-teal-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100'}"
                    on:keydown={(e) => { if (e.key === 'Enter' && barcodeInput.trim()) processBarcode(); }}
                  />
                  <button
                    type="button"
                    class="inline-flex items-center justify-center px-4 py-3 rounded-xl text-sm font-semibold transition-colors
                      {isBarcodeProcessing || !barcodeInput.trim() ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-teal-600 text-white hover:bg-teal-700'}"
                    disabled={isBarcodeProcessing || !barcodeInput.trim()}
                    on:click={processBarcode}
                  >
                    Submit
                  </button>
                </div>
              </div>

              {#if isBarcodeProcessing}
                <div class="flex items-center gap-2 text-sm text-slate-600">
                  <div class="w-4 h-4 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin"></div>
                  Processing barcode…
                </div>
              {:else}
                <button
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                  on:click={() => barcodeInputRef?.focus()}
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12H3m0 0l4-4m-4 4l4 4"/>
                  </svg>
                  Re-focus Scanner Input
                </button>
              {/if}
            </div>

          {:else}
            <!-- ── QR CODE MODE: camera ── -->
            {#if cameras.length > 1}
              <div>
                <label for="camera-select" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Camera</label>
                <select
                  id="camera-select"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all"
                  on:change={handleCameraChange}
                  bind:value={cameraId}
                >
                  {#each cameras as cam}
                    <option value={cam.id}>{cam.label}</option>
                  {/each}
                </select>
              </div>
            {/if}

            {#if cameraPermission === 'denied' && !errorMsg}
              <div class="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div class="flex items-start gap-3">
                  <div class="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  </div>
                  <div>
                    <p class="text-sm font-semibold text-amber-800 mb-1">Camera Access Required</p>
                    {#if scanner?.device?.isIOS}
                      <p class="text-xs text-amber-700">Go to <strong>Settings → Safari → Camera</strong> and set it to <strong>Allow</strong>. Then tap "Try Again" below.</p>
                    {:else}
                      <p class="text-xs text-amber-700">Tap the <strong>camera / lock icon</strong> in your browser's address bar → <strong>Allow Camera</strong>. Then tap "Try Again" below.</p>
                    {/if}
                    <button
                      class="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors"
                      on:click={() => { cameraPermission = 'pending'; startScanner(); }}
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                      </svg>
                      Try Again
                    </button>
                  </div>
                </div>
              </div>
            {/if}

            <!-- QR reader div -->
            <div class="relative">
              <div
                id="qr-reader"
                class="rounded-xl bg-slate-100 border border-slate-200 overflow-hidden"
                style="width: 100%; aspect-ratio: 1 / 1; max-width: 320px; margin: auto;"
              ></div>

              {#if cameraPermission === 'checking'}
                <div class="absolute inset-0 flex items-center justify-center bg-slate-900/70 rounded-xl backdrop-blur-sm" style="max-width:320px;margin:auto;">
                  <div class="bg-white rounded-xl shadow-lg p-5 text-center mx-4">
                    <div class="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg class="w-6 h-6 text-teal-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
                      </svg>
                    </div>
                    <p class="text-sm font-semibold text-slate-900">Requesting Camera…</p>
                    <p class="text-xs text-slate-500 mt-1">Please allow camera access when prompted</p>
                  </div>
                </div>
              {/if}

              {#if isProcessing && !scanResult}
                <div class="absolute inset-0 flex items-center justify-center bg-slate-900/60 rounded-xl backdrop-blur-sm">
                  <div class="bg-white rounded-xl shadow-lg p-5 text-center">
                    <div class="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto mb-3"></div>
                    <p class="text-sm font-semibold text-slate-900">Processing…</p>
                    <p class="text-xs text-slate-500 mt-1">Please wait</p>
                  </div>
                </div>
              {/if}

              {#if scanResult}
                <div class="absolute inset-0 flex items-center justify-center bg-slate-900/60 rounded-xl backdrop-blur-sm">
                  <div class="bg-white rounded-xl shadow-lg p-5 text-center max-w-xs mx-4">
                    <div class="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                    </div>
                    <h4 class="text-base font-bold text-slate-900 mb-1">Success!</h4>
                    <p class="text-xs text-slate-500 mb-3">Scanned Successfully</p>
                    <p class="text-xs font-mono text-slate-700 bg-slate-100 px-3 py-2 rounded-lg break-all mb-3">{scanResult}</p>
                    <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      ✓ {selectedAction === 'time_in' ? 'Time in recorded' : 'Time out recorded'}
                    </span>
                  </div>
                </div>
              {/if}
            </div>

            {#if isScanning}
              <button
                class="w-full inline-flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-colors duration-200 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                on:click={stopScanner}
                disabled={isStopping || isProcessing}
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/>
                </svg>
                {isStopping ? 'Stopping…' : isProcessing ? 'Processing…' : 'Stop Scanner'}
              </button>
            {:else if !isProcessing}
              <button
                class="w-full inline-flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg text-white bg-teal-600 hover:bg-teal-700 transition-colors duration-200"
                on:click={startScanner}
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
                </svg>
                Start Scanner
              </button>
            {/if}
          {/if}
        </div>
      </div>

      <!-- Sidebar -->
      <div class="lg:col-span-1 space-y-3">
        <!-- Current Action Card -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Current Action</p>
          <div class="flex flex-col items-center text-center">
            <div class="p-3 rounded-xl mb-3 bg-gradient-to-br
              {selectedAction === 'time_in' ? 'from-teal-400 to-teal-600' : 'from-amber-400 to-amber-600'} shadow-sm">
              <svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                {#if selectedAction === 'time_in'}
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
                {:else}
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                {/if}
              </svg>
            </div>
            <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Mode</p>
            <p class="text-xl font-bold text-gray-900">{selectedAction === 'time_in' ? 'Time In' : 'Time Out'}</p>
          </div>
          {#if selectedAction === 'time_in' && purpose}
            <div class="mt-3 pt-3 border-t border-slate-100">
              <p class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Purpose</p>
              <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                {purpose === 'Custom' ? customPurpose : purpose}
              </span>
            </div>
          {/if}
        </div>

        <!-- Instructions -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="text-base font-semibold text-slate-900">Instructions</h3>
              <p class="text-sm text-slate-500">How to scan your QR code</p>
            </div>
            <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
          </div>
          <div class="space-y-3">
            {#each (isBarcodeMode ? [
              { n: 1, text: 'Point the barcode scanner at the ID card' },
              { n: 2, text: 'The scanner will read and submit automatically' },
              { n: 3, text: 'Wait for the success confirmation message' },
            ] : [
              { n: 1, text: 'Position the QR code within the scanner frame' },
              { n: 2, text: 'Hold your device steady for automatic scanning' },
              { n: 3, text: 'Wait for the success confirmation message' },
            ]) as step}
              <div class="flex items-start gap-3">
                <span class="flex-shrink-0 w-6 h-6 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center">{step.n}</span>
                <p class="text-sm text-slate-600 pt-0.5">{step.text}</p>
              </div>
            {/each}
          </div>
        </div>

        <!-- Tips -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h3 class="text-base font-semibold text-slate-900">Scanning Tips</h3>
              <p class="text-sm text-slate-500">For best results</p>
            </div>
            <div class="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
              </svg>
            </div>
          </div>
          <div class="pt-3 border-t border-slate-100 space-y-1.5">
            {#each ['Ensure good lighting around the QR code', 'Keep the code flat and free of creases', 'Move closer if the code appears too small'] as tip}
              <div class="flex items-center gap-2">
                <div class="w-1.5 h-1.5 bg-amber-400 rounded-full flex-shrink-0"></div>
                <p class="text-xs text-slate-600">{tip}</p>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Recent Scans Table -->
  <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
    <div class="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 bg-gray-50/60 gap-3">
      <div class="min-w-0 flex-1">
        <h3 class="text-sm sm:text-base font-semibold text-slate-900 leading-tight">Today's Visit Log</h3>
        <div class="flex items-center gap-1.5 mt-0.5">
          <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0"></span>
          <p class="text-xs text-gray-400 truncate">Live · recent scans today</p>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <button
          on:click={loadRecentVisits}
          disabled={recentVisitsLoading}
          class="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40"
          title="Refresh" aria-label="Refresh visit log"
        >
          <svg class={`h-4 w-4 ${recentVisitsLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/>
          </svg>
        </button>
        <a href="/dashboard/reports/visits"
          class="inline-flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition-colors whitespace-nowrap">
          <svg class="h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <span class="hidden sm:inline">View All Logs</span>
          <span class="sm:hidden">All Logs</span>
        </a>
      </div>
    </div>

    {#if recentVisitsError}
      <div class="px-6 py-4 bg-red-50 border-b border-red-100 flex items-center gap-2 text-sm text-red-700">
        <svg class="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        {recentVisitsError}
        <button on:click={loadRecentVisits} class="ml-2 underline font-medium hover:text-red-800">Retry</button>
      </div>
    {/if}

    <!-- Desktop Table -->
    <div class="hidden md:block overflow-x-auto">
      <table class="min-w-full">
        <thead>
          <tr class="border-b border-gray-100">
            <th class="pl-6 pr-3 py-3.5 text-left"><span class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Visitor</span></th>
            <th class="px-3 py-3.5 text-left"><span class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Type & ID</span></th>
            <th class="px-3 py-3.5 text-left"><span class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Purpose</span></th>
            <th class="px-3 py-3.5 text-left"><span class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Time In</span></th>
            <th class="px-3 py-3.5 text-left"><span class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Time Out</span></th>
            <th class="px-3 py-3.5 text-left"><span class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Duration</span></th>
            <th class="pl-3 pr-6 py-3.5 text-left"><span class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Status</span></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          {#if recentVisitsLoading}
            {#each Array(5) as _}
              <tr>{#each Array(7) as _}<td class="px-3 py-4"><div class="h-4 bg-gray-100 rounded animate-pulse"></div></td>{/each}</tr>
            {/each}
          {:else if recentVisits.length === 0}
            <tr>
              <td colspan="7" class="px-6 py-14 text-center">
                <div class="flex flex-col items-center gap-3">
                  <div class="h-14 w-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <svg class="h-7 w-7 text-gray-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>
                    </svg>
                  </div>
                  <p class="text-sm font-semibold text-gray-500">No visits recorded today</p>
                  <p class="text-xs text-gray-400">Scans will appear here in real-time</p>
                </div>
              </td>
            </tr>
          {:else}
            {#each recentVisits as visit}
              <tr class="group hover:bg-slate-50/70 transition-colors duration-150">
                <td class="pl-6 pr-3 py-4 whitespace-nowrap">
                  <div class="flex items-center gap-3">
                    <div class="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow-sm">
                      <span class="text-xs font-bold text-white">{getInitial(visit.visitorName)}</span>
                    </div>
                    <p class="text-sm font-semibold text-gray-900">{visit.visitorName || '—'}</p>
                  </div>
                </td>
                <td class="px-3 py-4 whitespace-nowrap">
                  <div class="flex flex-col gap-1">
                    <span class={`inline-flex w-fit items-center px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wide border ${getTypeColor(visit.visitorType)}`}>{visit.visitorType || '—'}</span>
                    <span class="text-[11px] text-gray-400 font-mono">{visit.idNumber || '—'}</span>
                  </div>
                </td>
                <td class="px-3 py-4 max-w-[180px]"><p class="text-sm text-gray-700 truncate" title={visit.purpose}>{visit.purpose || '—'}</p></td>
                <td class="px-3 py-4 whitespace-nowrap">
                  <div class="flex items-center gap-1.5">
                    <div class="h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0"></div>
                    <span class="text-xs text-gray-700 font-medium">{formatDateTime(visit.timeIn)}</span>
                  </div>
                </td>
                <td class="px-3 py-4 whitespace-nowrap">
                  {#if visit.timeOut}
                    <div class="flex items-center gap-1.5">
                      <div class="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0"></div>
                      <span class="text-xs text-emerald-600 font-semibold">{formatDateTime(visit.timeOut)}</span>
                    </div>
                  {:else}
                    <span class="text-xs text-gray-300 italic">Still inside</span>
                  {/if}
                </td>
                <td class="px-3 py-4 whitespace-nowrap"><span class="text-xs text-gray-600 tabular-nums font-medium">{visit.duration}</span></td>
                <td class="pl-3 pr-6 py-4 whitespace-nowrap">
                  <div class="flex items-center gap-1.5">
                    <span class={`h-2 w-2 rounded-full flex-shrink-0 ${getStatusDot(visit.status)}`}></span>
                    <span class={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${getStatusColor(visit.status)}`}>
                      {visit.status === 'checked_in' ? 'Checked In' : 'Checked Out'}
                    </span>
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Mobile Cards -->
    <div class="md:hidden divide-y divide-gray-50">
      {#if recentVisitsLoading}
        {#each Array(3) as _}
          <div class="px-4 py-3 flex items-center gap-3">
            <div class="h-9 w-9 rounded-full bg-gray-100 animate-pulse flex-shrink-0"></div>
            <div class="flex-1 space-y-2">
              <div class="h-3.5 bg-gray-100 rounded animate-pulse w-2/3"></div>
              <div class="h-3 bg-gray-100 rounded animate-pulse w-1/2"></div>
              <div class="h-3 bg-gray-100 rounded animate-pulse w-3/4"></div>
            </div>
          </div>
        {/each}
      {:else if recentVisits.length === 0}
        <div class="p-10 text-center">
          <div class="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg class="h-6 w-6 text-gray-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>
            </svg>
          </div>
          <p class="text-sm font-medium text-gray-500">No visits today</p>
          <p class="text-xs text-gray-400 mt-1">Scans will appear here in real-time</p>
        </div>
      {:else}
        {#each recentVisits as visit}
          <div class="px-4 py-3">
            <div class="flex items-center gap-2.5 mb-1.5">
              <div class="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow-sm">
                <span class="text-[11px] font-bold text-white">{getInitial(visit.visitorName)}</span>
              </div>
              <p class="text-sm font-semibold text-gray-900 flex-1 min-w-0 truncate">{visit.visitorName || '—'}</p>
              <div class="flex items-center gap-1 flex-shrink-0">
                <span class={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${getStatusDot(visit.status)}`}></span>
                <span class={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${getStatusColor(visit.status)}`}>{visit.status === 'checked_in' ? 'In' : 'Out'}</span>
              </div>
            </div>
            <div class="flex items-center gap-2 ml-10 mb-1.5 flex-wrap">
              <span class={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold border flex-shrink-0 ${getTypeColor(visit.visitorType)}`}>{visit.visitorType || '—'}</span>
              <span class="text-[11px] text-gray-400 font-mono">{visit.idNumber || '—'}</span>
              {#if visit.purpose}<span class="text-[11px] text-gray-500 truncate max-w-[160px]">· {visit.purpose}</span>{/if}
            </div>
            <div class="flex items-center gap-2 ml-10 flex-wrap">
              <div class="flex items-center gap-1">
                <div class="h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0"></div>
                <span class="text-[11px] text-gray-500">{formatDateTime(visit.timeIn)}</span>
              </div>
              {#if visit.timeOut}
                <svg class="h-3 w-3 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                </svg>
                <div class="flex items-center gap-1">
                  <div class="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0"></div>
                  <span class="text-[11px] text-emerald-600 font-medium">{formatDateTime(visit.timeOut)}</span>
                </div>
                <span class="text-[11px] text-gray-400 tabular-nums ml-auto">{visit.duration}</span>
              {:else}
                <span class="text-[11px] text-blue-400 italic">Still inside</span>
              {/if}
            </div>
          </div>
        {/each}
      {/if}
    </div>

    {#if recentVisits.length > 0 && !recentVisitsLoading}
      <div class="px-6 py-3 border-t border-gray-100 bg-gray-50/40 flex items-center justify-between">
        <p class="text-xs text-gray-400">
          Showing <span class="font-semibold text-gray-600">{recentVisits.length}</span> most recent visits today
        </p>
        <a href="/dashboard/report/visits"
          class="text-xs text-slate-700 font-semibold hover:text-slate-900 flex items-center gap-1 transition-colors">
          View all visit logs
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
          </svg>
        </a>
      </div>
    {/if}
  </div>

</div>

<style>
  .overflow-y-auto::-webkit-scrollbar { width: 6px; }
  .overflow-y-auto::-webkit-scrollbar-track { background: #f8fafc; border-radius: 10px; }
  .overflow-y-auto::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
  .overflow-y-auto::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
  .overflow-y-auto { scrollbar-width: thin; scrollbar-color: #cbd5e1 #f8fafc; }
  .animate-spin { animation: spin 1s linear infinite; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>