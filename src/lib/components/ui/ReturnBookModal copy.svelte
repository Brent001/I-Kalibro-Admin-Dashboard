<script lang="ts">
  import { createEventDispatcher, onDestroy } from "svelte";
  import { Html5Qrcode } from "html5-qrcode";

  export let open = false;
  export let transaction: {
    id: number;
    bookTitle?: string;
    memberName?: string;
    memberId?: string | number;
    bookId?: string | number;
  } | null = null;
  export let customDueDate: string = "";
  export let finePerDay: number = 5.00;

  const dispatch = createEventDispatcher();

  // Modal state
  let verificationMethod: "password" | "qrcode" = "password";
  let password = "";
  let showPassword = false;
  let errorMessage = "";
  let isSubmitting = false;

  // QR Scanner state
  let showScanner = false;
  let html5QrCode: Html5Qrcode | null = null;
  let qrRegionId = "qr-scanner-region";
  let scannerStatus = "Starting...";
  let cameraDevices: MediaDeviceInfo[] = [];
  let selectedDeviceId = "";
  let scannedQrToken = "";

  // Utility: always return number or null
  function getNum(val: string | number | undefined): number | null {
    if (val === undefined || val === null) return null;
    const num = typeof val === "number" ? val : Number(val);
    return isNaN(num) ? null : num;
  }

  // Get available cameras
  async function getCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      cameraDevices = devices.filter(d => d.kind === "videoinput");
      if (cameraDevices.length > 0 && !selectedDeviceId) {
        selectedDeviceId = cameraDevices[0].deviceId;
      }
    } catch (e) {
      cameraDevices = [];
    }
  }

  // Start QR code scanner
  async function startCamera() {
    errorMessage = "";
    scannerStatus = "Starting...";
    try {
      await stopCamera();
      await navigator.mediaDevices.getUserMedia({ video: true });
      if (!cameraDevices.length) await getCameras();
      const cameraId = selectedDeviceId || cameraDevices[0]?.deviceId;
      if (!cameraId) throw new Error("No camera found");
      html5QrCode = new Html5Qrcode(qrRegionId);
      await html5QrCode.start(
        cameraId,
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        (decodedText: string) => handleQRCodeScanned(decodedText),
        () => {}
      );
      scannerStatus = "Scanning...";
    } catch (error: any) {
      if (error.message === "Camera permission denied" ||
          error.name === "NotAllowedError" ||
          error.name === "PermissionDeniedError") {
        errorMessage = "Camera permission denied. Please allow camera access.";
      } else if (error.name === "NotFoundError" || error.message === "No camera found") {
        errorMessage = "No camera found on this device.";
      } else if (error.name === "NotReadableError") {
        errorMessage = "Camera is in use by another application.";
      } else {
        errorMessage = "Unable to access camera. Please try again.";
      }
      scannerStatus = "Error";
    }
  }

  // Stop QR code scanner
  async function stopCamera() {
    if (html5QrCode) {
      try {
        if (html5QrCode.getState() === 2) await html5QrCode.stop();
        html5QrCode.clear();
      } catch {}
      html5QrCode = null;
    }
  }

  // Handle QR code scan
  async function handleQRCodeScanned(qrData: string) {
    if (!qrData || isSubmitting) return;
    scannedQrToken = qrData;
    scannerStatus = "QR Code Detected!";
    await stopCamera();
    showScanner = false;
    dispatch("confirm", {
      method: "qrcode",
      password: "",
      qrData,
      bookId: getNum(transaction?.bookId),
      memberId: getNum(transaction?.memberId)
    });
    close();
    setTimeout(() => {
      scannedQrToken = "";
      scannerStatus = "Starting...";
    }, 500);
  }

  async function handleCameraChange() {
    if (html5QrCode && selectedDeviceId) await startCamera();
  }

  function openQRScanner() {
    showScanner = true;
    scannedQrToken = "";
    errorMessage = "";
    scannerStatus = "Starting...";
    setTimeout(() => startCamera(), 100);
  }

  function cancelScan() {
    stopCamera();
    showScanner = false;
    scannedQrToken = "";
    scannerStatus = "Starting...";
  }

  async function handleConfirm() {
    errorMessage = "";
    if (verificationMethod === "password") {
      if (!password.trim()) {
        errorMessage = "Password is required";
        return;
      }
      dispatch("confirm", {
        method: verificationMethod,
        password,
        qrData: "",
        bookId: transaction?.bookId ? Number(transaction.bookId) : null,
        memberId: transaction?.memberId ? Number(transaction.memberId) : null
      });
      close();
    } else if (verificationMethod === "qrcode") {
      openQRScanner();
    }
  }

  function close() {
    stopCamera();
    resetForm();
    dispatch("close");
  }

  function resetForm() {
    password = "";
    errorMessage = "";
    verificationMethod = "password";
    showScanner = false;
    scannedQrToken = "";
    isSubmitting = false;
  }

  onDestroy(() => {
    stopCamera();
  });

  $: if (showScanner) getCameras();
