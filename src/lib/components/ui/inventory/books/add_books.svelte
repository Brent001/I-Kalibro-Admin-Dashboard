<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';

  export let isOpen: boolean = false;
  export let itemType: string = 'book';

  $: capitalizedItemType = itemType && itemType.length ? itemType.charAt(0).toUpperCase() + itemType.slice(1) : 'Item';

  const dispatch = createEventDispatcher();
  
  // Enhanced form data (book-only)
  let formData = {
    title: '',
    author: '',
    bookId: '',
    isbn: '',
    publisher: '',
    publishedYear: '',
    edition: '',
    language: 'English',
    pages: '',
    categoryId: '',
    location: '',
    totalCopies: 1,
    description: '',
    coverImage: '',
    
  };
  
  let errors: {[key: string]: string} = {};
  let isSubmitting = false;
  let coverImageFile: File | null = null;
  let coverImagePreview: string = '';
  let uploadingCoverImage = false;
  let generatingCallNumber = false;

  // Fetch categories from API
  let categories: { id: number, name: string, ddc?: string }[] = [];
  let categoriesLoading = false;

  $: if (isOpen) {
    fetchCategories();
  }

  async function fetchCategories() {
    categoriesLoading = true;
    try {
        const response = await fetch(`/api/inventory/books/categories?itemType=${encodeURIComponent(itemType)}`, {
          credentials: 'include'
        });
      const data = await response.json();
      if (response.ok && data.success) {
        categories = data.data.categories;
      } else {
        categories = [];
      }
    } catch (err) {
      categories = [];
    } finally {
      categoriesLoading = false;
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  });

  const languages = [
    'English','Filipino','Spanish','French','German','Japanese','Chinese','Other'
  ];

  function handleInputChange(field: string, value: string | number | boolean) {
    formData = { ...formData, [field]: value };
    if (errors[field]) {
      errors = { ...errors, [field]: '' };
    }
  }

  // Auto-generate bookId and location when relevant fields change
  $: if (formData.author.trim() && formData.categoryId) {
    generateCallNumberDebounced();
  }

  // Debounce call number generation
  let callNumberTimeout: ReturnType<typeof setTimeout>;
  async function generateCallNumberDebounced() {
    clearTimeout(callNumberTimeout);
    callNumberTimeout = setTimeout(() => {
      generateCallNumberFromAPI();
    }, 500);
  }

  async function generateCallNumberFromAPI() {
    if (!formData.author.trim() || !formData.categoryId) return;

    const categoryName = categories.find(c => c.id.toString() === formData.categoryId.toString())?.name || '';
    if (!categoryName) return;

    generatingCallNumber = true;
    try {
      const response = await fetch('/api/inventory/books/generate-call-number', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
            authorLastName: formData.author.trim(),
            category: categoryName.toLowerCase().replace(/\s+/g, '_'),
            year: formData.publishedYear ? parseInt(formData.publishedYear) : undefined,
            copy: formData.totalCopies,
          }),
      });

      const data = await response.json();
      
      if (data.success && data.data) {
        // Update bookId with the generated unique ID
        if (!formData.bookId || formData.bookId.trim().length === 0) {
          formData.bookId = data.data.bookId;
        }
        
        // Update location with the full call number
        if (!formData.location || formData.location.trim().length === 0) {
          formData.location = data.data.display.full;
        }
      }
    } catch (error) {
      console.error('Error generating call number:', error);
    } finally {
      generatingCallNumber = false;
    }
  }

  function handleCoverImageChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (file) {
      if (!file.type.startsWith('image/')) {
        errors.coverImage = 'Please select an image file';
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        errors.coverImage = 'Image size must be less than 5MB';
        return;
      }
      
      coverImageFile = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        coverImagePreview = e.target?.result as string;
      };
      reader.readAsDataURL(file);
      errors.coverImage = '';
    }
  }

  function removeCoverImage() {
    coverImageFile = null;
    coverImagePreview = '';
    formData.coverImage = '';
    errors.coverImage = '';
  }

  async function uploadCoverImageToBackblaze(): Promise<string | null> {
    if (!coverImageFile) return null;
    
    uploadingCoverImage = true;
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', coverImageFile);
      formDataUpload.append('itemId', '0');
      formDataUpload.append('itemType', itemType || 'book');
      
      const uploadResponse = await fetch('/api/images/upload/', {
        method: 'POST',
        credentials: 'include',
        body: formDataUpload
      });
      
      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        errors.coverImage = errorData.message || 'Upload failed';
        return null;
      }
      
      const result = await uploadResponse.json();
      return result.photoUrl;
    } catch (error) {
      console.error('Error uploading cover image:', error);
      errors.coverImage = 'Network error while uploading image';
      return null;
    } finally {
      uploadingCoverImage = false;
    }
  }

  function validateForm() {
    const newErrors: {[key: string]: string} = {};
    
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.author.trim()) newErrors.author = 'Author is required';
    if (!formData.categoryId) newErrors.category = 'Category is required';
    if (!formData.publisher.trim()) newErrors.publisher = 'Publisher is required';
    
    if (!formData.publishedYear) {
      newErrors.publishedYear = 'Published year is required';
    } else {
      const year = parseInt(formData.publishedYear);
      const currentYear = new Date().getFullYear();
      if (year < 1000 || year > currentYear) {
        newErrors.publishedYear = `Year must be between 1000 and ${currentYear}`;
      }
    }
    
    // No serial-specific validation (book-only)
    
    if (formData.totalCopies < 1 || formData.totalCopies > 999) {
      newErrors.totalCopies = 'Copies must be between 1 and 999';
    }
    
    errors = newErrors;
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    isSubmitting = true;

    try {
      let coverImageUrl = formData.coverImage;
      
      if (coverImageFile) {
        const uploadedUrl = await uploadCoverImageToBackblaze();
        if (uploadedUrl) {
          coverImageUrl = uploadedUrl;
        } else {
          isSubmitting = false;
          return;
        }
      }

      const submitData = {
        title: formData.title.trim(),
        author: formData.author.trim(),
        bookId: formData.bookId.trim() || undefined,
        isbn: formData.isbn.trim() || undefined,
        publisher: formData.publisher.trim(),
        publishedYear: parseInt(formData.publishedYear),
        edition: formData.edition.trim() || undefined,
        language: formData.language,
        pages: formData.pages ? parseInt(formData.pages) : undefined,
        categoryId: parseInt(formData.categoryId),
        location: formData.location.trim(),
        totalCopies: formData.totalCopies,
        description: formData.description.trim() || undefined,
        coverImage: coverImageUrl || undefined,
        // book-only payload
      };

      const response = await fetch('/api/inventory/books', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(submitData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        dispatch('bookAdded', result.data);
        // Backwards-compatible event name and a generic success event
        dispatch('success', result.data);
        handleClose();
        resetForm();
      } else {
        errors.submit = result.message || 'Failed to add book';
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      errors.submit = 'Network error. Please try again.';
    } finally {
      isSubmitting = false;
    }
  }

  function resetForm() {
    formData = {
      title: '',
      author: '',
      bookId: '',
      isbn: '',
      publisher: '',
      publishedYear: '',
      edition: '',
      language: 'English',
      pages: '',
      categoryId: '',
      location: '',
      totalCopies: 1,
      description: '',
      coverImage: '',
      
    };
    errors = {};
    coverImageFile = null;
    coverImagePreview = '';
  }

  function handleClose() {
    if (!isSubmitting && !uploadingCoverImage) {
      dispatch('close');
      isOpen = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && isOpen && !isSubmitting && !uploadingCoverImage) {
      handleClose();
    }
  }
</script>

{#if isOpen}
  <div 
    class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4"
    on:click={(e) => e.target === e.currentTarget && handleClose()}
  >
    <div 
      class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden"
      on:click|stopPropagation
    >
      <!-- Header -->
      <div class="px-6 py-5 border-b border-[#4A7C59]/20 bg-gradient-to-r from-[#0D5C29] to-[#4A7C59] flex-shrink-0">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="h-10 w-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
              </svg>
            </div>
            <div>
              <h3 class="text-xl sm:text-2xl font-bold text-white">Add New {capitalizedItemType}</h3>
              <p class="text-white/80 text-xs sm:text-sm mt-0.5">Complete the form to add a new {itemType} to the library</p>
            </div>
          </div>
          <button 
            type="button"
            on:click={handleClose}
            disabled={isSubmitting || uploadingCoverImage}
            class="h-10 w-10 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur flex items-center justify-center transition-all duration-200 disabled:opacity-50 group"
          >
            <svg class="h-5 w-5 text-white group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Form -->
      <form on:submit={handleSubmit} class="flex-1 overflow-y-auto custom-scrollbar">
        <div class="p-6 space-y-5">
          {#if errors.submit}
            <div class="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <svg class="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
              </svg>
              <div class="flex-1">
                <h4 class="text-sm font-semibold text-red-800">Error Adding {capitalizedItemType}</h4>
                <p class="text-sm text-red-700 mt-1">{errors.submit}</p>
              </div>
            </div>
          {/if}

          <!-- Book-only mode (journal toggle removed) -->

          <!-- Basic Information -->
          <div class="bg-[#f8faf9] border border-[#4A7C59]/20 rounded-xl p-4 sm:p-5">
            <div class="flex items-center gap-2 mb-4">
              <svg class="h-5 w-5 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <h4 class="text-base sm:text-lg font-semibold text-[#0D5C29]">Basic Information</h4>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="md:col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  Book Title
                  <span class="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  bind:value={formData.title} 
                  disabled={isSubmitting || uploadingCoverImage}
                  class="w-full px-3 sm:px-4 py-2.5 border {errors.title ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'} rounded-lg focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-50 text-sm sm:text-base" 
                  placeholder="e.g., Introduction to Algorithms" 
                />
                {#if errors.title}
                  <p class="text-red-600 text-xs mt-1.5 flex items-center gap-1">
                    <svg class="h-3 w-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    {errors.title}
                  </p>
                {/if}
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  Author Last Name
                  <span class="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  bind:value={formData.author}
                  on:input={() => handleInputChange('author', formData.author)}
                  disabled={isSubmitting || uploadingCoverImage}
                  class="w-full px-3 sm:px-4 py-2.5 border {errors.author ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'} rounded-lg focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-50 text-sm sm:text-base" 
                  placeholder="e.g., Smith" 
                />
                <p class="text-xs text-gray-500 mt-1.5">Used for call number generation</p>
                {#if errors.author}
                  <p class="text-red-600 text-xs mt-1.5 flex items-center gap-1">
                    <svg class="h-3 w-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    {errors.author}
                  </p>
                {/if}
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  Category <span class="text-red-500">*</span>
                </label>
                <select 
                  bind:value={formData.categoryId}
                  on:change={() => handleInputChange('categoryId', formData.categoryId)}
                  disabled={isSubmitting || uploadingCoverImage || categoriesLoading}
                  class="w-full px-3 sm:px-4 py-2.5 border {errors.category ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'} rounded-lg focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-50 text-sm sm:text-base"
                >
                  <option value="">Select a category</option>
                  {#if categoriesLoading}
                    <option value="" disabled>Loading categories...</option>
                  {:else}
                    {#each categories as category}
                      <option value={category.id}>{category.name}</option>
                    {/each}
                  {/if}
                </select>
                {#if errors.category}
                  <p class="text-red-600 text-xs mt-1.5 flex items-center gap-1">
                    <svg class="h-3 w-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    {errors.category}
                  </p>
                {/if}
              </div>
            </div>
          </div>

          <!-- serial fields removed; component is book-only -->

          <!-- Publication Details -->
          <div class="bg-[#f8faf9] border border-[#4A7C59]/20 rounded-xl p-4 sm:p-5">
            <div class="flex items-center gap-2 mb-4">
              <svg class="h-5 w-5 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <h4 class="text-base sm:text-lg font-semibold text-[#0D5C29]">Publication Details</h4>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  Publisher <span class="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  bind:value={formData.publisher} 
                  disabled={isSubmitting || uploadingCoverImage}
                  class="w-full px-3 sm:px-4 py-2.5 border {errors.publisher ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'} rounded-lg focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-50 text-sm sm:text-base" 
                  placeholder="e.g., Penguin Books" 
                />
                {#if errors.publisher}
                  <p class="text-red-600 text-xs mt-1.5 flex items-center gap-1">
                    <svg class="h-3 w-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    {errors.publisher}
                  </p>
                {/if}
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  Published Year <span class="text-red-500">*</span>
                </label>
                <input 
                  type="number" 
                  bind:value={formData.publishedYear}
                  on:input={() => handleInputChange('publishedYear', formData.publishedYear)}
                  disabled={isSubmitting || uploadingCoverImage}
                  min="1000"
                  max={new Date().getFullYear()}
                  class="w-full px-3 sm:px-4 py-2.5 border {errors.publishedYear ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'} rounded-lg focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-50 text-sm sm:text-base" 
                  placeholder={new Date().getFullYear().toString()} 
                />
                {#if errors.publishedYear}
                  <p class="text-red-600 text-xs mt-1.5 flex items-center gap-1">
                    <svg class="h-3 w-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    {errors.publishedYear}
                  </p>
                {/if}
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  ISBN
                </label>
                <input 
                  type="text" 
                  bind:value={formData.isbn} 
                  disabled={isSubmitting || uploadingCoverImage}
                  class="w-full px-3 sm:px-4 py-2.5 border border-gray-300 bg-white rounded-lg focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-50 text-sm sm:text-base" 
                  placeholder="e.g., 978-0-123456-78-9" 
                />
              </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Edition</label>
                  <input 
                    type="text" 
                    bind:value={formData.edition} 
                    disabled={isSubmitting || uploadingCoverImage}
                    class="w-full px-3 sm:px-4 py-2.5 border border-gray-300 bg-white rounded-lg focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-50 text-sm sm:text-base" 
                    placeholder="e.g., 2nd edition" 
                  />
                </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Language</label>
                <select 
                  bind:value={formData.language} 
                  disabled={isSubmitting || uploadingCoverImage}
                  class="w-full px-3 sm:px-4 py-2.5 border border-gray-300 bg-white rounded-lg focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-50 text-sm sm:text-base"
                >
                  {#each languages as lang}
                    <option value={lang}>{lang}</option>
                  {/each}
                </select>
              </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Pages</label>
                  <input 
                    type="number" 
                    bind:value={formData.pages} 
                    disabled={isSubmitting || uploadingCoverImage}
                    min="1"
                    class="w-full px-3 sm:px-4 py-2.5 border border-gray-300 bg-white rounded-lg focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-50 text-sm sm:text-base" 
                    placeholder="e.g., 350" 
                  />
                </div>
            </div>
          </div>

          <!-- Library Management -->
          <div class="bg-[#f8faf9] border border-[#4A7C59]/20 rounded-xl p-4 sm:p-5">
            <div class="flex items-center gap-2 mb-4">
              <svg class="h-5 w-5 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
              </svg>
              <h4 class="text-base sm:text-lg font-semibold text-[#0D5C29]">Library Management</h4>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Book ID</label>
                <div class="relative">
                  <input 
                    type="text" 
                    bind:value={formData.bookId} 
                    disabled={isSubmitting || uploadingCoverImage}
                    class="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-50 bg-white text-sm sm:text-base pr-10" 
                    placeholder="Auto-generated" 
                  />
                  {#if generatingCallNumber}
                    <div class="absolute right-3 top-1/2 -translate-y-1/2">
                      <svg class="animate-spin h-4 w-4 text-[#4A7C59]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  {/if}
                </div>
                <p class="text-xs text-gray-500 mt-1.5">Unique identifier - auto-generated, editable</p>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Total Copies</label>
                <input 
                  type="number" 
                  bind:value={formData.totalCopies}
                  disabled={isSubmitting || uploadingCoverImage}
                  class="w-full px-3 sm:px-4 py-2.5 border {errors.totalCopies ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'} rounded-lg focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-50 text-sm sm:text-base" 
                  min="1" 
                  placeholder="1" 
                />
                {#if errors.totalCopies}
                  <p class="text-red-600 text-xs mt-1.5 flex items-center gap-1">
                    <svg class="h-3 w-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    {errors.totalCopies}
                  </p>
                {/if}
              </div>
              
              <div class="md:col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Call Number (Shelf Location)</label>
                <textarea
                  bind:value={formData.location} 
                  disabled={isSubmitting}
                  rows="3"
                  class="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-50 bg-white text-sm sm:text-base font-mono resize-none" 
                  placeholder="823 S66\n2023" 
                ></textarea>
                <p class="text-xs text-gray-500 mt-1.5">
                  Multi-line call number (DDC + Cutter, Year) - auto-generated
                </p>
              </div>
            </div>
          </div>

          <!-- Description & Cover -->
          <div class="bg-[#f8faf9] border border-[#4A7C59]/20 rounded-xl p-4 sm:p-5">
            <div class="flex items-center gap-2 mb-4">
              <svg class="h-5 w-5 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h7"/>
              </svg>
              <h4 class="text-base sm:text-lg font-semibold text-[#0D5C29]">Description & Cover</h4>
            </div>
            
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">
                  Book Description
                </label>
                <textarea 
                  bind:value={formData.description} 
                  rows="4" 
                  disabled={isSubmitting || uploadingCoverImage}
                  maxlength="500"
                  class="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-50 bg-white resize-none text-sm sm:text-base" 
                  placeholder="Brief description of the book content, plot summary, key topics covered..."
                ></textarea>
                <p class="text-xs text-gray-500 mt-1.5">{formData.description.length}/500 characters</p>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Cover Photo</label>
                
                  {#if coverImagePreview}
                  <div class="relative mb-4">
                    <div class="relative inline-block">
                      <img 
                        src={coverImagePreview} 
                        alt="Cover preview" 
                        class="h-48 w-32 object-cover rounded-lg border border-gray-300 shadow-md"
                      />
                      <button
                        type="button"
                        on:click={removeCoverImage}
                        disabled={uploadingCoverImage || isSubmitting}
                        class="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors duration-200 disabled:opacity-50"
                      >
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                    <div class="ml-4 inline-block">
                      <p class="text-sm font-medium text-gray-700">{coverImageFile?.name}</p>
                      <p class="text-xs text-gray-500 mt-1">{(coverImageFile?.size || 0) / (1024 * 1024) > 0 ? ((coverImageFile?.size || 0) / (1024 * 1024)).toFixed(2) : '0'} MB</p>
                    </div>
                  </div>
                {:else}
                  <div class="flex items-center">
                    <label for="cover-image-input" class="flex-1">
                      <div class="flex items-center justify-center w-full px-3 sm:px-4 py-8 border-2 border-dashed border-[#4A7C59]/30 rounded-lg cursor-pointer hover:border-[#E8B923] hover:bg-[#E8B923]/5 transition-all duration-200 {errors.coverImage ? 'border-red-300 bg-red-50' : 'bg-white'}">
                        <div class="text-center">
                          <svg class="mx-auto h-8 w-8 text-[#4A7C59] mb-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                          </svg>
                          <p class="text-sm font-medium text-gray-700">Click to upload or drag and drop</p>
                          <p class="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 5MB</p>
                        </div>
                      </div>
                    </label>
                    <input 
                      id="cover-image-input"
                      type="file" 
                      accept="image/*" 
                      on:change={handleCoverImageChange}
                      disabled={isSubmitting || uploadingCoverImage}
                      class="hidden"
                    />
                  </div>
                {/if}
                
                {#if errors.coverImage}
                  <p class="text-red-600 text-xs mt-1.5 flex items-center gap-1">
                    <svg class="h-3 w-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    {errors.coverImage}
                  </p>
                {/if}
              </div>
            </div>
          </div>
        </div>
      </form>
      
      <!-- Footer -->
      <div class="px-6 py-4 border-t border-[#4A7C59]/20 bg-white/80 flex flex-col sm:flex-row-reverse gap-3 flex-shrink-0">
        <button 
          type="submit"
          on:click={handleSubmit}
          disabled={isSubmitting || uploadingCoverImage}
          class="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg bg-gradient-to-r from-[#0D5C29] to-[#4A7C59] text-sm sm:text-base font-semibold text-white hover:from-[#0A4520] hover:to-[#3D664A] shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {#if isSubmitting}
            <svg class="animate-spin h-4 w-4 sm:h-5 sm:w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Adding {capitalizedItemType}...
          {:else if uploadingCoverImage}
            <svg class="animate-spin h-4 w-4 sm:h-5 sm:w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Uploading Cover...
          {:else}
            <svg class="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Add {capitalizedItemType}
          {/if}
        </button>
        <button 
          type="button" 
          on:click={handleClose} 
          disabled={isSubmitting || uploadingCoverImage}
          class="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg border border-gray-300 bg-white text-sm sm:text-base font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(74, 124, 89, 0.3);
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(74, 124, 89, 0.5);
  }
</style>