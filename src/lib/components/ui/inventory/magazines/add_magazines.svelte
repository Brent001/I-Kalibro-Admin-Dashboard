<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { toast } from '$lib/stores/toastStore.js';

  export let isOpen = false;

  const dispatch = createEventDispatcher();
  let languages = ['English', 'Filipino', 'Spanish', 'French', 'German', 'Japanese', 'Chinese', 'Other'];

  let categories: { id: number; name: string }[] = [];
  let categoriesLoading = false;
  let isSubmitting = false;
  let errors: { [key: string]: string } = {};
  let coverImageFile: File | null = null;
  let coverImagePreview = '';
  let coverSourceUrl = '';
  let uploadingCoverImage = false;
  let generatingCallNumber = false;
  let lookingUpMetadata = false;
  let lookupMessage = '';
  let lookupMessageType: 'error' | 'info' = 'info';
  let magazineSuggestions: { id: string; title: string; publisher: string | null }[] = [];
  let loadingSuggestions = false;
  let suggestionTimeout: ReturnType<typeof setTimeout>;
  let suggestionRequestId = 0;

  let formData = {
    magazineId: '',
    title: '',
    publisher: '',
    issn: '',
    volume: '',
    issueNumber: '',
    publishedDate: '',
    language: 'English',
    categoryId: '',
    location: '',
    totalCopies: 1,
    description: '',
    coverImage: '',
  };

  $: if (isOpen) {
    fetchCategories();
    fetchLanguages();
  }

  async function fetchCategories() {
    categoriesLoading = true;
    try {
      const response = await fetch('/api/inventory/magazines/categories?itemType=magazine', { credentials: 'include' });
      const result = await response.json();
      categories = response.ok && result.success ? result.data.categories : [];
    } catch (err) {
      categories = [];
    } finally {
      categoriesLoading = false;
    }
  }

  async function fetchLanguages() {
    try {
      const response = await fetch('/api/inventory/magazines/languages', { credentials: 'include' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Could not load magazine languages.');
      languages = result.data?.languages || ['English'];
    } catch (cause) {
      errors.language = cause instanceof Error ? cause.message : 'Could not load magazine languages.';
      toast.error(errors.language);
    }
  }

  async function lookupMagazineMetadata() {
    const title = formData.title.trim();
    const issn = formData.issn.trim();
    if (!title && !issn) {
      lookupMessageType = 'error';
      lookupMessage = 'Enter a title or ISSN first.';
      return;
    }

    lookingUpMetadata = true;
    lookupMessage = '';
    try {
      const params = new URLSearchParams();
      if (title) params.set('title', title);
      if (issn) params.set('issn', issn);
      const response = await fetch(`/api/inventory/magazines/lookup?${params}`, { credentials: 'include' });
      const result = await response.json();
      if (!response.ok || !result.success) {
        lookupMessageType = 'error';
        lookupMessage = response.status === 401
          ? 'Your session has expired. Please sign in again, then retry the lookup.'
          : result.code === 'INVALID_INPUT'
          ? 'Enter a valid magazine title or ISSN.'
          : result.code === 'NOT_FOUND'
            ? 'No magazine metadata was found.'
            : result.code === 'UPSTREAM'
              ? 'Metadata providers are temporarily unavailable.'
              : result.error || 'Magazine lookup failed.';
        return;
      }

      const data = result.data;
      const next = { ...formData };
      const fill = (field: keyof typeof next, value: unknown) => {
        if (!String(next[field] ?? '').trim() && value !== null && value !== undefined) {
          next[field] = String(value) as never;
        }
      };

      fill('title', data.title);
      fill('publisher', data.publisher);
      fill('issn', data.issn);
      fill('language', data.language);
      fill('description', data.description);

      if (!next.categoryId && data.suggestedCategory) {
        const match = categories.find((category) =>
          category.name.trim().toLowerCase() === String(data.suggestedCategory).trim().toLowerCase()
        );
        if (match) next.categoryId = String(match.id);
      }

      if (!next.coverImage && data.coverImage) next.coverImage = data.coverImage;
      formData = next;
      if (!coverImageFile) {
        coverSourceUrl = data.coverUrl || '';
        coverImagePreview = data.coverUrl || '';
      }
      lookupMessageType = 'info';
      lookupMessage = data.coverStatus === 'not_found' || data.coverStatus === 'storage_not_configured'
        ? 'Best-match details loaded. No stored cover is available; verify the issue before saving.'
        : 'Best-match details and cover loaded. Verify the issue before saving.';
    } catch {
      lookupMessageType = 'error';
      lookupMessage = 'Network error while looking up the magazine.';
    } finally {
      lookingUpMetadata = false;
    }
  }

  function scheduleMagazineSuggestions() {
    clearTimeout(suggestionTimeout);
    magazineSuggestions = [];
    const query = formData.title.trim();
    if (query.length < 2) {
      magazineSuggestions = [];
      return;
    }
    suggestionTimeout = setTimeout(() => fetchMagazineSuggestions(query), 350);
  }

  function hideMagazineSuggestions() {
    setTimeout(() => {
      magazineSuggestions = [];
    }, 150);
  }

  async function fetchMagazineSuggestions(query: string) {
    const requestId = ++suggestionRequestId;
    loadingSuggestions = true;
    try {
      const response = await fetch(`/api/inventory/magazines/suggestions?q=${encodeURIComponent(query)}`, {
        credentials: 'include'
      });
      const result = await response.json();
      if (requestId === suggestionRequestId && response.ok && result.success) {
        magazineSuggestions = result.data;
      }
    } catch {
      if (requestId === suggestionRequestId) magazineSuggestions = [];
    } finally {
      if (requestId === suggestionRequestId) loadingSuggestions = false;
    }
  }

  function selectMagazineSuggestion(suggestion: { title: string; publisher: string | null }) {
    formData = {
      ...formData,
      title: suggestion.title,
      publisher: formData.publisher.trim() || suggestion.publisher || formData.publisher
    };
    magazineSuggestions = [];
    lookupMagazineMetadata();
  }

  async function generateCallNumber() {
    const categoryName = categories.find((category) => String(category.id) === String(formData.categoryId))?.name;
    if (!formData.title.trim() || !categoryName) {
      errors.location = 'Enter a title and select a category first.';
      return;
    }
    generatingCallNumber = true;
    try {
      const response = await fetch('/api/inventory/magazines/generate-call-number', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title.trim(), publisher: formData.publisher.trim(), category: categoryName,
          year: formData.publishedDate ? Number(formData.publishedDate.slice(0, 4)) : undefined,
          volume: formData.volume ? Number(formData.volume) : undefined,
          issue: formData.issueNumber ? Number(formData.issueNumber) : undefined
        })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || result.error || 'Could not generate a call number.');
      formData.location = result.data.callNumber;
      errors.location = '';
    } catch (cause) {
      errors.location = cause instanceof Error ? cause.message : 'Could not generate a call number.';
      toast.error(errors.location);
    } finally {
      generatingCallNumber = false;
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  });

  function handleInputChange(field: string, value: string | number) {
    formData = { ...formData, [field]: value };
    if (errors[field]) {
      errors = { ...errors, [field]: '' };
    }
  }

  function validateForm() {
    const newErrors: { [key: string]: string } = {};
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.categoryId) newErrors.category = 'Category is required';
    if (formData.totalCopies < 1 || formData.totalCopies > 999) newErrors.totalCopies = 'Copies must be between 1 and 999';
    errors = newErrors;
    return Object.keys(newErrors).length === 0;
  }

  function handleCoverImageChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { errors.coverImage = 'Please select an image file'; return; }
    if (file.size > 5 * 1024 * 1024) { errors.coverImage = 'Image size must be less than 5MB'; return; }
    coverImageFile = file;
    coverSourceUrl = '';
    const reader = new FileReader();
    reader.onload = () => { coverImagePreview = String(reader.result || ''); };
    reader.readAsDataURL(file);
    errors.coverImage = '';
  }

  function removeCoverImage() {
    coverImageFile = null;
    coverImagePreview = '';
    coverSourceUrl = '';
    formData.coverImage = '';
    errors.coverImage = '';
  }

  async function uploadCoverImage(): Promise<string | null> {
    if (!coverImageFile) return null;
    uploadingCoverImage = true;
    try {
      const upload = new FormData();
      upload.append('file', coverImageFile);
      upload.append('itemId', '0');
      upload.append('itemType', 'magazine');
      const response = await fetch('/api/images/upload/', { method: 'POST', credentials: 'include', body: upload });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Cover upload failed');
      return result.photoUrl || null;
    } catch (cause) {
      errors.coverImage = cause instanceof Error ? cause.message : 'Cover upload failed';
      toast.error(errors.coverImage);
      return null;
    } finally {
      uploadingCoverImage = false;
    }
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();
    if (!validateForm()) return;
    isSubmitting = true;
    try {
      let coverImageUrl = formData.coverImage;
      if (coverImageFile) {
        const uploadedCoverImage = await uploadCoverImage();
        if (!uploadedCoverImage) { isSubmitting = false; return; }
        coverImageUrl = uploadedCoverImage;
      }
      const submitData = {
        magazineId: formData.magazineId.trim() || undefined,
        title: formData.title.trim(),
        publisher: formData.publisher.trim() || undefined,
        issn: formData.issn.trim() || undefined,
        volume: formData.volume.trim() || undefined,
        issueNumber: formData.issueNumber.trim() || undefined,
        publishedDate: formData.publishedDate || undefined,
        language: formData.language,
        categoryId: Number(formData.categoryId),
        location: formData.location.trim() || undefined,
        totalCopies: Number(formData.totalCopies),
        description: formData.description.trim() || undefined,
        coverImage: coverImageUrl || undefined,
        coverSourceUrl: coverSourceUrl || undefined,
        itemType: 'magazine',
      };

      const response = await fetch('/api/inventory/magazines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(submitData),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        dispatch('success', result.data);
        handleClose();
        resetForm();
      } else {
        errors.submit = result.message || 'Failed to add magazine';
        dispatch('error', { message: errors.submit });
      }
    } catch (error) {
      errors.submit = 'Network error. Please try again.';
      dispatch('error', { message: errors.submit });
    } finally {
      isSubmitting = false;
    }
  }

  function resetForm() {
    formData = {
      magazineId: '', title: '', publisher: '', issn: '', volume: '', issueNumber: '',
      publishedDate: '', language: 'English', categoryId: '', location: '', totalCopies: 1, description: '', coverImage: '',
    };
    errors = {};
    coverImageFile = null;
    coverImagePreview = '';
    coverSourceUrl = '';
    lookupMessage = '';
    magazineSuggestions = [];
  }

  function handleClose() {
    if (!isSubmitting && !uploadingCoverImage) {
      dispatch('close');
      isOpen = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && isOpen && !isSubmitting && !uploadingCoverImage) handleClose();
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <button
      class="fixed inset-0 bg-black/50 backdrop-blur-sm cursor-default"
      on:click={!isSubmitting && !uploadingCoverImage ? handleClose : null}
      disabled={isSubmitting || uploadingCoverImage}
      aria-label="Close modal"
      type="button"
    ></button>

    <div class="relative w-full max-w-5xl transform transition-all duration-300 scale-100">
      <div class="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-[#4A7C59]/30 overflow-hidden flex flex-col h-[90vh]">
        <form on:submit={handleSubmit} class="flex flex-col h-full">

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
                  <h3 class="text-lg sm:text-xl font-bold text-[#0D5C29] truncate">Add New Magazine</h3>
                  <p class="text-xs sm:text-sm text-[#4A7C59] hidden sm:block">Complete the form to add a magazine to the library</p>
                </div>
              </div>
              <button
                type="button" on:click={handleClose}
                disabled={isSubmitting || uploadingCoverImage}
                aria-label="Close modal"
                class="p-2 rounded-lg text-gray-400 hover:text-[#0D5C29] hover:bg-[#0D5C29]/10 transition-colors duration-200 disabled:opacity-50 flex-shrink-0"
              >
                <svg class="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- ── Body ── -->
          <div class="px-6 py-6 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
            <div class="space-y-5">

              {#if errors.submit}
                <div class="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <svg class="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                  </svg>
                  <div class="flex-1">
                    <h4 class="text-sm font-semibold text-red-800">Error Adding Magazine</h4>
                    <p class="text-sm text-red-700 mt-1">{errors.submit}</p>
                  </div>
                </div>
              {/if}

              <!-- ══ SECTION 1: Cover + Basic Info ══ -->
              <div class="bg-[#f8faf9] border border-[#4A7C59]/20 rounded-xl p-4 sm:p-5">
                <div class="flex items-center gap-2 mb-4">
                  <svg class="h-5 w-5 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <h4 class="text-base sm:text-lg font-semibold text-[#0D5C29]">Basic Information</h4>
                </div>

                <div class="flex flex-col sm:flex-row gap-5">
                  <!-- Cover image column -->
                  <div class="flex-shrink-0 flex flex-col items-center sm:items-start gap-2">
                    {#if coverImagePreview}
                      <img
                        src={coverImagePreview}
                        alt="Cover preview"
                        class="w-32 sm:w-40 rounded-lg shadow-md object-cover border border-[#B8860B]/20"
                      />
                    {:else}
                      <div class="w-32 sm:w-40 rounded-lg border-2 border-dashed border-[#4A7C59]/30 bg-white flex flex-col items-center justify-center gap-2 py-8">
                        <svg class="h-8 w-8 text-[#4A7C59]/40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        <span class="text-xs text-gray-400 text-center px-2">No cover photo</span>
                      </div>
                    {/if}

                    <div class="flex flex-col gap-1.5 w-32 sm:w-40">
                      <label
                        for="magazine-cover-file"
                        class="cursor-pointer text-center px-3 py-1.5 rounded-lg border border-[#4A7C59]/40 bg-white text-xs font-medium text-[#0D5C29] hover:bg-[#0D5C29]/5 transition-colors duration-200"
                      >
                        {coverImagePreview ? 'Change photo' : 'Upload photo'}
                      </label>
                      <input
                        id="magazine-cover-file" type="file" accept="image/*" class="sr-only"
                        on:change={handleCoverImageChange}
                        disabled={uploadingCoverImage || isSubmitting}
                      />
                      {#if coverImagePreview}
                        <button
                          type="button" on:click={removeCoverImage}
                          class="text-center px-3 py-1.5 rounded-lg border border-red-200 bg-white text-xs font-medium text-red-500 hover:bg-red-50 transition-colors duration-200"
                        >Remove</button>
                      {/if}
                      {#if uploadingCoverImage}
                        <p class="text-xs text-[#4A7C59] text-center">Uploading…</p>
                      {/if}
                      {#if errors.coverImage}
                        <p class="text-xs text-red-600 text-center">{errors.coverImage}</p>
                      {/if}
                      <p class="text-xs text-gray-400 text-center leading-tight">PNG, JPG up to 5 MB</p>
                    </div>
                  </div>

                  <!-- Fields column -->
                  <div class="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">

                    <!-- Title (full width) -->
                    <div class="sm:col-span-2 relative">
                      <div class="flex items-center justify-between gap-2 mb-1">
                        <span class="block text-xs font-medium text-gray-500">Magazine Title <span class="text-red-400">*</span></span>
                        <button
                          type="button"
                          on:click={lookupMagazineMetadata}
                          disabled={isSubmitting || uploadingCoverImage || lookingUpMetadata}
                          class="text-xs font-semibold text-[#0D5C29] hover:text-[#4A7C59] disabled:opacity-50"
                        >{lookingUpMetadata ? 'Looking up…' : 'Lookup'}</button>
                      </div>
                      <input
                        type="text" bind:value={formData.title}
                        on:input={() => { handleInputChange('title', formData.title); scheduleMagazineSuggestions(); }}
                        on:blur={hideMagazineSuggestions}
                        disabled={isSubmitting || uploadingCoverImage || lookingUpMetadata}
                        maxlength="200"
                        placeholder="e.g., National Geographic"
                        class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white {errors.title ? 'border-red-300 bg-red-50' : 'border-gray-300'}"
                      />
                      {#if magazineSuggestions.length > 0}
                        <div class="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                          {#each magazineSuggestions as suggestion}
                            <button
                              type="button"
                              class="block w-full px-3 py-2 text-left text-sm hover:bg-[#f8faf9]"
                              on:click={() => selectMagazineSuggestion(suggestion)}
                            >
                              <span class="block font-medium text-gray-800">{suggestion.title}</span>
                              {#if suggestion.publisher}<span class="block text-xs text-gray-500">{suggestion.publisher}</span>{/if}
                            </button>
                          {/each}
                        </div>
                      {:else if loadingSuggestions}
                        <p class="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 shadow-lg">Searching…</p>
                      {/if}
                      {#if errors.title}<p class="text-red-600 text-xs mt-1">{errors.title}</p>{/if}
                    </div>

                    <!-- Publisher -->
                    <div>
                      <span class="block text-xs font-medium text-gray-500 mb-1">Publisher</span>
                      <input
                        type="text" bind:value={formData.publisher} disabled={isSubmitting || uploadingCoverImage}
                        maxlength="100"
                        placeholder="e.g., Elsevier"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white"
                      />
                    </div>

                    <!-- Category -->
                    <div>
                      <span class="block text-xs font-medium text-gray-500 mb-1">Category <span class="text-red-400">*</span></span>
                      <select
                        bind:value={formData.categoryId}
                        on:change={() => handleInputChange('categoryId', formData.categoryId)}
                        disabled={isSubmitting || uploadingCoverImage || categoriesLoading}
                        class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white {errors.category ? 'border-red-300 bg-red-50' : 'border-gray-300'}"
                      >
                        <option value="">Select a category</option>
                        {#if categoriesLoading}
                          <option value="" disabled>Loading categories…</option>
                        {:else}
                          {#each categories as category}
                            <option value={category.id}>{category.name}</option>
                          {/each}
                        {/if}
                      </select>
                      {#if errors.category}<p class="text-red-600 text-xs mt-1">{errors.category}</p>{/if}
                    </div>

                    <!-- ISSN -->
                    <div>
                      <span class="block text-xs font-medium text-gray-500 mb-1">ISSN</span>
                      <input
                        type="text" bind:value={formData.issn} disabled={isSubmitting || uploadingCoverImage || lookingUpMetadata}
                        maxlength="20"
                        placeholder="e.g., 2049-3630"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white"
                      />
                    </div>

                    {#if lookupMessage}
                      <p class="sm:col-span-2 text-xs {lookupMessageType === 'error' ? 'text-red-600' : 'text-[#4A7C59]'}">{lookupMessage}</p>
                    {/if}

                    <!-- Language -->
                    <div>
                      <span class="block text-xs font-medium text-gray-500 mb-1">Language</span>
                      <select
                        bind:value={formData.language} disabled={isSubmitting || uploadingCoverImage}
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white"
                      >
                        {#each languages as lang}
                          <option value={lang}>{lang}</option>
                        {/each}
                      </select>
                    </div>

                  </div>
                </div>
              </div>

              <!-- ══ SECTION 2: Publication Details ══ -->
              <div class="bg-[#f8faf9] border border-[#4A7C59]/20 rounded-xl p-4 sm:p-5">
                <div class="flex items-center gap-2 mb-4">
                  <svg class="h-5 w-5 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  <h4 class="text-base sm:text-lg font-semibold text-[#0D5C29]">Publication Details</h4>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">

                  <!-- Volume -->
                  <div>
                    <span class="block text-xs font-medium text-gray-500 mb-1">Volume</span>
                    <input
                      type="text" bind:value={formData.volume} disabled={isSubmitting || uploadingCoverImage}
                      maxlength="50"
                      placeholder="e.g., 12"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white"
                    />
                  </div>

                  <!-- Issue Number -->
                  <div>
                    <span class="block text-xs font-medium text-gray-500 mb-1">Issue Number</span>
                    <input
                      type="text" bind:value={formData.issueNumber} disabled={isSubmitting || uploadingCoverImage}
                      maxlength="50"
                      placeholder="e.g., 3"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white"
                    />
                  </div>

                  <!-- Publication Date -->
                  <div>
                    <span class="block text-xs font-medium text-gray-500 mb-1">Publication Date</span>
                    <input
                      type="date" bind:value={formData.publishedDate} disabled={isSubmitting || uploadingCoverImage}
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white"
                    />
                  </div>

                </div>
              </div>

              <!-- ══ SECTION 3: Library Management ══ -->
              <div class="bg-[#f8faf9] border border-[#4A7C59]/20 rounded-xl p-4 sm:p-5">
                <div class="flex items-center gap-2 mb-4">
                  <svg class="h-5 w-5 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
                  </svg>
                  <h4 class="text-base sm:text-lg font-semibold text-[#0D5C29]">Library Management</h4>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">

                  <!-- Magazine ID -->
                  <div>
                    <span class="block text-xs font-medium text-gray-500 mb-1">Magazine ID</span>
                    <input
                      type="text" bind:value={formData.magazineId} disabled={isSubmitting || uploadingCoverImage}
                      maxlength="30"
                      placeholder="Auto-generated if blank"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white"
                    />
                    <p class="text-xs text-gray-400 mt-1">Leave blank to auto-generate</p>
                  </div>

                  <!-- Total Copies -->
                  <div>
                    <span class="block text-xs font-medium text-gray-500 mb-1">Total Copies <span class="text-red-400">*</span></span>
                    <input
                      type="number" bind:value={formData.totalCopies} disabled={isSubmitting || uploadingCoverImage}
                      min="1" max="999" placeholder="1"
                      class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white {errors.totalCopies ? 'border-red-300 bg-red-50' : 'border-gray-300'}"
                    />
                    {#if errors.totalCopies}<p class="text-red-600 text-xs mt-1">{errors.totalCopies}</p>{/if}
                  </div>

                  <!-- Shelf Location -->
                  <div>
                    <span class="block text-xs font-medium text-gray-500 mb-1">Shelf Location</span>
                    <div class="flex gap-2">
                      <input type="text" bind:value={formData.location} disabled={isSubmitting || uploadingCoverImage || generatingCallNumber} maxlength="100" placeholder="e.g., Periodicals Rack A" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white" />
                      <button type="button" on:click={generateCallNumber} disabled={isSubmitting || uploadingCoverImage || generatingCallNumber} class="shrink-0 rounded-lg border border-[#4A7C59]/30 px-3 text-xs font-medium text-[#0D5C29] disabled:opacity-50">{generatingCallNumber ? 'Generating...' : 'Generate'}</button>
                    </div>
                    {#if errors.location}<p class="mt-1 text-xs text-red-600">{errors.location}</p>{/if}
                  </div>

                </div>
              </div>

              <!-- ══ SECTION 4: Description ══ -->
              <div class="bg-[#f8faf9] border border-[#4A7C59]/20 rounded-xl p-4 sm:p-5">
                <div class="flex items-center gap-2 mb-3">
                  <svg class="h-5 w-5 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h7"/>
                  </svg>
                  <h4 class="text-base sm:text-lg font-semibold text-[#0D5C29]">Description</h4>
                </div>
                <textarea
                  bind:value={formData.description} rows="4"
                  disabled={isSubmitting || uploadingCoverImage} maxlength="500"
                  placeholder="Brief description of the magazine's scope, subject areas, target audience…"
                  class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white resize-none leading-relaxed"
                ></textarea>
                <p class="text-xs text-gray-400 mt-1 text-right">{formData.description.length}/500 characters</p>
              </div>

            </div>
          </div>

          <!-- ── Footer ── -->
          <div class="px-6 py-4 border-t border-[#4A7C59]/20 bg-white/80 flex flex-col sm:flex-row-reverse gap-3 flex-shrink-0">
            <button
              type="submit"
              disabled={isSubmitting || uploadingCoverImage}
              class="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-gradient-to-r from-[#0D5C29] to-[#4A7C59] text-sm font-semibold text-white hover:from-[#0A4520] hover:to-[#3D664A] shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {#if isSubmitting}
                <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Adding Magazine…
              {:else if uploadingCoverImage}
                <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Uploading Cover…
              {:else}
                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Add Magazine
              {/if}
            </button>
            <button
              type="button" on:click={handleClose}
              disabled={isSubmitting || uploadingCoverImage}
              class="w-full sm:w-auto px-6 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>

        </form>
      </div>
    </div>
  </div>
{/if}

<style>
  .custom-scrollbar::-webkit-scrollbar { width: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,.05); border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(74,124,89,.3); border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(74,124,89,.5); }
</style>