</script>

{#if open && transaction && !showScanner}
  <div class="fixed inset-0 flex items-end sm:items-center justify-center z-50" style="backdrop-filter: blur(8px); background: rgba(0, 0, 0, 0.5);">
    <div class="bg-white rounded-t-2xl sm:rounded-lg shadow-xl w-full sm:max-w-3xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto scrollbar-hide">
      
      <!-- Header -->
      <div class="bg-gradient-to-r from-green-600 to-green-700 px-4 py-4 sm:px-6 sm:py-5 rounded-t-2xl sm:rounded-t-lg sticky top-0 z-10">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg sm:text-xl font-semibold text-white">Return Book</h2>
            <p class="text-xs sm:text-sm text-green-100 mt-1">Transaction #{transaction.id}</p>
          </div>
          <button
            on:click={close}
            class="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors flex-shrink-0"
            aria-label="Close"
            disabled={isSubmitting}
          >
            <svg class="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="p-4 sm:p-6">
        
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
          <!-- Book Information -->
          <div class="bg-gray-50 p-3 sm:p-4 rounded-lg border border-gray-200">
            <div class="flex items-start mb-2">
              <div class="h-9 w-9 sm:h-10 sm:w-10 bg-green-100 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                <svg class="h-5 w-5 sm:h-6 sm:w-6 text-green-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/>
                </svg>
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-xs text-gray-500 uppercase tracking-wide font-semibold">Book</p>
                <h3 class="text-sm sm:text-base font-semibold text-gray-900 truncate">{transaction.bookTitle}</h3>
              </div>
            </div>
            <p class="text-xs sm:text-sm text-gray-600 ml-12">ID: <span class="font-mono text-green-700">{transaction.bookId}</span></p>
          </div>

          <!-- Member Information -->
          <div class="bg-gray-50 p-3 sm:p-4 rounded-lg border border-gray-200">
            <div class="flex items-start mb-2">
              <div class="h-9 w-9 sm:h-10 sm:w-10 bg-green-600 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                <span class="text-base sm:text-lg font-bold text-white">
                  {transaction.memberName?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-xs text-gray-500 uppercase tracking-wide font-semibold">Member</p>
                <h3 class="text-sm sm:text-base font-semibold text-gray-900 truncate">{transaction.memberName}</h3>
              </div>
            </div>
            <p class="text-xs sm:text-sm text-gray-600 ml-12">ID: <span class="font-mono text-green-700">{transaction.memberId}</span></p>
          </div>
        </div>

        <!-- Library Policy -->
        <div class="mb-4 sm:mb-6 bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
          <div class="flex items-start">
            <svg class="h-5 w-5 text-green-600 mr-2 sm:mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/>
            </svg>
            <div class="flex-1 min-w-0">
              <p class="text-xs sm:text-sm font-semibold text-gray-900 mb-2">Return Policy</p>
              <div class="space-y-1 text-xs text-gray-700">
                <div>• Late fee: <span class="font-semibold text-green-700">₱{finePerDay.toFixed(2)}/hour</span></div>
                <div>• Fees calculated automatically</div>
                <div>• Report damaged books immediately</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Member Verification -->
        <div class="mb-4 sm:mb-6">
          <h3 class="text-xs sm:text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Staff Verification Required</h3>

          <!-- Verification Tabs -->
          <div class="flex border border-gray-300 rounded-lg overflow-hidden mb-4">
            <button
              on:click={() => verificationMethod = "password"}
              class="flex-1 px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm font-medium transition-all {verificationMethod === 'password' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}"
              disabled={isSubmitting}
            >
              <svg class="h-4 w-4 sm:h-5 sm:w-5 inline mr-1 sm:mr-2 -mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/>
              </svg>
              <span class="hidden xs:inline">Password</span>
              <span class="xs:hidden">Pass</span>
            </button>
            <button
              on:click={() => verificationMethod = "qrcode"}
              class="flex-1 px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm font-medium border-l border-gray-300 transition-all {verificationMethod === 'qrcode' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}"
              disabled={isSubmitting}
            >
              <svg class="h-4 w-4 sm:h-5 sm:w-5 inline mr-1 sm:mr-2 -mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"/>
              </svg>
              <span class="hidden xs:inline">QR Code</span>
              <span class="xs:hidden">QR</span>
            </button>
          </div>

          <!-- Password Input -->
          {#if verificationMethod === "password"}
            <div>
              <label for="password-input" class="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                Staff Password
              </label>
              <div class="relative">
                <input
                  id="password-input"
                  type={showPassword ? "text" : "password"}
                  bind:value={password}
                  placeholder="Enter staff password"
                  class="w-full px-3 py-2.5 sm:px-4 sm:py-3 pr-10 sm:pr-11 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  on:click={() => showPassword = !showPassword}
                  class="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  disabled={isSubmitting}
                >
                  {#if showPassword}
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/>
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                  {/if}
                </button>
              </div>
              <p class="text-xs text-gray-500 mt-2">Enter the staff account password to authorize return</p>
            </div>
          {/if}

          <!-- QR Code Info -->
          {#if verificationMethod === "qrcode"}
            <div class="border-2 border-dashed border-gray-300 rounded-lg p-3 sm:p-4 text-center bg-gray-50">
              <svg class="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"/>
              </svg>
              <p class="text-xs sm:text-sm font-medium text-gray-900 mb-0.5">QR Code Scanner</p>
              <p class="text-xs text-gray-500 mb-3">Scan user or book QR code to verify return</p>
              <p class="text-xs text-green-600 font-semibold">Click "Open Scanner" to begin</p>
            </div>
          {/if}

          <!-- Error Message -->
          {#if errorMessage}
            <div class="mt-4 bg-red-50 border-l-4 border-red-500 p-3 rounded flex items-start gap-2">
              <svg class="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
              </svg>
              <span class="text-xs sm:text-sm text-red-800 font-medium">
                {errorMessage}
              </span>
            </div>
          {/if}
        </div>

        <!-- Action Buttons -->
        <div class="flex gap-2 sm:gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white -mx-4 sm:-mx-6 px-4 sm:px-6 pb-4 sm:pb-6">
          <button
            on:click={close}
            class="px-4 py-2.5 sm:px-6 sm:py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            on:click={handleConfirm}
            disabled={(verificationMethod === "password" && !password.trim()) || isSubmitting}
            class="flex-1 px-4 py-2.5 sm:px-6 sm:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-green-600 disabled:shadow-none text-sm sm:text-base flex items-center justify-center gap-2"
          >
            {#if isSubmitting}
              <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Processing...</span>
            {:else}
              <span class="hidden sm:inline">{verificationMethod === "qrcode" ? "Open Scanner" : "Confirm Return"}</span>
              <span class="sm:hidden">{verificationMethod === "qrcode" ? "Open Scanner" : "Confirm"}</span>
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if showScanner}
  <div class="fixed inset-0 flex items-center justify-center p-3 sm:p-4 z-[60]" style="backdrop-filter: blur(8px); background: rgba(0,0,0,0.5);">
    <div class="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden border border-green-200 flex flex-col">
      
      <!-- Scanner Header -->
      <div class="bg-gradient-to-r from-green-700 to-green-500 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div class="flex items-center gap-2">
          <div class="h-9 w-9 bg-white bg-opacity-20 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg class="h-5 w-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="7" rx="2"/>
              <rect x="14" y="3" width="7" height="7" rx="2"/>
              <rect x="14" y="14" width="7" height="7" rx="2"/>
              <rect x="3" y="14" width="7" height="7" rx="2"/>
            </svg>
          </div>
          <div class="min-w-0">
            <h3 class="text-sm sm:text-base font-semibold truncate">Scan QR Code</h3>
            <p class="text-xs text-green-100">Position code in frame</p>
          </div>
        </div>
        <button
          on:click={cancelScan}
          class="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-1.5 transition-colors flex-shrink-0"
          aria-label="Close scanner"
          disabled={isSubmitting}
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Camera Picker -->
      {#if cameraDevices.length > 1}
        <div class="px-4 py-2.5 bg-gray-50 border-b border-green-100 flex-shrink-0">
          <label class="block text-xs font-medium text-gray-700 mb-1.5">Select Camera</label>
          <select
            class="w-full px-3 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
            bind:value={selectedDeviceId}
            on:change={handleCameraChange}
            disabled={isSubmitting}
          >
            {#each cameraDevices as cam, i}
              <option value={cam.deviceId}>{cam.label || `Camera ${i + 1}`}</option>
            {/each}
          </select>
        </div>
      {/if}

      <!-- Camera View -->
      <div class="relative flex items-center justify-center bg-black flex-1 min-h-0 overflow-hidden" style="min-height: 280px;">
        {#if errorMessage && !isSubmitting}
          <div class="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-90 z-10 p-4">
            <svg class="h-12 w-12 text-red-400 mb-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p class="text-sm sm:text-base text-red-200 font-semibold mb-1.5 text-center">Camera Error</p>
            <p class="text-xs text-gray-300 mb-3 text-center max-w-xs">{errorMessage}</p>
            <button
              on:click={cancelScan}
              class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors text-sm"
            >
              Close Scanner
            </button>
          </div>
        {:else if isSubmitting}
          <div class="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-90 z-10 p-4">
            <svg class="animate-spin h-12 w-12 text-green-400 mb-3" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p class="text-sm sm:text-base text-white font-semibold mb-1.5 text-center">Processing Return...</p>
            <p class="text-xs text-gray-300 text-center">Please wait</p>
          </div>
        {:else}
          <!-- html5-qrcode region -->
          <div id={qrRegionId} class="w-full h-full absolute inset-0"></div>
          
          <!-- Status indicator -->
          <div class="absolute top-3 left-3 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center shadow-lg z-20">
            <span class="h-1.5 w-1.5 bg-white rounded-full mr-1.5 animate-pulse"></span>
            {scannerStatus}
          </div>
        {/if}
      </div>

      <!-- Scanner Footer -->
      <div class="px-4 py-2.5 bg-gray-50 border-t border-green-100 flex items-center justify-between flex-shrink-0">
        <div class="flex items-center text-xs text-gray-600">
          <svg class="h-4 w-4 text-green-600 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/>
          </svg>
          <span class="font-medium">Secure verification</span>
        </div>
        <button
          on:click={cancelScan}
          class="px-3 py-1.5 sm:px-4 sm:py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isSubmitting}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  /* Extra small breakpoint for very small phones */
  @media (min-width: 375px) {
    .xs\:inline {
      display: inline;
    }
    .xs\:hidden {
      display: none;
    }
  }

  @media (max-width: 640px) {
    button {
      min-height: 44px;
      min-width: 44px;
    }
  }

  :global(#qr-scanner-region) {
    width: 100% !important;
    height: 100% !important;
    border: none !important;
  }

  :global(#qr-scanner-region video) {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
    border: none !important;
  }

  :global(#qr-scanner-region__dashboard_section) {
    display: none !important;
  }

  :global(#qr-scanner-region__header_message) {
    display: none !important;
  }

  :global(#qr-scanner-region__scan_region) {
    border: none !important;
  }
</style>