<script lang="ts">
  import { createEventDispatcher, onDestroy } from "svelte";
  import { Html5Qrcode } from "html5-qrcode";

  export let open = false;
  export let user: { id?: number; username?: string; role?: string; email?: string } | null = null;
  export let transaction: {
    id: number;
    itemTitle?: string;
    itemId?: string | number;
    userName?: string;
    userId?: string | number;
    bookTitle?: string;
    bookId?: string | number;
    memberName?: string;
    memberId?: string | number;
    itemType?: string;
    copyId?: number;
    dueDate?: string;
    [key: string]: any;
  } | null = null;
  export let finePerDay: number = 5.00;

  const dispatch = createEventDispatcher();

  // Verification state
  let verificationMethod: "password" | "qrcode" = "password";
  let password = "";
  let showPassword = false;
  let errorMessage = "";
  let isSubmitting = false;

  // Fine calculation
  let fineAmount: number = 0;
  let isOverdue = false;
  let overdueHours = 0;
  let overdueDays = 0;

  function calculateFine() {
    if (!transaction) return;
    if ((transaction as any).fine !== undefined) {
      // server returns fine in pesos (decimal)
      const finePesos = Number((transaction as any).fine) || 0;
      fineAmount = finePesos; // already in pesos for display
      overdueDays = Number((transaction as any).daysOverdue) || 0;
      isOverdue = overdueDays > 0 || fineAmount > 0;
      // each hour = 5.00 pesos -> compute hours from pesos
      overdueHours = Math.ceil(finePesos / 5);
      return;
    }
    if (transaction.dueDate) {
      const dueDate = new Date(transaction.dueDate);
      const today = new Date();
      const diffMs = today.getTime() - dueDate.getTime();
      if (diffMs > 0) {
        isOverdue = true;
        overdueHours = Math.ceil(diffMs / (1000 * 60 * 60));
        overdueDays = Math.floor(overdueHours / 24);
        fineAmount = overdueHours * finePerDay;
      } else {
        isOverdue = false;
        overdueHours = 0;
        overdueDays = 0;
        fineAmount = 0;
      }
    }
  }

  $: if (transaction) calculateFine();

  function formatFine(amount: number) {
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function formatDate(dateString: string | undefined) {
    if (!dateString) return 'N/A';
    try {
      const d = new Date(dateString);
      return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateString;
    }
  }

  // QR Scanner state
  let showScanner = false;
  let html5QrCode: Html5Qrcode | null = null;
  let qrRegionId = "qr-scanner-region";
  let scannerStatus = "Starting...";
  let cameraDevices: MediaDeviceInfo[] = [];
  let selectedDeviceId = "";
  let scannedQrToken = "";

  async function getCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      cameraDevices = devices.filter(d => d.kind === "videoinput");
      if (cameraDevices.length > 0 && !selectedDeviceId) {
        selectedDeviceId = cameraDevices[0].deviceId;
      }
    } catch { cameraDevices = []; }
  }

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
        { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0 },
        (decodedText: string) => handleQRCodeScanned(decodedText),
        () => {}
      );
      scannerStatus = "Scanning...";
    } catch (error: any) {
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
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

  async function stopCamera() {
    if (html5QrCode) {
      try {
        if (html5QrCode.getState() === 2) await html5QrCode.stop();
        html5QrCode.clear();
      } catch {}
      html5QrCode = null;
    }
  }

  async function handleQRCodeScanned(qrData: string) {
    if (!qrData || isSubmitting) return;
    scannedQrToken = qrData;
    scannerStatus = "QR Code Detected!";
    isSubmitting = true;
    await stopCamera();
    showScanner = false;
    await submitReturn("qrcode", "", qrData);
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
    errorMessage = "";
  }

  async function submitReturn(method: "password" | "qrcode", pwd: string, qrData: string) {
    if (!transaction) return;
    errorMessage = "";
    try {
      const adminUser = user && (user.role === 'admin' || user.role === 'super_admin');
      const payload: any = {};
      if (adminUser) {
        payload.method = 'admin';
        payload.admin = { username: user?.username || null };
      } else {
        payload.method = method;
        if (method === 'password') payload.password = pwd;
        if (method === 'qrcode') payload.qrData = qrData;
      }
      dispatch('confirm', payload);
    } catch (err: any) {
      errorMessage = 'Failed to prepare return. Please try again.';
    }
  }

  async function handleConfirm() {
    errorMessage = "";
    if (verificationMethod === "password") {
      if (!password.trim()) { errorMessage = "Password is required"; return; }
      await submitReturn("password", password, "");
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

  onDestroy(() => stopCamera());
  $: if (showScanner) getCameras();

  $: isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');
  $: displayTitle = transaction?.itemTitle ?? transaction?.bookTitle ?? '—';
  $: displayItemId = transaction?.itemId ?? transaction?.bookId ?? '—';
  $: displayMemberName = transaction?.userName ?? transaction?.memberName ?? '—';
  $: displayMemberId = transaction?.userId ?? transaction?.memberId ?? '—';
</script>

<!-- Main Return Modal -->
{#if open && transaction && !showScanner}
  <div
    class="fixed inset-0 flex items-end sm:items-center justify-center z-50"
    style="backdrop-filter: blur(8px); background: rgba(15, 23, 42, 0.45);"
    on:click|self={close}
    role="dialog"
    aria-modal="true"
    aria-label="Return book"
  >
    <div class="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-gray-100 w-full sm:max-w-lg max-h-[95vh] sm:max-h-[92vh] overflow-y-auto scrollbar-hide flex flex-col">

      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl flex-shrink-0">
        <div class="flex items-center gap-3">
          <div class="h-9 w-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <svg class="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"/>
            </svg>
          </div>
          <div>
            <h3 class="text-base font-bold text-gray-900">Return Book</h3>
            <p class="text-xs text-gray-400 mt-0.5">Transaction #{transaction.id.toString().padStart(6, '0')}</p>
          </div>
        </div>
        <button
          on:click={close}
          class="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-150"
          aria-label="Close"
          disabled={isSubmitting}
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="px-6 py-5 space-y-5 flex-1">

        <!-- Item + Member cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="bg-gray-50 rounded-xl border border-gray-100 p-4">
            <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5">Item</p>
            <div class="flex items-start gap-3">
              <div class="h-9 w-9 rounded-xl bg-slate-200 flex items-center justify-center flex-shrink-0">
                <svg class="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/>
                </svg>
              </div>
              <div class="min-w-0">
                <p class="text-sm font-semibold text-gray-900 truncate leading-snug">{displayTitle}</p>
                {#if transaction.callNumber}
                  <p class="text-[11px] text-gray-500 font-mono mt-0.5">Call No: {transaction.callNumber}</p>
                {/if}
                <p class="text-[11px] text-gray-400 font-mono mt-0.5">#{displayItemId}</p>
              </div>
            </div>
          </div>

          <div class="bg-gray-50 rounded-xl border border-gray-100 p-4">
            <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5">Member</p>
            <div class="flex items-start gap-3">
              <div class="h-9 w-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center flex-shrink-0 shadow-sm">
                <span class="text-sm font-bold text-white">
                  {displayMemberName?.charAt(0)?.toUpperCase() ?? 'U'}
                </span>
              </div>
              <div class="min-w-0">
                <p class="text-sm font-semibold text-gray-900 truncate leading-snug">{displayMemberName}</p>
                <p class="text-[11px] text-gray-400 font-mono mt-0.5">{displayMemberId ? `ID ${displayMemberId}` : '—'}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Due date row -->
        {#if transaction.dueDate}
          <div class="flex items-center gap-3 bg-gray-50 rounded-xl border border-gray-100 px-4 py-3">
            <div class="h-1.5 w-1.5 rounded-full flex-shrink-0 {isOverdue ? 'bg-red-400' : 'bg-amber-400'}"></div>
            <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-wide w-10 flex-shrink-0">Due</span>
            <span class="text-xs font-medium {isOverdue ? 'text-red-600' : 'text-gray-700'}">{formatDate(transaction.dueDate)}</span>
          </div>
        {/if}

        <!-- Fine alert (overdue) or success badge (on time) -->
        {#if isOverdue}
          <div class="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <div class="h-9 w-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg class="h-5 w-5 text-red-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-bold text-red-800 uppercase tracking-wide mb-2">Overdue Fine</p>
              <div class="space-y-1.5">
                <div class="flex items-baseline justify-between text-xs">
                  <span class="text-red-700">Overdue time</span>
                  <span class="font-semibold text-red-800">{overdueHours}h ({overdueDays}d)</span>
                </div>
                <div class="flex items-baseline justify-between text-xs">
                  <span class="text-red-700">Rate</span>
                  <span class="font-semibold text-red-800">₱{finePerDay.toFixed(2)}/hour</span>
                </div>
                <div class="flex items-baseline justify-between text-sm pt-2 border-t border-red-200 mt-1">
                  <span class="font-bold text-red-900">Total Fine</span>
                  <span class="font-bold text-red-700 text-base">{formatFine(fineAmount)}</span>
                </div>
              </div>
              <p class="text-[11px] text-red-500 mt-2.5">⚠ Collect this fine from the member before completing the return.</p>
            </div>
          </div>
        {:else}
          <div class="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
            <svg class="h-4 w-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <div>
              <p class="text-xs font-semibold text-emerald-800">On-time return</p>
              <p class="text-[11px] text-emerald-600 mt-0.5">No fine applicable for this return.</p>
            </div>
          </div>
        {/if}

        <!-- Return policy info -->
        <div class="flex items-start gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
          <svg class="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/>
          </svg>
          <div class="text-[11px] text-gray-500 space-y-0.5">
            <span class="font-semibold text-gray-600">Return Policy</span>
            <span class="block">Late fee: ₱{finePerDay.toFixed(2)}/hour · Fees calculated automatically · Report damaged books immediately</span>
          </div>
        </div>

        <!-- Verification method -->
        <div>
          <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5">
            {isAdmin ? 'Admin Verification' : 'Staff Verification'}
          </p>

          {#if isAdmin}
            <div class="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <svg class="h-4 w-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/>
              </svg>
              <p class="text-xs font-medium text-blue-700">Confirming as admin — no password required</p>
            </div>
          {:else}
            <!-- Method toggle tabs -->
            <div class="flex border border-gray-200 rounded-xl overflow-hidden mb-4 bg-gray-50 p-1 gap-1">
              <button
                on:click={() => verificationMethod = "password"}
                disabled={isSubmitting}
                class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-150
                  {verificationMethod === 'password'
                    ? 'bg-white text-slate-900 shadow-sm border border-gray-200'
                    : 'text-gray-500 hover:text-gray-700'}"
              >
                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/>
                </svg>
                Password
              </button>
              <button
                on:click={() => verificationMethod = "qrcode"}
                disabled={isSubmitting}
                class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all duration-150
                  {verificationMethod === 'qrcode'
                    ? 'bg-white text-slate-900 shadow-sm border border-gray-200'
                    : 'text-gray-500 hover:text-gray-700'}"
              >
                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"/>
                </svg>
                QR Code
              </button>
            </div>

            <!-- Password input -->
            {#if verificationMethod === "password"}
              <div>
                <div class="relative">
                  <input
                    id="password-input"
                    type={showPassword ? "text" : "password"}
                    bind:value={password}
                    placeholder="Enter your staff password"
                    class="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none pr-11 transition-all duration-150 disabled:opacity-50"
                    disabled={isSubmitting}
                    on:keydown={(e) => e.key === 'Enter' && handleConfirm()}
                  />
                  <button
                    type="button"
                    on:click={() => showPassword = !showPassword}
                    class="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                    disabled={isSubmitting}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {#if showPassword}
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/>
                      </svg>
                    {:else}
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                      </svg>
                    {/if}
                  </button>
                </div>
                <p class="text-[11px] text-gray-400 mt-1.5">Enter your currently logged-in staff account password</p>
              </div>
            {/if}

            <!-- QR info panel -->
            {#if verificationMethod === "qrcode"}
              <div class="border border-dashed border-gray-200 rounded-xl p-4 text-center bg-gray-50">
                <div class="h-10 w-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center mx-auto mb-2 shadow-sm">
                  <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"/>
                  </svg>
                </div>
                <p class="text-xs font-semibold text-gray-700">QR Code Scanner</p>
                <p class="text-[11px] text-gray-400 mt-0.5 mb-2">Scan the book's QR code to verify return</p>
                <p class="text-[11px] font-semibold text-emerald-600">Click "Open Scanner" below to begin</p>
              </div>
            {/if}
          {/if}

          <!-- Error -->
          {#if errorMessage}
            <div class="mt-3 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <svg class="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
              </svg>
              <p class="text-xs font-medium text-red-800">{errorMessage}</p>
            </div>
          {/if}
        </div>

      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-gray-100 bg-gray-50/60 flex gap-3 flex-shrink-0">
        <button
          on:click={close}
          disabled={isSubmitting}
          class="px-5 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-white hover:border-gray-300 transition-all duration-150 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          on:click={handleConfirm}
          disabled={(verificationMethod === "password" && !isAdmin && !password.trim()) || isSubmitting}
          class="flex-1 px-4 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 active:scale-95 transition-all duration-150 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2"
        >
          {#if isSubmitting}
            <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          {:else if verificationMethod === "qrcode" && !isAdmin}
            <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5z"/>
            </svg>
            Open Scanner
          {:else}
            <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"/>
            </svg>
            Confirm Return
          {/if}
        </button>
      </div>

    </div>
  </div>
{/if}

<!-- QR Scanner overlay -->
{#if showScanner}
  <div
    class="fixed inset-0 flex items-end sm:items-center justify-center z-[60]"
    style="backdrop-filter: blur(8px); background: rgba(0, 0, 0, 0.6);"
    role="dialog"
    aria-modal="true"
    aria-label="QR Scanner"
  >
    <div class="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-gray-100 w-full sm:max-w-md overflow-hidden flex flex-col" style="max-height: 90vh;">

      <!-- Scanner Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
        <div class="flex items-center gap-3">
          <div class="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
            <svg class="h-5 w-5 text-slate-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"/>
            </svg>
          </div>
          <div>
            <h3 class="text-base font-bold text-gray-900">Scan QR Code</h3>
            <p class="text-xs text-gray-400 mt-0.5">Position the code within the frame</p>
          </div>
        </div>
        <button
          on:click={cancelScan}
          class="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-150"
          aria-label="Close scanner"
          disabled={isSubmitting}
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Camera selector -->
      {#if cameraDevices.length > 1}
        <div class="px-6 py-3 border-b border-gray-100 bg-gray-50/60 flex-shrink-0">
          <select
            class="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white"
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

      <!-- Camera view -->
      <div class="relative bg-black flex-1 overflow-hidden" style="min-height: 280px;">
        {#if errorMessage && !isSubmitting}
          <div class="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-10 p-6">
            <div class="h-12 w-12 rounded-2xl bg-red-900/40 flex items-center justify-center mb-3">
              <svg class="h-6 w-6 text-red-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <p class="text-sm font-semibold text-white mb-1">Camera Error</p>
            <p class="text-xs text-gray-400 text-center max-w-xs">{errorMessage}</p>
            <button
              on:click={cancelScan}
              class="mt-4 px-4 py-2 bg-white text-gray-900 rounded-lg text-xs font-semibold hover:bg-gray-100 transition-colors"
            >
              Close Scanner
            </button>
          </div>
        {:else if isSubmitting}
          <div class="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-10 p-6">
            <svg class="animate-spin h-10 w-10 text-emerald-400 mb-3" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p class="text-sm font-semibold text-white mb-1">Processing Return...</p>
            <p class="text-xs text-gray-400">Please wait</p>
          </div>
        {:else}
          <div id={qrRegionId} class="w-full h-full absolute inset-0"></div>
          <!-- Status badge -->
          <div class="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-[11px] font-semibold z-20 border border-white/10">
            <span class="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
            {scannerStatus}
          </div>
        {/if}
      </div>

      <!-- Scanner footer -->
      <div class="px-6 py-4 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between flex-shrink-0">
        <div class="flex items-center gap-2 text-[11px] text-gray-400">
          <svg class="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/>
          </svg>
          <span class="font-medium">Secure verification</span>
        </div>
        <button
          on:click={cancelScan}
          disabled={isSubmitting}
          class="px-4 py-2 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-white transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>

    </div>
  </div>
{/if}

<style>
  .scrollbar-hide { scrollbar-width: none; -ms-overflow-style: none; }
  .scrollbar-hide::-webkit-scrollbar { display: none; }

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
  :global(#qr-scanner-region__dashboard_section),
  :global(#qr-scanner-region__header_message),
  :global(#qr-scanner-region__scan_region) {
    display: none !important;
    border: none !important;
  }
</style>