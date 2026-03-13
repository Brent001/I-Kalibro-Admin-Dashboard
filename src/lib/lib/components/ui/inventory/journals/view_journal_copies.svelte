<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import QRCode from 'qrcode';

  interface BookCopy {
    id: number;
    copyNumber: string;
    qrCode: string;
    barcode?: string;
    condition: string;
    status: string;
    callNumber?: string;
    acquisitionDate?: string;
    notes?: string;
    isActive: boolean;
  }

  export let isOpen = false;
  export let itemType: string = 'book';
  export let itemId: number | null = null;
  export let itemTitle: string = '';
  export let copies: BookCopy[] = [];
  export let masterCallNumber: string = '';

  let loading = false;
  let error = '';
  let editingCopyId: number | null = null;
  let editingCallNumber: string = '';
  let deletingCopyId: number | null = null;
  let qrDataUrls: Record<number, string> = {};

  const dispatch = createEventDispatcher();

  const conditionConfig: Record<string, { label: string; cls: string }> = {
    excellent: { label: 'Excellent', cls: 'bg-emerald-100 text-emerald-800 border border-emerald-200' },
    good:      { label: 'Good',      cls: 'bg-teal-100 text-teal-800 border border-teal-200' },
    fair:      { label: 'Fair',      cls: 'bg-amber-100 text-amber-800 border border-amber-200' },
    poor:      { label: 'Poor',      cls: 'bg-orange-100 text-orange-800 border border-orange-200' },
    damaged:   { label: 'Damaged',   cls: 'bg-red-100 text-red-800 border border-red-200' },
  };

  const statusConfig: Record<string, { label: string; dot: string; cls: string }> = {
    available:   { label: 'Available',   dot: 'bg-emerald-500', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
    borrowed:    { label: 'Borrowed',    dot: 'bg-blue-500',    cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
    reserved:    { label: 'Reserved',    dot: 'bg-violet-500',  cls: 'bg-violet-50 text-violet-700 border border-violet-200' },
    maintenance: { label: 'Maintenance', dot: 'bg-amber-500',   cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
    lost:        { label: 'Lost',        dot: 'bg-red-500',     cls: 'bg-red-50 text-red-700 border border-red-200' },
  };

  async function generateQrCodes(list: BookCopy[]) {
    const map: Record<number, string> = {};
    await Promise.all(list.map(async (copy) => {
      const data = copy.qrCode || copy.barcode || copy.copyNumber;
      if (!data) return;
      try {
        map[copy.id] = await QRCode.toDataURL(data, {
          width: 200, margin: 1,
          color: { dark: '#0D5C29', light: '#FFFFFF' },
        });
      } catch (e) {
        console.error('QR generation failed for copy', copy.id, e);
      }
    }));
    qrDataUrls = map;
  }

  async function fetchCopies() {
    if (!itemId) return;
    loading = true; error = '';
    try {
      const res = await fetch(`/api/inventory/${itemType}s/copies?itemType=${itemType}&itemId=${itemId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch copies');
      const data = await res.json();
      if (data.success) { copies = data.copies; await generateQrCodes(copies); }
      else error = data.message || 'Failed to fetch copies';
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
    } finally { loading = false; }
  }

  function startEdit(copy: BookCopy) {
    editingCopyId = copy.id;
    editingCallNumber = copy.callNumber || '';
  }

  async function saveCallNumber(copyId: number) {
    loading = true; error = '';
    try {
      const res = await fetch('/api/inventory/books/copies', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemType, copyId, callNumber: editingCallNumber || null }),
      });
      if (!res.ok) throw new Error('Failed to update call number');
      const data = await res.json();
      if (data.success) {
        const idx = copies.findIndex(c => c.id === copyId);
        if (idx !== -1) copies[idx] = { ...copies[idx], callNumber: editingCallNumber || undefined };
        copies = [...copies];
        editingCopyId = null; editingCallNumber = '';
      } else error = data.message || 'Failed to update call number';
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
    } finally { loading = false; }
  }

  function downloadQr(copy: BookCopy) {
    const url = qrDataUrls[copy.id];
    if (!url) return;
    const a = document.createElement('a');
    a.href = url; a.download = `qr_${copy.copyNumber || copy.id}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  async function deleteCopy(copyId: number) {
    if (!confirm('Delete this copy? This cannot be undone.')) return;
    deletingCopyId = copyId; error = '';
    try {
      const res = await fetch('/api/inventory/books/copies', {
        method: 'DELETE', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ copyId }),
      });
      if (!res.ok) throw new Error('Failed to delete copy');
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        copies = copies.filter(c => c.id !== copyId);
        const { [copyId]: _, ...rest } = qrDataUrls;
        qrDataUrls = rest;
      } else throw new Error(data.message || 'Failed to delete copy');
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
    } finally { deletingCopyId = null; }
  }

  function cancelEdit() { editingCopyId = null; editingCallNumber = ''; }
  function handleClose() { editingCopyId = null; editingCallNumber = ''; dispatch('close'); }
  function handleKeydown(e: KeyboardEvent) { if (e.key === 'Escape' && isOpen) handleClose(); }

  $: if (isOpen && itemId) fetchCopies();
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
  <!-- Backdrop — fixed to full viewport using explicit w-screen/h-screen to avoid clipping -->
  <div
    class="fixed top-0 left-0 w-screen h-screen z-[50] bg-black/50 backdrop-blur-sm"
    role="presentation"
    on:click={handleClose}
  ></div>

  <!-- Modal shell — bottom sheet on mobile, centered dialog on md+ -->
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    class="fixed z-[60] inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center md:p-6 pointer-events-none"
  >
    <div class="
      relative flex flex-col bg-white w-full pointer-events-auto
      rounded-t-3xl md:rounded-3xl
      max-h-[94dvh] md:max-h-[92vh] md:max-w-5xl
      shadow-2xl shadow-black/20 overflow-hidden
    ">

      <!-- ════ HEADER ════ -->
      <div class="relative flex items-center gap-4 px-6 pt-8 pb-5 md:pt-5 border-b border-[#4A7C59]/20 bg-gradient-to-r from-[#f4faf6] to-white flex-shrink-0">
        <!-- Drag pill (mobile only) -->
        <div class="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1.5 rounded-full bg-gray-200 md:hidden"></div>

        <div class="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0D5C29] to-[#4A7C59] shadow-lg flex-shrink-0">
          <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
          </svg>
        </div>

        <div class="flex-1 min-w-0">
          <h3 id="modal-title" class="text-xl md:text-2xl font-bold text-[#0D5C29] leading-tight truncate">
            Book Copies
          </h3>
          <p class="text-sm text-[#4A7C59] truncate mt-0.5">
            {itemTitle || 'Manage copies & call number variations'}
          </p>
        </div>

        {#if copies.length > 0}
          <span class="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-[#e6f0ea] text-[#0D5C29] flex-shrink-0">
            {copies.length} {copies.length === 1 ? 'copy' : 'copies'}
          </span>
        {/if}

        <button type="button" on:click={handleClose} aria-label="Close"
          class="w-10 h-10 flex items-center justify-center rounded-xl text-gray-400 hover:text-[#0D5C29] hover:bg-[#e6f0ea] transition-colors flex-shrink-0">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- ════ BODY ════ -->
      <div class="flex-1 overflow-y-auto px-5 md:px-7 py-5 space-y-5">

        <!-- Error -->
        {#if error}
          <div class="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm" role="alert">
            <svg class="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
            {error}
          </div>
        {/if}

        <!-- Loading skeleton -->
        {#if loading && copies.length === 0}
          <div class="flex flex-col items-center justify-center py-20 gap-3 text-[#4A7C59]">
            <div class="w-8 h-8 rounded-full border-[3px] border-[#d1fae5] border-t-[#0D5C29] animate-spin"></div>
            <span class="text-sm font-medium">Loading copies…</span>
          </div>

        <!-- Empty -->
        {:else if copies.length === 0}
          <div class="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div class="w-16 h-16 rounded-2xl bg-[#f0f9f3] flex items-center justify-center">
              <svg class="w-8 h-8 text-[#4A7C59]" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4"/>
              </svg>
            </div>
            <p class="font-semibold text-gray-700">No copies found</p>
            <p class="text-sm text-gray-400">This item has no registered copies yet.</p>
          </div>

        {:else}

          <!-- Master Call Number Banner -->
          {#if masterCallNumber}
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
              <span class="text-xs font-bold text-blue-600 uppercase tracking-wider">Master Call No.</span>
              <span class="font-mono font-bold text-blue-900 text-sm">{masterCallNumber}</span>
              <span class="text-xs text-blue-400 w-full">Individual copies may override this</span>
            </div>
          {/if}

          <!-- Copy Cards -->
          {#each copies as copy (copy.id)}
            {@const cond  = conditionConfig[copy.condition] ?? { label: copy.condition, cls: 'bg-gray-100 text-gray-700 border border-gray-200' }}
            {@const stat  = statusConfig[copy.status]      ?? { label: copy.status, dot: 'bg-gray-400', cls: 'bg-gray-50 text-gray-700 border border-gray-200' }}
            {@const qrUrl = qrDataUrls[copy.id]}

            <div class="border border-[#d1e8d8] rounded-2xl overflow-hidden bg-white hover:shadow-lg hover:shadow-[#0D5C29]/5 transition-all duration-200">

              <!-- ── Card Header ── -->
              <div class="flex items-center justify-between flex-wrap gap-3 px-5 py-4 bg-gradient-to-r from-[#f4faf6] to-[#f9fefb] border-b border-[#e6f0ea]">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-[#0D5C29]/10 flex items-center justify-center flex-shrink-0">
                    <svg class="w-5 h-5 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                    </svg>
                  </div>
                  <div>
                    <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider leading-none">Copy Number</p>
                    <p class="text-base font-bold text-gray-900 leading-snug font-mono mt-0.5">{copy.copyNumber}</p>
                  </div>
                </div>

                <div class="flex items-center gap-2 flex-wrap">
                  <!-- Active badge -->
                  <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
                    {copy.isActive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-gray-100 text-gray-500 border border-gray-200'}">
                    <span class="w-2 h-2 rounded-full flex-shrink-0 {copy.isActive ? 'bg-emerald-500' : 'bg-gray-400'}"></span>
                    {copy.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <!-- Status -->
                  <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold {stat.cls}">
                    <span class="w-2 h-2 rounded-full flex-shrink-0 {stat.dot}"></span>
                    {stat.label}
                  </span>
                  <!-- Condition -->
                  <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold {cond.cls}">
                    {cond.label}
                  </span>
                </div>
              </div>

              <!-- ── Card Body ── -->
              <div class="p-5 space-y-5">
                <div class="flex flex-col sm:flex-row gap-6">

                  <!-- QR Code column -->
                  <div class="flex flex-col items-center gap-3 flex-shrink-0 sm:w-44">
                    {#if qrUrl}
                      <div class="p-3 bg-white rounded-2xl border border-[#d1e8d8] shadow-sm">
                        <img src={qrUrl} alt="QR code for copy {copy.copyNumber}" class="w-36 h-36 block" />
                      </div>
                      <button type="button" on:click={() => downloadQr(copy)}
                        class="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[#0D5C29] text-white hover:bg-[#0a4b22] transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                        </svg>
                        Download QR
                      </button>
                    {:else}
                      <div class="w-36 h-36 rounded-2xl border-2 border-dashed border-[#d1e8d8] flex flex-col items-center justify-center gap-2">
                        <svg class="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"/>
                        </svg>
                        <span class="text-xs text-gray-400 font-medium">No QR data</span>
                      </div>
                    {/if}
                  </div>

                  <!-- Details grid -->
                  <div class="flex-1 grid grid-cols-2 gap-x-5 gap-y-4 min-w-0 content-start">

                    <!-- Barcode -->
                    <div class="col-span-2 sm:col-span-1">
                      <p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Barcode</p>
                      {#if copy.barcode}
                        <p class="font-mono text-sm font-semibold text-gray-800 break-all">{copy.barcode}</p>
                      {:else}
                        <p class="text-sm text-gray-400 italic">Not assigned</p>
                      {/if}
                    </div>

                    <!-- Acquisition Date -->
                    <div class="col-span-2 sm:col-span-1">
                      <p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Date Acquired</p>
                      {#if copy.acquisitionDate}
                        <p class="text-sm font-medium text-gray-800">
                          {new Date(copy.acquisitionDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </p>
                      {:else}
                        <p class="text-sm text-gray-400 italic">Not recorded</p>
                      {/if}
                    </div>

                    <!-- Call Number (full width) -->
                    <div class="col-span-2">
                      <p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                        Call Number
                        <span class="normal-case font-normal text-gray-300 ml-1">(per-copy override)</span>
                      </p>

                      {#if editingCopyId === copy.id}
                        <div class="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            bind:value={editingCallNumber}
                            placeholder="Enter call number or leave empty…"
                            autofocus
                            class="flex-1 px-4 py-2.5 text-sm font-mono border border-[#4A7C59] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0D5C29]/25 focus:border-[#0D5C29] bg-white transition"
                          />
                          <div class="flex gap-2">
                            <button type="button" on:click={() => saveCallNumber(copy.id)} disabled={loading}
                              class="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#0D5C29] text-white hover:bg-[#0a4b22] disabled:opacity-50 transition-colors">
                              Save
                            </button>
                            <button type="button" on:click={cancelEdit} disabled={loading}
                              class="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors">
                              Cancel
                            </button>
                          </div>
                        </div>
                      {:else}
                        <div class="flex items-center justify-between gap-2 group">
                          <span class="font-mono text-sm {copy.callNumber ? 'font-semibold text-gray-800' : 'text-gray-400 italic'}">
                            {copy.callNumber || 'Not assigned — inherits master'}
                          </span>
                          <button type="button" on:click={() => startEdit(copy)}
                            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#e6f0ea] text-[#0D5C29] hover:bg-[#cde4d5] transition-colors flex-shrink-0 opacity-60 group-hover:opacity-100">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                            </svg>
                            Edit
                          </button>
                        </div>
                      {/if}
                    </div>

                  </div>
                </div>

                <!-- Notes — full width, below both columns -->
                {#if copy.notes}
                  <div>
                    <p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Notes</p>
                    <p class="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">{copy.notes}</p>
                  </div>
                {/if}

                <!-- Delete row -->
                <div class="flex justify-end pt-2 border-t border-gray-100">
                  <button type="button" on:click={() => deleteCopy(copy.id)} disabled={deletingCopyId === copy.id}
                    class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors">
                    {#if deletingCopyId === copy.id}
                      <div class="w-3.5 h-3.5 rounded-full border-2 border-red-300 border-t-red-600 animate-spin"></div>
                      Deleting…
                    {:else}
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                      Delete Copy
                    {/if}
                  </button>
                </div>

              </div>
            </div>
          {/each}
        {/if}
      </div>

      <!-- ════ FOOTER ════ -->
      <div class="flex items-center justify-between gap-4 px-6 py-4 border-t border-[#4A7C59]/20 bg-[#f9fefb] flex-shrink-0">
        <div class="text-sm text-[#4A7C59]">
          {#if copies.length > 0}
            <p>
              <span class="font-bold text-[#0D5C29]">{copies.filter(c => c.status === 'available').length}</span> of
              <span class="font-bold text-[#0D5C29]">{copies.length}</span> available
              &nbsp;·&nbsp;
              <span class="font-bold text-[#0D5C29]">{copies.filter(c => c.isActive).length}</span> active
            </p>
          {/if}
        </div>
        <button type="button" on:click={handleClose}
          class="px-8 py-2.5 rounded-xl text-sm font-semibold bg-[#0D5C29] text-white hover:bg-[#0a4b22] transition-colors shadow-sm">
          Close
        </button>
      </div>

    </div>
  </div>
{/if}