<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { ensureProxiedUrl } from '$lib/utils/b2ImageProxy.js';
  import ViewBookCopies from './view_journal_copies.svelte';

  export let isOpen = false;
  export let itemType: string = 'journal';
  export let book: {
    id?: number;
    bookId?: string;
    title?: string;
    author?: string;
    isbn?: string;
    edition?: string;
    pages?: number;
    totalCopies?: number;
    publishedYear?: number;
    category?: string;
    categoryId?: number;
    copiesAvailable?: number;
    qrCode?: string;
    status?: string;
    publisher?: string;
    language?: string;
    location?: string;
    originPlace?: string;
    description?: string;
    coverImage?: string;
  } | null = null;

  export let isEditMode = false;

  $: capitalizedItemType = itemType && itemType.length
    ? itemType.charAt(0).toUpperCase() + itemType.slice(1)
    : 'Item';

  const dispatch = createEventDispatcher();

  let editData = {
    title: '', author: '', bookId: '', isbn: '', edition: '',
    pages: '', publishedYear: '', categoryId: '', totalCopies: '',
    publisher: '', language: 'English', location: '', originPlace: '', description: ''
  };
  let errors: { [key: string]: string } = {};
  let isSubmitting = false;
  let coverImageFile: File | null = null;
  let coverImagePreview: string = '';
  let uploadingCoverImage = false;
  let categories: { id: number; name: string }[] = [];
  let categoriesLoading = false;

  // Copies modal state
  let showCopiesModal = false;

  const languages = ['English','Filipino','Spanish','French','German','Japanese','Chinese','Other'];

  $: proxiedCoverImage = book?.coverImage ? ensureProxiedUrl(book.coverImage) : null;

  // Active cover to show in edit mode (new preview takes priority)
  $: activeCoverSrc = coverImagePreview || proxiedCoverImage || null;

  async function fetchCategories() {
    categoriesLoading = true;
    try {
      const response = await fetch(`/api/inventory/journals/categories?itemType=${encodeURIComponent(itemType)}`, { credentials: 'include' });
      const data = await response.json();
      categories = (response.ok && data.success) ? data.data.categories : [];
    } catch { categories = []; }
    finally { categoriesLoading = false; }
  }

  $: if (isOpen && isEditMode) fetchCategories();

  $: if (isOpen && book && isEditMode) {
    editData = {
      title: book.title ?? '',
      author: book.author ?? '',
      bookId: book.bookId ?? '',
      isbn: book.isbn ?? '',
      edition: book.edition ?? '',
      pages: book.pages?.toString() ?? '',
      publishedYear: book.publishedYear?.toString() ?? '',
      categoryId: book.categoryId?.toString() ?? '',
      totalCopies: (book.totalCopies ?? book.copiesAvailable ?? '').toString(),
      publisher: book.publisher ?? '',
      language: book.language ?? 'English',
      location: book.location ?? '',
      originPlace: book.originPlace ?? '',
      description: book.description ?? ''
    };
    coverImageFile = null;
    coverImagePreview = '';
  }

  function handleCoverImageChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { errors.coverImage = 'Please select an image file'; return; }
    if (file.size > 5 * 1024 * 1024) { errors.coverImage = 'Image size must be less than 5MB'; return; }
    coverImageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => { coverImagePreview = e.target?.result as string; };
    reader.readAsDataURL(file);
    errors.coverImage = '';
  }

  function removeCoverImage() {
    coverImageFile = null;
    coverImagePreview = '';
    errors.coverImage = '';
  }

  async function uploadCoverImage(itemId?: number): Promise<string | null> {
    if (!coverImageFile) return null;
    uploadingCoverImage = true;
    try {
      const form = new FormData();
      form.append('file', coverImageFile);
      form.append('itemId', String(itemId || book?.id || '0'));
      form.append('itemType', itemType || 'book');
      const resp = await fetch('/api/images/upload/', { method: 'POST', credentials: 'include', body: form });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        errors.coverImage = err.message || 'Upload failed';
        return null;
      }
      const result = await resp.json();
      return result.photoUrl || result.coverImage || null;
    } catch { errors.coverImage = 'Network error while uploading image'; return null; }
    finally { uploadingCoverImage = false; }
  }

  function validateForm() {
    const e: { [k: string]: string } = {};
    if (!editData.title.trim())     e.title     = 'Title is required';
    if (!editData.author.trim())    e.author    = 'Author is required';
    if (!editData.categoryId)       e.category  = 'Category is required';
    if (!editData.publisher.trim()) e.publisher = 'Publisher is required';
    if (!editData.publishedYear) {
      e.publishedYear = 'Published year is required';
    } else {
      const y = parseInt(editData.publishedYear);
      const max = new Date().getFullYear();
      if (y < 1000 || y > max) e.publishedYear = `Year must be between 1000 and ${max}`;
    }
    if (editData.totalCopies && parseInt(editData.totalCopies) < 1)
      e.totalCopies = 'Number of copies must be at least 1';
    if (!editData.bookId.trim()) {
      e.bookId = 'Book ID is required';
    } else if (!/^[A-Z0-9.\-]+$/i.test(editData.bookId.trim())) {
      e.bookId = 'Book ID must be alphanumeric and may include dots or dashes';
    }
    errors = e;
    return Object.keys(e).length === 0;
  }

  function handleClose() { errors = {}; isSubmitting = false; dispatch('close'); }
  function handleEdit()  { dispatch('edit'); }

  async function handleSave(ev: Event) {
    ev.preventDefault();
    if (!validateForm()) return;
    isSubmitting = true;
    try {
      let coverUrl = book?.coverImage || null;
      if (coverImageFile) {
        const uploaded = await uploadCoverImage(book?.id);
        if (uploaded) coverUrl = uploaded;
        else { isSubmitting = false; return; }
      }
      dispatch('save', {
        id: book?.id, itemType,
        bookId: editData.bookId?.trim(),
        title: editData.title?.trim(),
        author: editData.author?.trim(),
        isbn: editData.isbn?.trim() || null,
        publisher: editData.publisher?.trim() || null,
        publishedYear: editData.publishedYear ? parseInt(editData.publishedYear) : null,
        edition: editData.edition?.trim() || null,
        language: editData.language || null,
        pages: editData.pages ? parseInt(editData.pages) : null,
        categoryId: editData.categoryId ? parseInt(editData.categoryId) : null,
        location: editData.location?.trim() || null,
        totalCopies: editData.totalCopies ? parseInt(editData.totalCopies) : null,
        description: editData.description?.trim() || null,
        coverImage: coverUrl || null
      });
    } finally { isSubmitting = false; }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isOpen && !isSubmitting) handleClose();
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  });
</script>

