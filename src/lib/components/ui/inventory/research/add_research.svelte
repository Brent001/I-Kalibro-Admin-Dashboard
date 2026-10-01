<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { toast } from '$lib/stores/toastStore.js';
  import { getLeadResearchAuthor, handleResearchAuthorKeydown, normalizeResearchAuthors } from '$lib/utils/researchAuthors.js';

  export let isOpen = false;

  const dispatch = createEventDispatcher();
  let categories: { id: number; name: string }[] = [];
  let categoriesLoading = false;
  let isSubmitting = false;
  let generatingCallNumber = false;
  let errors: { [key: string]: string } = {};

  let formData = {
    thesisId: '',
    title: '',
    author: '',
    advisor: '',
    department: '',
    publicationYear: '',
    categoryId: '',
    location: '',
    totalCopies: 1,
    abstract: '',
  };

  $: if (isOpen) {
    fetchCategories();
  }

  async function fetchCategories() {
    categoriesLoading = true;
    try {
      const response = await fetch('/api/inventory/research/categories', { credentials: 'include' });
      const result = await response.json();
      categories = response.ok && result.success ? result.data.categories : [];
    } catch (err) {
      categories = [];
    } finally {
      categoriesLoading = false;
    }
  }

  async function generateCallNumber() {
    const categoryName = categories.find((category) => String(category.id) === String(formData.categoryId))?.name;
    if (!formData.title.trim() || !formData.author.trim() || !categoryName) {
      errors.location = 'Enter a title and author, then select a category.';
      return;
    }
    generatingCallNumber = true;
    try {
      const response = await fetch('/api/inventory/research/generate-call-number', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: formData.title.trim(), authorLastName: getLeadResearchAuthor(formData.author), category: categoryName, year: Number(formData.publicationYear) || undefined })
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
    if (!formData.author.trim()) newErrors.author = 'Author is required';
    if (!formData.categoryId) newErrors.category = 'Category is required';
    if (!formData.publicationYear) {
      newErrors.publicationYear = 'Publication year is required';
    } else {
      const year = parseInt(formData.publicationYear);
      const currentYear = new Date().getFullYear();
      if (year < 1000 || year > currentYear) newErrors.publicationYear = `Year must be between 1000 and ${currentYear}`;
    }
    if (formData.totalCopies < 1 || formData.totalCopies > 999) newErrors.totalCopies = 'Copies must be between 1 and 999';
    errors = newErrors;
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();
    if (!validateForm()) {
      toast.warning('Review the required research fields before submitting.');
      return;
    }
    isSubmitting = true;
    try {
      const submitData = {
        thesisId: formData.thesisId.trim() || undefined,
        title: formData.title.trim(),
        author: normalizeResearchAuthors(formData.author),
        advisor: formData.advisor.trim() || undefined,
        department: formData.department.trim() || undefined,
        publicationYear: parseInt(formData.publicationYear),
        categoryId: Number(formData.categoryId),
        location: formData.location.trim() || undefined,
        totalCopies: Number(formData.totalCopies),
        abstract: formData.abstract.trim() || undefined,
      };

      const response = await fetch('/api/inventory/research', {
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
        errors.submit = result.message || 'Failed to add research record';
        toast.error(errors.submit);
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
      thesisId: '', title: '', author: '', advisor: '', department: '', publicationYear: '',
      categoryId: '', location: '', totalCopies: 1, abstract: '',
    };
    errors = {};
  }

  function handleClose() {
    if (!isSubmitting) {
      dispatch('close');
      isOpen = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && isOpen && !isSubmitting) handleClose();
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <button
      class="fixed inset-0 bg-black/50 backdrop-blur-sm cursor-default"
      on:click={!isSubmitting ? handleClose : null}
      disabled={isSubmitting}
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
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2Z"/>
                  </svg>
                </div>
                <div class="min-w-0">
                  <h3 class="text-lg sm:text-xl font-bold text-[#0D5C29] truncate">Add New Research</h3>
                  <p class="text-xs sm:text-sm text-[#4A7C59] hidden sm:block">Add a thesis or research record to the library</p>
                </div>
              </div>
              <button
                type="button" on:click={handleClose}
                disabled={isSubmitting}
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
                  <p class="text-sm text-red-700">{errors.submit}</p>
                </div>
              {/if}

              <!-- ══ SECTION 1: Basic Information ══ -->
              <div class="bg-[#f8faf9] border border-[#4A7C59]/20 rounded-xl p-4 sm:p-5">
                <div class="flex items-center gap-2 mb-4">
                  <svg class="h-5 w-5 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <h4 class="text-base sm:text-lg font-semibold text-[#0D5C29]">Basic Information</h4>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">

                  <!-- Title (full width) -->
                  <div class="sm:col-span-2">
                    <span class="block text-xs font-medium text-gray-500 mb-1">Research Title <span class="text-red-400">*</span></span>
                    <input
                      type="text" bind:value={formData.title}
                      on:input={() => handleInputChange('title', formData.title)}
                      disabled={isSubmitting}
                      maxlength="300"
                      placeholder="e.g., Effects of Digital Learning on Student Engagement"
                      class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white {errors.title ? 'border-red-300 bg-red-50' : 'border-gray-300'}"
                    />
                    {#if errors.title}<p class="text-red-600 text-xs mt-1">{errors.title}</p>{/if}
                  </div>

                  <!-- Author -->
                  <div>
                    <span class="block text-xs font-medium text-gray-500 mb-1">Authors <span class="text-red-400">*</span></span>
                    <input
                      type="text" bind:value={formData.author}
                      on:input={() => handleInputChange('author', formData.author)}
                      on:keydown={handleResearchAuthorKeydown}
                      disabled={isSubmitting}
                      maxlength="200"
                      placeholder="Name, group, or names separated by semicolons"
                      class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white {errors.author ? 'border-red-300 bg-red-50' : 'border-gray-300'}"
                    />
                    {#if errors.author}<p class="text-red-600 text-xs mt-1">{errors.author}</p>{/if}
                  </div>

                  <!-- Advisor -->
                  <div>
                    <span class="block text-xs font-medium text-gray-500 mb-1">Advisor</span>
                    <input
                      type="text" bind:value={formData.advisor} disabled={isSubmitting}
                      maxlength="200"
                      placeholder="e.g., Dr. Maria Santos"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white"
                    />
                  </div>

                  <!-- Department -->
                  <div>
                    <span class="block text-xs font-medium text-gray-500 mb-1">Department</span>
                    <input
                      type="text" bind:value={formData.department} disabled={isSubmitting}
                      maxlength="100"
                      placeholder="e.g., College of Education"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white"
                    />
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

                  <!-- Publication Year -->
                  <div>
                    <span class="block text-xs font-medium text-gray-500 mb-1">Publication Year <span class="text-red-400">*</span></span>
                    <input
                      type="number" bind:value={formData.publicationYear}
                      on:input={() => handleInputChange('publicationYear', formData.publicationYear)}
                      disabled={isSubmitting}
                      min="1000" max={new Date().getFullYear()}
                      placeholder={new Date().getFullYear().toString()}
                      class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white {errors.publicationYear ? 'border-red-300 bg-red-50' : 'border-gray-300'}"
                    />
                    {#if errors.publicationYear}<p class="text-red-600 text-xs mt-1">{errors.publicationYear}</p>{/if}
                  </div>

                  <!-- Research ID -->
                  <div>
                    <span class="block text-xs font-medium text-gray-500 mb-1">Research ID</span>
                    <input
                      type="text" bind:value={formData.thesisId} disabled={isSubmitting}
                      maxlength="30"
                      placeholder="Auto-generated if blank"
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white"
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

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  <!-- Category -->
                  <div>
                    <span class="block text-xs font-medium text-gray-500 mb-1">Category <span class="text-red-400">*</span></span>
                    <select
                      bind:value={formData.categoryId}
                      on:change={() => handleInputChange('categoryId', formData.categoryId)}
                      disabled={isSubmitting || categoriesLoading}
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

                  <!-- Total Copies -->
                  <div>
                    <span class="block text-xs font-medium text-gray-500 mb-1">Total Copies <span class="text-red-400">*</span></span>
                    <input
                      type="number" bind:value={formData.totalCopies} disabled={isSubmitting}
                      min="1" max="999" placeholder="1"
                      class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white {errors.totalCopies ? 'border-red-300 bg-red-50' : 'border-gray-300'}"
                    />
                    {#if errors.totalCopies}<p class="text-red-600 text-xs mt-1">{errors.totalCopies}</p>{/if}
                  </div>

                  <!-- Shelf Location -->
                  <div class="sm:col-span-2">
                    <span class="block text-xs font-medium text-gray-500 mb-1">Shelf Location</span>
                    <div class="flex gap-2">
                      <input type="text" bind:value={formData.location} disabled={isSubmitting || generatingCallNumber} maxlength="100" placeholder="e.g., Thesis Archive Shelf 4" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white" />
                      <button type="button" on:click={generateCallNumber} disabled={isSubmitting || generatingCallNumber} class="shrink-0 rounded-lg border border-[#4A7C59]/30 px-3 text-xs font-medium text-[#0D5C29] disabled:opacity-50">{generatingCallNumber ? 'Generating...' : 'Generate'}</button>
                    </div>
                    {#if errors.location}<p class="mt-1 text-xs text-red-600">{errors.location}</p>{/if}
                  </div>

                </div>
              </div>

              <!-- ══ SECTION 4: Abstract ══ -->
              <div class="bg-[#f8faf9] border border-[#4A7C59]/20 rounded-xl p-4 sm:p-5">
                <div class="flex items-center gap-2 mb-3">
                  <svg class="h-5 w-5 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h7"/>
                  </svg>
                  <h4 class="text-base sm:text-lg font-semibold text-[#0D5C29]">Abstract</h4>
                </div>
                <textarea
                  bind:value={formData.abstract} rows="6"
                  disabled={isSubmitting} maxlength="10000"
                  placeholder="Summary of the research problem, methodology, and key findings…"
                  class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white resize-none leading-relaxed"
                ></textarea>
                <p class="text-xs text-gray-400 mt-1 text-right">{formData.abstract.length}/10000 characters</p>
              </div>

            </div>
          </div>

          <!-- ── Footer ── -->
          <div class="px-6 py-4 border-t border-[#4A7C59]/20 bg-white/80 flex flex-col sm:flex-row-reverse gap-3 flex-shrink-0">
            <button
              type="submit"
              disabled={isSubmitting}
              class="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-gradient-to-r from-[#0D5C29] to-[#4A7C59] text-sm font-semibold text-white hover:from-[#0A4520] hover:to-[#3D664A] shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {#if isSubmitting}
                <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Adding Research…
              {:else}
                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Add Research
              {/if}
            </button>
            <button
              type="button" on:click={handleClose}
              disabled={isSubmitting}
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