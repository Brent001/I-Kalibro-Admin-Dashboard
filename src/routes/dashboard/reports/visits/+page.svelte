<script lang="ts">
  import Layout from "$lib/components/ui/layout.svelte";
  import { onMount } from "svelte";

  let visits: any[] = [];
  let loading = true;
  let errorMsg = "";
  let qrCodeDataUrl: string = "";
  let showQrModal = false;
  let generatedToken: string = "";
  let existingQRCodes: { id: number; token: string }[] = [];
  let selectedQr: { id: number; token: string } | null = null;
  let selectedQrDataUrl: string = "";

  onMount(async () => {
    await loadVisits();
    await loadExistingQRCodes();
  });

  async function loadVisits() {
    loading = true;
    errorMsg = "";
    try {
      const res = await fetch("/api/visits");
      const data = await res.json();
      if (res.ok && data.success) {
        visits = data.visits;
      } else {
        errorMsg = data.message || "Failed to load visits.";
      }
    } catch (err) {
      errorMsg = "Network error. Please try again.";
    } finally {
      loading = false;
    }
  }

  async function loadExistingQRCodes() {
    try {
      const res = await fetch("/api/qrcode/visit_qrcode");
      const data = await res.json();
      if (res.ok && data.success) {
        existingQRCodes = data.qrCodes;
      }
    } catch (err) {
      // ignore for now
    }
  }

  async function generateQrCode() {
    const res = await fetch("/api/qrcode/visit_qrcode", {
      method: "POST"
    });
    const data = await res.json();
    if (res.ok && data.success) {
      generatedToken = data.token;
      const QRCode = await import("qrcode");
      qrCodeDataUrl = await QRCode.toDataURL(generatedToken, { width: 256 });
      showQrModal = true;
      await loadExistingQRCodes();
    } else {
      errorMsg = data.message || "Failed to generate QR code.";
    }
  }

  function downloadQrCode(dataUrl: string, filename = "library-visit-qrcode.png") {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    link.click();
  }

  async function deleteQrCode(qrId: number) {
    if (!confirm("Are you sure you want to delete this QR code?")) return;
    try {
      const res = await fetch(`/api/qrcode/visit_qrcode`, {
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
      } else {
        errorMsg = data.message || "Failed to delete QR code.";
      }
    } catch (err) {
      errorMsg = "Network error. Please try again.";
    }
  }

  async function viewQrCode(qr: { id: number; token: string }) {
    selectedQr = qr;
    const QRCode = await import("qrcode");
    selectedQrDataUrl = await QRCode.toDataURL(qr.token, { width: 256 });
  }
</script>

<Layout>
  <div class="space-y-4 lg:space-y-6">
    <!-- Error Messages -->
    {#if errorMsg}
      <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
        {errorMsg}
      </div>
    {/if}

    <!-- Header -->
    <div class="flex flex-col space-y-3 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
      <div>
        <h2 class="text-xl lg:text-2xl font-bold text-gray-900">Library Visit QR Codes</h2>
        <p class="text-sm lg:text-base text-gray-600">Generate and print unique QR codes for physical library check-in.</p>
      </div>
      <div class="flex flex-col space-y-2 lg:flex-row lg:space-y-0 lg:space-x-3">
        <button
          class="inline-flex items-center justify-center px-4 py-2 border border-indigo-300 text-sm font-medium rounded-md text-indigo-700 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
          on:click={generateQrCode}
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
      </div>
    </div>

    <!-- QR Code Modal -->
    {#if showQrModal}
      <div class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-lg p-6 flex flex-col items-center">
          <h3 class="text-lg font-semibold mb-2">New Library QR Code</h3>
          {#if qrCodeDataUrl}
            <img src={qrCodeDataUrl} alt="QR Code" class="mb-4 w-48 h-48" />
            <div class="mb-2 text-xs text-gray-500 break-all">{generatedToken}</div>
          {/if}
          <div class="flex space-x-2">
            <button class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700" on:click={() => downloadQrCode(qrCodeDataUrl)}>
              Download
            </button>
            <button class="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400" on:click={() => showQrModal = false}>
              Close
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Existing QR Codes List -->
    <div class="bg-white p-4 lg:p-6 rounded-lg shadow-sm border mt-4">
      <h3 class="text-lg font-semibold mb-4">Existing QR Codes</h3>
      {#if existingQRCodes.length === 0}
        <div class="text-slate-500">No QR codes generated yet.</div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {#each existingQRCodes as qr}
            <div class="border rounded-lg p-4 flex flex-col items-center">
              <div class="font-mono text-xs mb-2 break-all">{qr.token}</div>
              <div class="flex space-x-2 mb-2">
                <button
                  class="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                  on:click={() => viewQrCode(qr)}
                >
                  View QR Code
                </button>
                <button
                  class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                  on:click={() => deleteQrCode(qr.id)}
                >
                  Delete
                </button>
              </div>
              {#if selectedQr && selectedQr.id === qr.id && selectedQrDataUrl}
                <img src={selectedQrDataUrl} alt="QR Code" class="mb-2 w-32 h-32" />
                <button class="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                  on:click={() => downloadQrCode(selectedQrDataUrl, `library-visit-qrcode-${qr.id}.png`)}>
                  Download
                </button>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Visit Logs Table -->
    <div class="bg-white p-4 lg:p-6 rounded-lg shadow-sm border mt-4">
      <h3 class="text-lg font-semibold mb-4">Visit Logs</h3>
      {#if loading}
        <div class="text-center py-8 text-slate-500">Loading visit logs...</div>
      {:else if visits.length === 0}
        <div class="text-center py-8 text-slate-500">No visit logs found.</div>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ID Number</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Purpose</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time In</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time Out</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {#each visits as visit}
                <tr>
                  <td class="px-4 py-2">{visit.visitorName || visit.user?.name || "—"}</td>
                  <td class="px-4 py-2">{visit.visitorType}</td>
                  <td class="px-4 py-2">{visit.idNumber}</td>
                  <td class="px-4 py-2">{visit.purpose}</td>
                  <td class="px-4 py-2">{visit.timeIn ? (new Date(visit.timeIn)).toLocaleString() : "—"}</td>
                  <td class="px-4 py-2">{visit.timeOut ? (new Date(visit.timeOut)).toLocaleString() : "—"}</td>
                  <td class="px-4 py-2">{visit.duration || "—"}</td>
                  <td class="px-4 py-2">
                    <span class="px-2 py-1 rounded text-xs font-semibold {visit.status === 'checked_in' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}">
                      {visit.status}
                    </span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>
</Layout>