{#if isOpen && book && !showCopiesModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <button
      class="fixed inset-0 bg-black/50 backdrop-blur-sm cursor-default"
      on:click={isSubmitting ? null : handleClose}
      disabled={isSubmitting}
      aria-label="Close modal"
      type="button"
    ></button>

    <div class="relative w-full max-w-5xl transform transition-all duration-300 scale-100">
      <div class="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-[#4A7C59]/30 overflow-hidden flex flex-col h-[90vh]">
        <form on:submit={handleSave} class="flex flex-col h-full">

          <!-- ── Header ── -->
          <div class="px-6 py-4 border-b border-[#4A7C59]/20 bg-white/80 flex-shrink-0">
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <div class="flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-[#0D5C29] to-[#4A7C59] shadow-lg flex-shrink-0">
                  <svg class="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                  </svg>
                </div>
                <div class="min-w-0">
                  <h3 class="text-lg sm:text-xl font-bold text-[#0D5C29] truncate">
                    {isEditMode ? `Edit ${capitalizedItemType}` : `${capitalizedItemType} Details`}
                  </h3>
                  <p class="text-xs sm:text-sm text-[#4A7C59] hidden sm:block">
                    {isEditMode
                      ? `Update the ${itemType} information below`
                      : `View complete information about this ${itemType}`}
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  on:click={() => (showCopiesModal = true)}
                  title="View copies"
                  class="p-2 rounded-lg text-gray-500 hover:text-[#0D5C29] hover:bg-[#0D5C29]/10 transition-colors duration-200 flex-shrink-0"
                >
                  <svg class="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
                  </svg>
                </button>

                <button
                  type="button" on:click={handleClose} disabled={isSubmitting}
                  aria-label="Close modal"
                  class="p-2 rounded-lg text-gray-400 hover:text-[#0D5C29] hover:bg-[#0D5C29]/10 transition-colors duration-200 disabled:opacity-50 flex-shrink-0"
                >
                  <svg class="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- ── Body ── -->
          <div class="px-6 py-6 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
            <div class="space-y-5">

              <!-- ══ SECTION 1: Cover + Basic Info ══════════════════════════════ -->
              <div class="bg-[#f8faf9] border border-[#4A7C59]/20 rounded-xl p-4 sm:p-5">
                <div class="flex items-center gap-2 mb-4">
                  <svg class="h-5 w-5 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <h4 class="text-base sm:text-lg font-semibold text-[#0D5C29]">Basic Information</h4>
                </div>

                <div class="flex flex-col sm:flex-row gap-5">
                  <!-- Cover image column — same position as view mode -->
                  <div class="flex-shrink-0 flex flex-col items-center sm:items-start gap-2">
                    <!-- Image display -->
                    {#if activeCoverSrc}
                      <img
                        src={activeCoverSrc}
                        alt={book.title}
                        class="w-32 sm:w-40 rounded-lg shadow-md object-cover border border-[#B8860B]/20"
                        loading="lazy"
                        on:error={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22220%22%3E%3Crect fill=%22%23f1f5f9%22 width=%22160%22 height=%22220%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 font-size=%2212%22 fill=%22%2364748b%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22%3ENo image%3C/text%3E%3C/svg%3E';
                        }}
                      />
                    {:else}
                      <div class="w-32 sm:w-40 rounded-lg border-2 border-dashed border-[#4A7C59]/30 bg-white flex flex-col items-center justify-center gap-2 py-8">
                        <svg class="h-8 w-8 text-[#4A7C59]/40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        <span class="text-xs text-gray-400 text-center px-2">No cover photo</span>
                      </div>
                    {/if}

                    <!-- Edit-mode controls below cover -->
                    {#if isEditMode}
                      <div class="flex flex-col gap-1.5 w-32 sm:w-40">
                        <label
                          for="cover-file"
                          class="cursor-pointer text-center px-3 py-1.5 rounded-lg border border-[#4A7C59]/40 bg-white text-xs font-medium text-[#0D5C29] hover:bg-[#0D5C29]/5 transition-colors duration-200"
                        >
                          {activeCoverSrc ? 'Change photo' : 'Upload photo'}
                        </label>
                        <input
                          id="cover-file" type="file" accept="image/*" class="sr-only"
                          on:change={handleCoverImageChange}
                          disabled={uploadingCoverImage || isSubmitting}
                        />
                        {#if coverImagePreview}
                          <button
                            type="button" on:click={removeCoverImage}
                            class="text-center px-3 py-1.5 rounded-lg border border-red-200 bg-white text-xs font-medium text-red-500 hover:bg-red-50 transition-colors duration-200"
                          >
                            Remove
                          </button>
                        {/if}
                        {#if uploadingCoverImage}
                          <p class="text-xs text-[#4A7C59] text-center">Uploading…</p>
                        {/if}
                        {#if errors.coverImage}
                          <p class="text-xs text-red-600 text-center">{errors.coverImage}</p>
                        {/if}
                        <p class="text-xs text-gray-400 text-center leading-tight">Max 5 MB</p>
                      </div>
                    {/if}
                  </div>

                  <!-- Details column — mirrors view mode grid -->
                  <div class="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">

                    <!-- Title (full width) -->
                    <div class="sm:col-span-2">
                      <span class="block text-xs font-medium text-gray-500 mb-1">Title {#if isEditMode}<span class="text-red-400">*</span>{/if}</span>
                      {#if isEditMode}
                        <input
                          type="text" bind:value={editData.title} disabled={isSubmitting}
                          placeholder="Book title"
                          class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white {errors.title ? 'border-red-300 bg-red-50' : 'border-gray-300'}"
                        />
                        {#if errors.title}<p class="text-red-600 text-xs mt-1">{errors.title}</p>{/if}
                      {:else}
                        <span class="block text-base font-semibold text-gray-900">{book.title}</span>
                      {/if}
                    </div>

                    <!-- Author -->
                    <div>
                      <span class="block text-xs font-medium text-gray-500 mb-1">Author {#if isEditMode}<span class="text-red-400">*</span>{/if}</span>
                      {#if isEditMode}
                        <input
                          type="text" bind:value={editData.author} disabled={isSubmitting}
                          placeholder="Author name"
                          class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white {errors.author ? 'border-red-300 bg-red-50' : 'border-gray-300'}"
                        />
                        {#if errors.author}<p class="text-red-600 text-xs mt-1">{errors.author}</p>{/if}
                      {:else}
                        <span class="block text-sm text-gray-900">{book.author}</span>
                      {/if}
                    </div>

                    <!-- Book ID -->
                    <div>
                      <span class="block text-xs font-medium text-gray-500 mb-1">Book ID {#if isEditMode}<span class="text-red-400">*</span>{/if}</span>
                      {#if isEditMode}
                        <input
                          type="text" bind:value={editData.bookId} disabled={isSubmitting}
                          placeholder="BK-001"
                          class="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white {errors.bookId ? 'border-red-300 bg-red-50' : 'border-gray-300'}"
                        />
                        {#if errors.bookId}<p class="text-red-600 text-xs mt-1">{errors.bookId}</p>{/if}
                      {:else}
                        <span class="block text-sm text-gray-900 font-mono">{book.bookId || book.id}</span>
                      {/if}
                    </div>

                    <!-- Category -->
                    <div>
                      <span class="block text-xs font-medium text-gray-500 mb-1">Category {#if isEditMode}<span class="text-red-400">*</span>{/if}</span>
                      {#if isEditMode}
                        <select
                          bind:value={editData.categoryId} disabled={isSubmitting || categoriesLoading}
                          class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white {errors.category ? 'border-red-300 bg-red-50' : 'border-gray-300'}"
                        >
                          <option value="">Select a category</option>
                          {#each categories as cat}
                            <option value={cat.id}>{cat.name}</option>
                          {/each}
                        </select>
                        {#if errors.category}<p class="text-red-600 text-xs mt-1">{errors.category}</p>{/if}
                      {:else}
                        <span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E8B923]/10 text-[#0D5C29] border border-[#E8B923]/30">
                          {book.category}
                        </span>
                      {/if}
                    </div>

                    <!-- Publisher -->
                    <div>
                      <span class="block text-xs font-medium text-gray-500 mb-1">Publisher {#if isEditMode}<span class="text-red-400">*</span>{/if}</span>
                      {#if isEditMode}
                        <input
                          type="text" bind:value={editData.publisher} disabled={isSubmitting}
                          placeholder="Publisher name"
                          class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white {errors.publisher ? 'border-red-300 bg-red-50' : 'border-gray-300'}"
                        />
                        {#if errors.publisher}<p class="text-red-600 text-xs mt-1">{errors.publisher}</p>{/if}
                      {:else}
                        <span class="block text-sm text-gray-900">{book.publisher}</span>
                      {/if}
                    </div>

                    <!-- ISBN -->
                    <div>
                      <span class="block text-xs font-medium text-gray-500 mb-1">ISBN</span>
                      {#if isEditMode}
                        <input
                          type="text" bind:value={editData.isbn} disabled={isSubmitting}
                          placeholder="ISBN (optional)"
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white"
                        />
                      {:else if book.isbn}
                        <span class="block text-sm text-gray-900">{book.isbn}</span>
                      {:else}
                        <span class="block text-sm text-gray-400 italic">—</span>
                      {/if}
                    </div>

                    <!-- Edition -->
                    <div>
                      <span class="block text-xs font-medium text-gray-500 mb-1">Edition</span>
                      {#if isEditMode}
                        <input
                          type="text" bind:value={editData.edition} disabled={isSubmitting}
                          placeholder="e.g., 2nd"
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white"
                        />
                      {:else if book.edition}
                        <span class="block text-sm text-gray-900">{book.edition}</span>
                      {:else}
                        <span class="block text-sm text-gray-400 italic">—</span>
                      {/if}
                    </div>

                  </div>
                </div>
              </div>

              <!-- ══ SECTION 2: Additional Details ══════════════════════════════ -->
              <div class="bg-[#f8faf9] border border-[#4A7C59]/20 rounded-xl p-4 sm:p-5">
                <div class="flex items-center gap-2 mb-4">
                  <svg class="h-5 w-5 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  <h4 class="text-base sm:text-lg font-semibold text-[#0D5C29]">Additional Details</h4>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">

                  <!-- Published Year -->
                  <div>
                    <span class="block text-xs font-medium text-gray-500 mb-1">Published Year {#if isEditMode}<span class="text-red-400">*</span>{/if}</span>
                    {#if isEditMode}
                      <input
                        type="number" bind:value={editData.publishedYear} disabled={isSubmitting}
                        min="1000" max={new Date().getFullYear()} placeholder="2024"
                        class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white {errors.publishedYear ? 'border-red-300 bg-red-50' : 'border-gray-300'}"
                      />
                      {#if errors.publishedYear}<p class="text-red-600 text-xs mt-1">{errors.publishedYear}</p>{/if}
                    {:else}
                      <span class="block text-sm text-gray-900">{book.publishedYear}</span>
                    {/if}
                  </div>

                  <!-- Language -->
                  <div>
                    <span class="block text-xs font-medium text-gray-500 mb-1">Language</span>
                    {#if isEditMode}
                      <select
                        bind:value={editData.language} disabled={isSubmitting}
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white"
                      >
                        {#each languages as lang}
                          <option value={lang}>{lang}</option>
                        {/each}
                      </select>
                    {:else}
                      <span class="block text-sm text-gray-900">{book.language}</span>
                    {/if}
                  </div>

                  <!-- Pages -->
                  <div>
                    <span class="block text-xs font-medium text-gray-500 mb-1">Pages</span>
                    {#if isEditMode}
                      <input
                        type="number" bind:value={editData.pages} disabled={isSubmitting}
                        min="1" placeholder="Number of pages"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white"
                      />
                    {:else if book.pages}
                      <span class="block text-sm text-gray-900">{book.pages}</span>
                    {:else}
                      <span class="block text-sm text-gray-400 italic">—</span>
                    {/if}
                  </div>

                  <!-- Copies Available / Total Copies -->
                  <div>
                    <span class="block text-xs font-medium text-gray-500 mb-1">
                      {isEditMode ? 'Number of Copies' : 'Copies Available'}
                      {#if isEditMode}<span class="text-red-400">*</span>{/if}
                    </span>
                    {#if isEditMode}
                      <input
                        type="number" bind:value={editData.totalCopies} disabled={isSubmitting}
                        min="1" placeholder="1"
                        class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white {errors.totalCopies ? 'border-red-300 bg-red-50' : 'border-gray-300'}"
                      />
                      {#if errors.totalCopies}<p class="text-red-600 text-xs mt-1">{errors.totalCopies}</p>{/if}
                    {:else}
                      <span class="block text-sm text-gray-900">{book.copiesAvailable}</span>
                    {/if}
                  </div>

                  <!-- Status (view only) -->
                  {#if !isEditMode}
                    <div>
                      <span class="block text-xs font-medium text-gray-500 mb-1">Status</span>
                      {#if book.copiesAvailable && book.copiesAvailable > 0}
                        <span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">Available</span>
                      {:else}
                        <span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">Not Available</span>
                      {/if}
                    </div>
                  {/if}

                  <!-- Location -->
                  <div>
                    <span class="block text-xs font-medium text-gray-500 mb-1">Location / Shelf</span>
                    {#if isEditMode}
                      <input
                        type="text" bind:value={editData.location} disabled={isSubmitting}
                        placeholder="e.g., A1-B2, Section 3"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white"
                      />
                    {:else if book.location}
                      <span class="block text-sm text-gray-900">{book.location}</span>
                    {:else}
                      <span class="block text-sm text-gray-400 italic">—</span>
                    {/if}
                  </div>

                  <!-- Origin Place -->
                  <div class="col-span-2 sm:col-span-{isEditMode ? '2' : '1'}">
                    <span class="block text-xs font-medium text-gray-500 mb-1">Origin Place</span>
                    {#if isEditMode}
                      <input
                        type="text" bind:value={editData.originPlace} disabled={isSubmitting}
                        placeholder="e.g., Manila, Philippines"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white"
                      />
                      <p class="text-xs text-gray-400 mt-1">Where the book was published or originated</p>
                    {:else if book.originPlace}
                      <span class="block text-sm text-gray-900">{book.originPlace}</span>
                    {:else}
                      <span class="block text-sm text-gray-400 italic">—</span>
                    {/if}
                  </div>

                </div>
              </div>

              <!-- ══ SECTION 3: Description ══════════════════════════════════════ -->
              <div class="bg-[#f8faf9] border border-[#4A7C59]/20 rounded-xl p-4 sm:p-5">
                <div class="flex items-center gap-2 mb-3">
                  <svg class="h-5 w-5 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h7"/>
                  </svg>
                  <h4 class="text-base sm:text-lg font-semibold text-[#0D5C29]">Description</h4>
                </div>
                {#if isEditMode}
                  <div>
                    <textarea
                      bind:value={editData.description} rows="4" disabled={isSubmitting} maxlength="500"
                      placeholder="Brief description of the book content…"
                      class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white resize-none leading-relaxed"
                    ></textarea>
                    <p class="text-xs text-gray-400 mt-1 text-right">{editData.description.length}/500 characters</p>
                  </div>
                {:else if book.description}
                  <p class="text-sm text-gray-700 leading-relaxed">{book.description}</p>
                {:else}
                  <p class="text-sm text-gray-400 italic">No description provided.</p>
                {/if}
              </div>

              <!-- ══ SECTION 4: QR Code (view only) ════════════════════════════ -->
              {#if !isEditMode && book.qrCode}
                <div class="bg-[#f8faf9] border border-[#4A7C59]/20 rounded-xl p-4 sm:p-5">
                  <div class="flex items-center gap-2 mb-3">
                    <svg class="h-5 w-5 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
                    </svg>
                    <h4 class="text-base sm:text-lg font-semibold text-[#0D5C29]">QR Code</h4>
                  </div>
                  <div class="flex justify-center">
                    <img
                      src={book.qrCode}
                      alt="QR Code for {book.title}"
                      class="w-32 h-32 sm:w-40 sm:h-40 border-2 border-[#4A7C59]/20 rounded-lg"
                    />
                  </div>
                </div>
              {/if}

            </div>
          </div>

          <!-- ── Footer ── -->
          <div class="px-6 py-4 border-t border-[#4A7C59]/20 bg-white/80 flex flex-col sm:flex-row-reverse gap-3 flex-shrink-0">
            {#if !isEditMode}
              <button
                type="button" on:click={handleEdit}
                class="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-gradient-to-r from-[#0D5C29] to-[#4A7C59] text-sm font-semibold text-white hover:from-[#0A4520] hover:to-[#3D664A] shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
                Edit {capitalizedItemType}
              </button>
              <button
                type="button" on:click={handleClose}
                class="w-full sm:w-auto px-6 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
              >
                Close
              </button>
            {:else}
              <button
                type="submit" disabled={isSubmitting}
                class="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-gradient-to-r from-[#0D5C29] to-[#4A7C59] text-sm font-semibold text-white hover:from-[#0A4520] hover:to-[#3D664A] shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {#if isSubmitting}
                  <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Saving Changes…
                {:else}
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                  Save Changes
                {/if}
              </button>
              <button
                type="button" on:click={handleClose} disabled={isSubmitting}
                class="w-full sm:w-auto px-6 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            {/if}
          </div>

        </form>
      </div>
    </div>
  </div>
{/if}

{#if showCopiesModal}
  <ViewBookCopies
    isOpen={showCopiesModal}
    itemType="book"
    itemId={book?.id}
    itemTitle={book?.title}
    on:close={() => (showCopiesModal = false)}
  />
{/if}

<style>
  .custom-scrollbar::-webkit-scrollbar { width: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,.05); border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(74,124,89,.3); border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(74,124,89,.5); }
</style>