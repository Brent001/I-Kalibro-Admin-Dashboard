<script lang="ts">
  import { onMount } from "svelte";

  let currentPath = $state('/');
  let fileList = $state<{ name: string; type: 'file' | 'folder'; size?: string; modified?: string }[]>([]);
  let isLoadingFiles = $state(false);
  let fileError = $state('');
  let pathHistory = $state<string[]>(['/']);
  let fileSearch = $state('');
  let sortBy = $state<'name' | 'size' | 'modified'>('name');
  let sortAsc = $state(true);
  let selectedFile = $state<{ name: string; type: 'file' | 'folder'; size?: string; modified?: string } | null>(null);

  async function loadDirectory(path: string) {
    isLoadingFiles = true;
    fileError = '';
    fileSearch = '';
    selectedFile = null;
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`, { credentials: 'same-origin' });
      if (res.ok) {
        const d = await res.json();
        if (d.success) { fileList = d.files ?? []; currentPath = path; }
        else fileError = 'Failed to load directory.';
      } else {
        fileError = 'Could not load directory. Check that the API endpoint is available.';
      }
    } catch { fileError = 'Failed to connect to the file API.'; }
    finally { isLoadingFiles = false; }
  }

  function navigateTo(folder: string) {
    const base = currentPath.replace(/\/$/, '');
    const newPath = base ? `${base}/${folder}` : `/${folder}`;
    pathHistory = [...pathHistory, newPath];
    loadDirectory(newPath);
  }
  function navigateBack() {
    if (pathHistory.length <= 1) return;
    const prev = pathHistory[pathHistory.length - 2];
    pathHistory = pathHistory.slice(0, -1);
    loadDirectory(prev);
  }
  function navigateToSegment(idx: number) {
    const segments = currentPath.split('/').filter(Boolean);
    const target = '/' + segments.slice(0, idx + 1).join('/');
    pathHistory = pathHistory.slice(0, idx + 2);
    loadDirectory(target || '/');
  }
  function navigateToRoot() {
    pathHistory = ['/'];
    loadDirectory('/');
  }

  let filteredFiles = $derived(fileList
    .filter(f => f.name.toLowerCase().includes(fileSearch.toLowerCase()))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'size') cmp = (a.size ?? '').localeCompare(b.size ?? '');
      else if (sortBy === 'modified') cmp = (a.modified ?? '').localeCompare(b.modified ?? '');
      return sortAsc ? cmp : -cmp;
    }));

  let folderCount = $derived(filteredFiles.filter(f => f.type === 'folder').length);
  let fileCount   = $derived(filteredFiles.filter(f => f.type === 'file').length);

  function toggleSort(col: 'name' | 'size' | 'modified') {
    if (sortBy === col) sortAsc = !sortAsc;
    else { sortBy = col; sortAsc = true; }
  }

  type FileIconType = 'image' | 'pdf' | 'archive' | 'code' | 'text' | 'generic';
  function getFileIcon(name: string): FileIconType {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    if (['jpg','jpeg','png','gif','svg','webp'].includes(ext)) return 'image';
    if (['pdf'].includes(ext)) return 'pdf';
    if (['zip','tar','gz','rar','7z'].includes(ext)) return 'archive';
    if (['js','ts','svelte','html','css','json','py','php','sql'].includes(ext)) return 'code';
    if (['md','txt','log','csv'].includes(ext)) return 'text';
    return 'generic';
  }

  const iconColors: Record<FileIconType, string> = {
    image:   'text-purple-400',
    pdf:     'text-red-400',
    archive: 'text-amber-500',
    code:    'text-blue-400',
    text:    'text-slate-400',
    generic: 'text-slate-300',
  };

  const iconPaths: Record<FileIconType, string> = {
    image:   'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
    pdf:     'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
    archive: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
    code:    'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
    text:    'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    generic: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  };

  onMount(() => loadDirectory('/'));
</script>

<svelte:head>
  <title>File Explorer | E-Kalibro Admin Portal</title>
</svelte:head>

<!-- ─── Sort icon snippet ─────────────────────────────────────── -->
{#snippet sortIcon(col: 'name' | 'size' | 'modified')}
  <svg
    class="w-3 h-3 ml-1 inline-block transition-transform
      {sortBy === col ? 'text-[#0D5C29]' : 'text-gray-300'}
      {sortBy === col && !sortAsc ? 'rotate-180' : ''}"
    fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7"/>
  </svg>
{/snippet}

<!-- ─── File icon snippet ──────────────────────────────────────── -->
{#snippet fileIcon(type: FileIconType)}
  <svg class="w-4 h-4 shrink-0 {iconColors[type]}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" d={iconPaths[type]}/>
  </svg>
{/snippet}

<!-- ─── Page ──────────────────────────────────────────────────── -->
<div class="min-h-screen">

  <!-- Header -->
  <div class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
    <div class="flex items-center gap-3">
      <a href="/dashboard/settings"
        class="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-slate-500 hover:bg-gray-50 hover:text-slate-700 transition-colors shrink-0">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
        </svg>
      </a>
      <div>
        <h2 class="text-2xl font-bold text-slate-900">File Explorer</h2>
        <p class="text-slate-500 text-sm mt-0.5">Browse and inspect server files — read-only</p>
      </div>
    </div>

    <!-- Stats chips -->
    <div class="flex items-center gap-2 text-xs">
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 font-medium">
        <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
        </svg>
        {folderCount} folder{folderCount !== 1 ? 's' : ''}
      </span>
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 font-medium">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
        </svg>
        {fileCount} file{fileCount !== 1 ? 's' : ''}
      </span>
      <button onclick={() => loadDirectory(currentPath)}
        class="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-slate-500 hover:bg-gray-50 hover:text-slate-700 transition-colors"
        title="Refresh">
        <svg class="w-3.5 h-3.5 {isLoadingFiles ? 'animate-spin' : ''}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
      </button>
    </div>
  </div>

  <!-- Main card -->
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

    <!-- Toolbar -->
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">

      <!-- Back button -->
      <button onclick={navigateBack} disabled={pathHistory.length <= 1}
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-slate-600
          hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
        </svg>
        Back
      </button>

      <!-- Breadcrumb -->
      <div class="flex-1 flex items-center gap-1 flex-wrap min-w-0 bg-white border border-gray-200 rounded-lg px-3 py-1.5 min-h-[34px]">
        <svg class="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
        </svg>
        <button onclick={navigateToRoot}
          class="text-xs font-medium text-[#0D5C29] hover:underline shrink-0">root</button>
        {#each currentPath.split('/').filter(Boolean) as seg, i}
          <svg class="w-3 h-3 text-gray-300 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
          <button onclick={() => navigateToSegment(i)}
            class="text-xs font-medium text-[#0D5C29] hover:underline shrink-0 truncate max-w-[120px]">
            {seg}
          </button>
        {/each}
      </div>

      <!-- Search -->
      <div class="relative sm:w-52 shrink-0">
        <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input type="text" placeholder="Filter…" bind:value={fileSearch}
          class="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-[#0D5C29] focus:border-transparent transition-all"/>
        {#if fileSearch}
          <button onclick={() => fileSearch = ''} class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        {/if}
      </div>
    </div>

    <!-- File table -->
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="border-b border-gray-100">
          <tr>
            <th class="px-4 py-3 text-left w-full">
              <button onclick={() => toggleSort('name')}
                class="flex items-center text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-700 transition-colors">
                Name {@render sortIcon('name')}
              </button>
            </th>
            <th class="px-4 py-3 text-left whitespace-nowrap hidden sm:table-cell">
              <button onclick={() => toggleSort('size')}
                class="flex items-center text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-700 transition-colors">
                Size {@render sortIcon('size')}
              </button>
            </th>
            <th class="px-4 py-3 text-left whitespace-nowrap hidden md:table-cell">
              <button onclick={() => toggleSort('modified')}
                class="flex items-center text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-700 transition-colors">
                Modified {@render sortIcon('modified')}
              </button>
            </th>
            <th class="px-4 py-3 hidden sm:table-cell w-8"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">

          {#if isLoadingFiles}
            <tr>
              <td colspan="4" class="px-4 py-16 text-center">
                <div class="flex flex-col items-center gap-3">
                  <div class="w-10 h-10 rounded-full border-2 border-gray-100 border-t-[#0D5C29] animate-spin"></div>
                  <span class="text-sm text-slate-400">Loading directory…</span>
                </div>
              </td>
            </tr>

          {:else if fileError}
            <tr>
              <td colspan="4" class="px-4 py-16 text-center">
                <div class="flex flex-col items-center gap-3">
                  <div class="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                    <svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
                    </svg>
                  </div>
                  <div>
                    <p class="text-sm font-medium text-slate-700">{fileError}</p>
                    <button onclick={() => loadDirectory(currentPath)}
                      class="text-xs text-[#0D5C29] hover:underline font-medium mt-1">
                      Try again
                    </button>
                  </div>
                </div>
              </td>
            </tr>

          {:else if filteredFiles.length === 0}
            <tr>
              <td colspan="4" class="px-4 py-16 text-center">
                <div class="flex flex-col items-center gap-3">
                  <div class="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
                    <svg class="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"/>
                    </svg>
                  </div>
                  <div>
                    <p class="text-sm font-medium text-slate-600">{fileSearch ? 'No files match your filter' : 'Empty directory'}</p>
                    {#if fileSearch}
                      <button onclick={() => fileSearch = ''}
                        class="text-xs text-[#0D5C29] hover:underline font-medium mt-1">
                        Clear filter
                      </button>
                    {/if}
                  </div>
                </div>
              </td>
            </tr>

          {:else}
            {#each filteredFiles as f}
              {@const isSelected = selectedFile?.name === f.name}
              <tr
                onclick={() => {
                  if (f.type === 'folder') { navigateTo(f.name); }
                  else { selectedFile = isSelected ? null : f; }
                }}
                class="group transition-colors cursor-pointer
                  {isSelected
                    ? 'bg-[#0D5C29]/5 hover:bg-[#0D5C29]/[0.07]'
                    : 'hover:bg-gray-50/80'}">

                <!-- Name -->
                <td class="px-4 py-2.5">
                  <div class="flex items-center gap-2.5">
                    {#if f.type === 'folder'}
                      <svg class="w-4 h-4 text-amber-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
                      </svg>
                      <span class="text-sm font-medium text-slate-700 group-hover:text-[#0D5C29] transition-colors truncate">
                        {f.name}
                      </span>
                    {:else}
                      {@render fileIcon(getFileIcon(f.name))}
                      <span class="text-sm text-slate-600 truncate {isSelected ? 'text-[#0D5C29] font-medium' : ''}">
                        {f.name}
                      </span>
                    {/if}
                  </div>
                </td>

                <!-- Size -->
                <td class="px-4 py-2.5 hidden sm:table-cell">
                  <span class="text-xs text-slate-400 tabular-nums">
                    {f.type === 'folder' ? '—' : (f.size ?? '—')}
                  </span>
                </td>

                <!-- Modified -->
                <td class="px-4 py-2.5 hidden md:table-cell">
                  <span class="text-xs text-slate-400 tabular-nums whitespace-nowrap">
                    {f.modified ?? '—'}
                  </span>
                </td>

                <!-- Action indicator -->
                <td class="px-4 py-2.5 hidden sm:table-cell">
                  {#if f.type === 'folder'}
                    <svg class="w-3.5 h-3.5 text-gray-300 group-hover:text-[#0D5C29] transition-colors" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                    </svg>
                  {:else if isSelected}
                    <svg class="w-3.5 h-3.5 text-[#0D5C29]" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                    </svg>
                  {/if}
                </td>

              </tr>
            {/each}
          {/if}

        </tbody>
      </table>
    </div>

    <!-- Selected file detail bar -->
    {#if selectedFile}
      <div class="border-t border-[#0D5C29]/20 bg-[#0D5C29]/5 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 animate-in">
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          {@render fileIcon(getFileIcon(selectedFile.name))}
          <div class="min-w-0">
            <p class="text-sm font-semibold text-slate-800 truncate">{selectedFile.name}</p>
            <p class="text-xs text-slate-400 mt-0.5 font-mono truncate">{currentPath.replace(/\/$/, '')}/{selectedFile.name}</p>
          </div>
        </div>
        <div class="flex items-center gap-4 shrink-0 text-xs text-slate-500">
          {#if selectedFile.size}
            <span class="flex items-center gap-1">
              <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M4 7h16M9 3h6"/>
              </svg>
              {selectedFile.size}
            </span>
          {/if}
          {#if selectedFile.modified}
            <span class="flex items-center gap-1">
              <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              {selectedFile.modified}
            </span>
          {/if}
          <button onclick={() => selectedFile = null}
            class="ml-2 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-white/60 transition-colors">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
    {/if}

    <!-- Footer -->
    <div class="border-t border-gray-100 px-4 py-2.5 flex items-center justify-between bg-gray-50/50">
      <p class="text-xs text-slate-400">
        {#if fileSearch}
          Showing <span class="font-medium text-slate-600">{filteredFiles.length}</span> of {fileList.length} items
        {:else}
          <span class="font-medium text-slate-600">{fileList.length}</span> item{fileList.length !== 1 ? 's' : ''} in directory
        {/if}
      </p>
      <p class="text-xs text-slate-300 font-mono hidden sm:block">GET /api/files?path=</p>
    </div>

  </div>
</div>

<style>
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .animate-in { animation: fade-in 0.15s ease-out; }

  [role="tablist"]::-webkit-scrollbar { display: none; }
</style>