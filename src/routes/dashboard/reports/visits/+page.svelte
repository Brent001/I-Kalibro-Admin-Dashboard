<script lang="ts">
  import { onMount } from "svelte";
  import { slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  // Add this to get user type from SSR data (if available)
  export let data: { user?: { userType?: string } };
  $: userType = data?.user?.userType || "";

  let visits: any[] = [];
  let loading = true;
  let errorMsg = "";
  let successMsg = "";
  let qrCodeDataUrl: string = "";
  let showQrModal = false;
  let showTypeSelectionModal = false;
  let generatedToken: string = "";
  let existingQRCodes: { id: number; token: string; type: string }[] = [];
  let selectedQr: { id: number; token: string; type: string } | null = null;
  let selectedQrDataUrl: string = "";

  // Filter state
  let selectedPeriod = "month";
  let selectedDate = "";
  let selectedTime = "";
  let searchTerm = "";

  const periodOptions = [
    { value: "day", label: "Today" },
    { value: "week", label: "Last 7 Days" },
    { value: "month", label: "Last 30 Days" },
    { value: "year", label: "Last 12 Months" },
    { value: "all", label: "All Time" }
  ];

  let selectedQrType = "library_visit";
  const qrTypeOptions = [
    { value: "library_visit", label: "Library Visit", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z", description: "For tracking library check-ins and check-outs" },
    { value: "book_qr", label: "Book QR Code", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253", description: "For identifying specific books in the library" }
  ];

  let filterType = "all";

  onMount(async () => {
    await loadVisits();
    await loadExistingQRCodes();
  });

  async function loadVisits() {
    loading = true;
    errorMsg = "";
    try {
      let url = `/api/reports/visits?period=${selectedPeriod}`;
      if (selectedDate) url += `&date=${selectedDate}`;
      if (selectedTime) url += `&time=${selectedTime}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.visits)) {
        visits = data.visits.map((v: any) => {
          let duration = "—";
          if (v.timeIn && v.timeOut) {
            const inDate = new Date(v.timeIn);
            const outDate = new Date(v.timeOut);
            const diffMs = outDate.getTime() - inDate.getTime();
            if (diffMs > 0) {
              const mins = Math.floor(diffMs / 60000);
              const hours = Math.floor(mins / 60);
              const remMins = mins % 60;
              duration = hours > 0 ? `${hours}h ${remMins}m` : `${remMins} min`;
            }
          }
          return {
            ...v,
            purpose: v.purpose ?? "",
            status: v.status ?? (v.timeOut ? "checked_out" : "checked_in"), // <-- Ensure status is set
            duration
          };
        });
      } else {
        errorMsg = data.message || "Failed to load visits.";
        visits = [];
      }
    } catch (err) {
      errorMsg = "Network error. Please try again.";
      visits = [];
    } finally {
      loading = false;
    }
  }

  async function loadExistingQRCodes() {
    try {
      const res = await fetch(`/api/qrcode/gen_qrcode`);
      const data = await res.json();
      if (res.ok && data.success) {
        existingQRCodes = data.qrCodes;
      }
    } catch (err) {
      console.error("Failed to load QR codes:", err);
    }
  }

  async function handlePeriodChange() {
    await loadVisits();
  }

  async function handleDateChange() {
    await loadVisits();
  }

  async function handleTimeChange() {
    await loadVisits();
  }

  function openTypeSelectionModal() {
    showTypeSelectionModal = true;
  }

  async function generateQrCode(type: string) {
    if (userRole === "staff") {
      errorMsg = "Only admin can generate QR codes.";
      return;
    }
    showTypeSelectionModal = false;
    const res = await fetch("/api/qrcode/gen_qrcode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      generatedToken = data.token;
      selectedQrType = data.type;
      const QRCode = await import("qrcode");
      qrCodeDataUrl = await QRCode.toDataURL(generatedToken, { width: 256 });
      showQrModal = true;
      await loadExistingQRCodes();
      successMsg = "QR Code generated successfully!";
      setTimeout(() => successMsg = "", 3000);
    } else {
      errorMsg = data.message || "Failed to generate QR code.";
    }
  }

  function downloadQrCode(dataUrl: string, filename = "library-qrcode.png") {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    link.click();
  }

  async function deleteQrCode(qrId: number) {
    if (userRole === "staff") {
      errorMsg = "Only admin can delete QR codes.";
      return;
    }
    if (!confirm("Are you sure you want to delete this QR code?")) return;
    try {
      const res = await fetch(`/api/qrcode/gen_qrcode`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: qrId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await loadExistingQRCodes();
        if (selectedQr && selectedQr.id === qrId) {
          selectedQr = null;
          selectedQrDataUrl = "";
        }
        successMsg = "QR code deleted successfully!";
        setTimeout(() => successMsg = "", 3000);
      } else {
        errorMsg = data.message || "Failed to delete QR code.";
      }
    } catch (err) {
      errorMsg = "Network error. Please try again.";
    }
  }

  async function viewQrCode(qr: { id: number; token: string; type: string }) {
    selectedQr = qr;
    const QRCode = await import("qrcode");
    selectedQrDataUrl = await QRCode.toDataURL(qr.token, { width: 256 });
  }

  function resetFilters() {
    selectedDate = "";
    selectedTime = "";
    selectedPeriod = "month";
    searchTerm = "";
    loadVisits();
  }

  $: filteredVisits = visits.filter(visit => {
    const search = searchTerm.toLowerCase();
    const name = visit.visitorName || visit.user?.name || visit.fullName || "";
    const idNumber = visit.idNumber || "";
    const purpose = visit.purpose || "";
    
    return name.toLowerCase().includes(search) ||
           idNumber.toLowerCase().includes(search) ||
           purpose.toLowerCase().includes(search);
  });

  $: filteredQRCodes = filterType === "all" 
    ? existingQRCodes 
    : existingQRCodes.filter(qr => qr.type === filterType);

  function getStatusColor(status: string) {
    return status === 'checked_in'
      ? 'bg-blue-100 text-blue-800'
      : 'bg-green-100 text-green-800';
  }

  function getTypeColor(type: string) {
    switch (type) {
      case 'Student':
        return 'bg-slate-100 text-slate-800';
      case 'Faculty':
        return 'bg-slate-200 text-slate-900';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  }

  function getQrTypeLabel(type: string) {
    return qrTypeOptions.find(opt => opt.value === type)?.label || type;
  }

  function getQrTypeBadgeColor(type: string) {
    return type === 'library_visit' 
      ? 'bg-blue-100 text-blue-800' 
      : 'bg-purple-100 text-purple-800';
  }
</script>

<svelte:head>
  <title>Visit Reports | E-Kalibro Admin Portal</title>
</svelte:head>

<div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">Library Visit Management</h2>
        <p class="text-slate-600">Track visitor check-ins and manage QR codes</p>
      </div>
      <div class="flex gap-2">
        {#if userRole !== 'staff'}
          <button
            on:click={openTypeSelectionModal}
            class="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors duration-200"
          >
            <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <rect x="3" y="3" width="6" height="6" rx="1" />
              <rect x="15" y="3" width="6" height="6" rx="1" />
              <rect x="3" y="15" width="6" height="6" rx="1" />
              <rect x="15" y="15" width="6" height="6" rx="1" />
              <path d="M9 9h6v6H9z" />
            </svg>
            Generate QR Code
          </button>
        {/if}
        <button
          on:click={loadVisits}
          class="inline-flex items-center justify-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors duration-200"
          title="Refresh"
          aria-label="Refresh"
          type="button"
        >
          <!-- Updated refresh icon (Heroicons arrow-path) -->
          <svg class="h-5 w-5 mr-2 text-slate-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Refresh
        </button>
      </div>
    </div>

    <!-- Success/Error Messages -->
    {#if successMsg}
      <div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
        <div class="flex justify-between items-start">
          <div>
            <p class="font-medium">Success:</p>
            <p class="text-sm">{successMsg}</p>
          </div>
          <button on:click={() => successMsg = ""} class="text-green-400 hover:text-green-600" aria-label="Close success message">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
    {/if}
    {#if errorMsg}
      <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        <div class="flex justify-between items-start">
          <div>
            <p class="font-medium">Error:</p>
            <p class="text-sm">{errorMsg}</p>
            <button 
              on:click={loadVisits} 
              class="mt-2 text-sm text-red-800 hover:text-red-900 underline"
            >
              Try again
            </button>
          </div>
          <button on:click={() => errorMsg = ""} class="text-red-400 hover:text-red-600" aria-label="Close error message">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
    {/if}

    <!-- Stats Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
      <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center">
          <div class="p-3 bg-slate-100 rounded-xl">
            <svg class="h-6 w-6 text-slate-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-slate-600">Total Visits</p>
            <p class="text-2xl font-bold text-slate-900">{visits.length}</p>
          </div>
        </div>
      </div>
      <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center">
          <div class="p-3 bg-blue-100 rounded-xl">
            <svg class="h-6 w-6 text-blue-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-slate-600">Checked In</p>
            <p class="text-2xl font-bold text-slate-900">{visits.filter(v => v.status === 'checked_in').length}</p>
          </div>
        </div>
      </div>
      <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center">
          <div class="p-3 bg-emerald-100 rounded-xl">
            <svg class="h-6 w-6 text-emerald-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-slate-600">Checked Out</p>
            <p class="text-2xl font-bold text-slate-900">{visits.filter(v => v.status === 'checked_out').length}</p>
          </div>
        </div>
      </div>
      <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center">
          <div class="p-3 bg-purple-100 rounded-xl">
            <svg class="h-6 w-6 text-purple-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <rect x="3" y="3" width="6" height="6" rx="1" />
              <rect x="15" y="3" width="6" height="6" rx="1" />
              <rect x="3" y="15" width="6" height="6" rx="1" />
              <rect x="15" y="15" width="6" height="6" rx="1" />
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-slate-600">QR Codes</p>
            <p class="text-2xl font-bold text-slate-900">{existingQRCodes.length}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters and Search -->
    <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200">
      <div class="flex flex-col lg:flex-row gap-4">
        <div class="flex-1">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search by name, ID, or purpose..."
              bind:value={searchTerm}
              class="pl-10 pr-4 py-3 w-full border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors duration-200"
              disabled={loading}
            />
            {#if loading}
              <div class="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div class="animate-spin rounded-full h-4 w-4 border-2 border-slate-300 border-t-slate-600"></div>
              </div>
            {/if}
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <select
            bind:value={selectedPeriod}
            on:change={handlePeriodChange}
            class="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 bg-white text-slate-700 transition-colors duration-200"
            disabled={loading}
          >
            {#each periodOptions as period}
              <option value={period.value}>{period.label}</option>
            {/each}
          </select>
          <input
            type="date"
            bind:value={selectedDate}
            on:change={handleDateChange}
            class="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors duration-200"
            disabled={loading}
          />
          <input
            type="time"
            bind:value={selectedTime}
            on:change={handleTimeChange}
            class="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors duration-200"
            disabled={loading}
          />
          <button
            class="px-4 py-3 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors duration-200"
            on:click={resetFilters}
            disabled={loading}
          >
            Reset
          </button>
        </div>
      </div>
    </div>

    <!-- QR Type Selection Modal -->
    {#if showTypeSelectionModal}
      <div class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-2xl font-bold text-slate-900">Select QR Code Type</h3>
            <button 
              on:click={() => showTypeSelectionModal = false}
              class="text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Close modal"
            >
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          
          <p class="text-slate-600 mb-6">Choose the type of QR code you want to generate:</p>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            {#each qrTypeOptions as option}
              <button
                on:click={() => generateQrCode(option.value)}
                class="group relative p-6 border-2 border-slate-200 rounded-xl hover:border-slate-900 hover:shadow-lg transition-all duration-200 text-left"
                disabled={userRole === 'staff'}
                style={userRole === 'staff' ? 'opacity:0.5;cursor:not-allowed;' : ''}
              >
                <div class="flex items-start space-x-4">
                  <div class="p-3 bg-slate-100 rounded-lg group-hover:bg-slate-900 transition-colors duration-200">
                    <svg class="h-8 w-8 text-slate-700 group-hover:text-white transition-colors duration-200" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d={option.icon}/>
                    </svg>
                  </div>
                  <div class="flex-1">
                    <h4 class="text-lg font-semibold text-slate-900 mb-2">{option.label}</h4>
                    <p class="text-sm text-slate-600">{option.description}</p>
                  </div>
                </div>
                <div class="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <svg class="h-5 w-5 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                  </svg>
                </div>
              </button>
            {/each}
          </div>
          {#if userRole === 'staff'}
            <div class="mt-4 text-red-600 text-sm font-medium text-center">
              Only admin can generate QR codes.
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Generated QR Code Modal -->
    {#if showQrModal}
      <div class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-xl shadow-2xl p-6 flex flex-col items-center max-w-md w-full">
          <h3 class="text-xl font-bold text-slate-900 mb-2">
            QR Code Generated
          </h3>
          <span class={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium mb-4 ${getQrTypeBadgeColor(selectedQrType)}`}>
            {getQrTypeLabel(selectedQrType)}
          </span>
          {#if qrCodeDataUrl}
            <div class="bg-slate-50 p-4 rounded-lg mb-4">
              <img src={qrCodeDataUrl} alt="QR Code" class="w-64 h-64" />
            </div>
            <div class="mb-4 text-xs text-slate-500 break-all font-mono bg-slate-50 p-3 rounded-lg w-full">
              {generatedToken}
            </div>
          {/if}
          <div class="flex space-x-3 w-full">
            <button 
              class="flex-1 px-4 py-3 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors duration-200" 
              on:click={() => downloadQrCode(qrCodeDataUrl, `${selectedQrType}-${Date.now()}.png`)}
            >
              Download
            </button>
            <button 
              class="flex-1 px-4 py-3 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-colors duration-200" 
              on:click={() => showQrModal = false}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Existing QR Codes -->
    <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h3 class="text-lg font-semibold text-slate-900">Active QR Codes</h3>
        <div class="flex gap-2">
          <button
            on:click={() => filterType = "all"}
            class={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
              filterType === "all" 
                ? "bg-slate-900 text-white" 
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            All ({existingQRCodes.length})
          </button>
          <button
            on:click={() => filterType = "library_visit"}
            class={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
              filterType === "library_visit" 
                ? "bg-blue-600 text-white" 
                : "bg-blue-100 text-blue-700 hover:bg-blue-200"
            }`}
          >
            Library Visit ({existingQRCodes.filter(qr => qr.type === 'library_visit').length})
          </button>
          <button
            on:click={() => filterType = "book_qr"}
            class={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
              filterType === "book_qr" 
                ? "bg-purple-600 text-white" 
                : "bg-purple-100 text-purple-700 hover:bg-purple-200"
            }`}
          >
            Book QR ({existingQRCodes.filter(qr => qr.type === 'book_qr').length})
          </button>
        </div>
      </div>
      {#if filteredQRCodes.length === 0}
        <div class="text-center py-8">
          <svg class="h-12 w-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <rect x="3" y="3" width="6" height="6" rx="1" />
            <rect x="15" y="3" width="6" height="6" rx="1" />
            <rect x="3" y="15" width="6" height="6" rx="1" />
            <rect x="15" y="15" width="6" height="6" rx="1" />
          </svg>
          <p class="text-slate-500">No {filterType === "all" ? "" : getQrTypeLabel(filterType)} QR codes found.</p>
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {#each filteredQRCodes as qr}
            <div class="border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow duration-200">
              <div class="flex items-center justify-between mb-3">
                <span class={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getQrTypeBadgeColor(qr.type)}`}>
                  {getQrTypeLabel(qr.type)}
                </span>
              </div>
              <div class="font-mono text-xs mb-3 break-all bg-slate-50 p-2 rounded text-slate-600">
                {qr.token}
              </div>
              <div class="flex space-x-2 mb-3">
                <button
                  class="flex-1 px-3 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors duration-200"
                  on:click={() => {
                    if (selectedQr && selectedQr.id === qr.id) {
                      selectedQr = null;
                      selectedQrDataUrl = "";
                    } else {
                      viewQrCode(qr);
                    }
                  }}
                >
                  {selectedQr && selectedQr.id === qr.id ? 'Close' : 'View'}
                </button>
                <button
                  class="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors duration-200"
                  on:click={() => deleteQrCode(qr.id)}
                  disabled={userRole === 'staff'}
                  style={userRole === 'staff' ? 'opacity:0.5;cursor:not-allowed;' : ''}
                >
                  Delete
                </button>
              </div>
              {#if selectedQr && selectedQr.id === qr.id && selectedQrDataUrl}
                <div 
                  class="border-t border-slate-200 pt-3 mt-3"
                  transition:slide={{ duration: 300, easing: quintOut }}
                >
                  <div class="bg-slate-50 p-2 rounded-lg mb-2">
                    <img src={selectedQrDataUrl} alt="QR Code" class="w-full h-auto" />
                  </div>
                  <button 
                    class="w-full px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors duration-200"
                    on:click={() => downloadQrCode(selectedQrDataUrl, `${qr.type}-${qr.id}.png`)}
                  >
                    Download
                  </button>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Loading State -->
    {#if loading && visits.length === 0}
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div class="flex items-center justify-center">
          <div class="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-slate-600"></div>
          <span class="ml-3 text-slate-600">Loading visit logs...</span>
        </div>
      </div>
    {/if}

    <!-- Desktop Table View -->
    {#if !loading || visits.length > 0}
      <div class="bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden hidden lg:block">
        <div class="px-6 py-4 border-b border-slate-200">
          <h3 class="text-lg font-semibold text-slate-900">Visit Logs</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200">
            <thead class="bg-slate-50">
              <tr>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Visitor Details
                </th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Type & ID
                </th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Purpose
                </th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Time In
                </th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Time Out
                </th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-slate-100">
              {#each filteredVisits as visit}
                <tr class="hover:bg-slate-50 transition-colors duration-200">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-semibold text-slate-900">
                      {visit.visitorName || visit.user?.name || visit.fullName || "—"}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getTypeColor(visit.visitorType)}`}>
                      {visit.visitorType}
                    </span>
                    <div class="text-xs text-slate-400 mt-1">{visit.idNumber}</div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="text-sm text-slate-900 max-w-xs truncate">{visit.purpose}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-slate-900">
                      {visit.timeIn ? (new Date(visit.timeIn)).toLocaleDateString() : "—"}
                    </div>
                    <div class="text-xs text-slate-500">
                      {visit.timeIn ? (new Date(visit.timeIn)).toLocaleTimeString() : ""}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-slate-900">
                      {visit.timeOut ? (new Date(visit.timeOut)).toLocaleDateString() : "—"}
                    </div>
                    <div class="text-xs text-slate-500">
                      {visit.timeOut ? (new Date(visit.timeOut)).toLocaleTimeString() : ""}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(visit.status)}`}>
                      {visit.status === 'checked_in' ? 'Checked In' : 'Checked Out'}
                    </span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
          {#if filteredVisits.length === 0 && !loading}
            <div class="text-center py-8">
              <p class="text-slate-500">No visit logs found matching your criteria.</p>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Mobile Card View -->
    {#if !loading || visits.length > 0}
      <div class="grid grid-cols-1 gap-4 lg:hidden">
        {#each filteredVisits as visit}
          <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div class="flex items-start justify-between mb-3">
              <div class="flex-1 min-w-0">
                <h3 class="text-base font-semibold text-slate-900 truncate">
                  {visit.visitorName || visit.user?.name || visit.fullName || "—"}
                </h3>
                <div class="flex items-center space-x-2 mt-1">
                  <span class={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getTypeColor(visit.visitorType)}`}>
                    {visit.visitorType}
                  </span>
                  <span class={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(visit.status)}`}>
                    {visit.status === 'checked_in' ? 'Checked In' : 'Checked Out'}
                  </span>
                </div>
              </div>
            </div>
            <div class="space-y-2 text-xs text-slate-600">
              <div class="flex items-center">
                <svg class="h-3 w-3 mr-2 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
                </svg>
                <span class="font-medium">ID:</span>
                <span class="ml-1">{visit.idNumber}</span>
              </div>
              <div class="flex items-start">
                <svg class="h-3 w-3 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <span class="font-medium">Purpose:</span>
                <span class="ml-1">{visit.purpose}</span>
              </div>
              <div class="flex items-center">
                <svg class="h-3 w-3 mr-2 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
                </svg>
                <span class="font-medium">In:</span>
                <span class="ml-1">
                  {visit.timeIn ? (new Date(visit.timeIn)).toLocaleString() : "—"}
                </span>
              </div>
              <div class="flex items-center">
                <svg class="h-3 w-3 mr-2 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                </svg>
                <span class="font-medium">Out:</span>
                <span class="ml-1">
                  {visit.timeOut ? (new Date(visit.timeOut)).toLocaleString() : "—"}
                </span>
              </div>
            </div>
            <div class="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
              <div class="text-xs text-slate-600">
                <span class="font-medium">Duration:</span>
                <span class="ml-1">{visit.duration || "—"}</span>
              </div>
            </div>
          </div>
        {/each}
        {#if filteredVisits.length === 0 && !loading}
          <div class="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
            <svg class="h-12 w-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <p class="text-slate-500">No visit logs found matching your criteria.</p>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Pagination -->
    <div class="bg-white px-4 lg:px-6 py-4 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="text-sm text-slate-700 order-2 sm:order-1">
        Showing <span class="font-semibold">1</span> to <span class="font-semibold">{filteredVisits.length}</span> of
        <span class="font-semibold">{filteredVisits.length}</span> results
      </div>
      <nav class="relative z-0 inline-flex rounded-lg shadow-sm -space-x-px order-1 sm:order-2">
        <button class="relative inline-flex items-center px-3 py-2 border border-slate-300 text-sm font-medium rounded-l-lg text-slate-500 bg-white hover:bg-slate-50 transition-colors duration-200">
          <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          <span class="hidden sm:inline">Previous</span>
        </button>
        <button class="relative inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium text-slate-700 bg-slate-50" disabled>
          1
        </button>
        <button class="relative inline-flex items-center px-3 py-2 border border-slate-300 text-sm font-medium rounded-r-lg text-slate-500 bg-white hover:bg-slate-50 transition-colors duration-200">
          <span class="hidden sm:inline">Next</span>
          <svg class="h-4 w-4 ml-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </nav>
    </div>
  </div>