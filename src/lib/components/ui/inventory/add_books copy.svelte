<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';

  export let isOpen: boolean = false;
  // itemType allows this component to be reused for magazines, books, etc.
  export let itemType: string = 'book';

  $: capitalizedItemType = itemType && itemType.length ? itemType.charAt(0).toUpperCase() + itemType.slice(1) : 'Item';

  const dispatch = createEventDispatcher();
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
    coverImage: ''
  };
  let errors: {[key: string]: string} = {};
  let isSubmitting = false;
  let coverImageFile: File | null = null;
  let coverImagePreview: string = '';
  let uploadingCoverImage = false;

  // Fetch categories from API
  let categories: { id: number, name: string }[] = [];
  let categoriesLoading = false;

  $: if (isOpen) {
    fetchCategories();
  }

  async function fetchCategories() {
    categoriesLoading = true;
    try {
      const response = await fetch('/api/books/categories', {
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
  function handleInputChange(field: string, value: string | number) {
    formData = { ...formData, [field]: value };
    if (errors[field]) {
      errors = { ...errors, [field]: '' };
    }
  }

  function handleCoverImageChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        errors.coverImage = 'Please select an image file';
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        errors.coverImage = 'Image size must be less than 5MB';
        return;
      }
      
      coverImageFile = file;
      // Create preview
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
      // Create form data for server-side upload
      const formData = new FormData();
      formData.append('file', coverImageFile);
      formData.append('itemId', '0'); // Will be set after book creation
      formData.append('itemType', itemType || 'book');
      const uploadResponse = await fetch('/api/images/upload/', {
        method: 'POST',
        credentials: 'include',
        body: formData
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
    if (!formData.bookId.trim()) {
      newErrors.bookId = 'Book ID is required';
    } else if (!/^[A-Z0-9.\-]+$/i.test(formData.bookId.trim())) {
      newErrors.bookId = 'Book ID must be alphanumeric and may include dots or dashes';
    }
    if (formData.isbn.trim() && !/^[0-9\-]+$/.test(formData.isbn.trim())) {
      newErrors.isbn = 'ISBN must contain only numbers and dashes';
    }
    if (formData.pages && (isNaN(parseInt(formData.pages)) || parseInt(formData.pages) < 1)) {
      newErrors.pages = 'Pages must be a positive number';
    }
    if (formData.totalCopies < 1) newErrors.totalCopies = 'Number of copies must be at least 1';
    errors = newErrors;
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!validateForm()) return;
    isSubmitting = true;
    try {
      // Upload cover image if provided
      let coverImageUrl = '';
      if (coverImageFile) {
        const uploadedUrl = await uploadCoverImageToBackblaze();
        if (!uploadedUrl) {
          isSubmitting = false;
          return;
          // Error already set in uploadCoverImageToBackblaze
        }
        coverImageUrl = uploadedUrl;
      }

      const bookData = {
        bookId: formData.bookId.trim(),
        title: formData.title.trim(),
        author: formData.author.trim(),
        isbn: formData.isbn.trim() || null,
        publisher: formData.publisher.trim(),
        publishedYear: parseInt(formData.publishedYear),
        edition: formData.edition.trim() || null,
        language: formData.language,
        pages: formData.pages ? parseInt(formData.pages) : null,
        categoryId: parseInt(formData.categoryId),
        location: formData.location.trim() || null,
        totalCopies: parseInt(formData.totalCopies.toString()),
        description: formData.description.trim() || null,
        coverImage: coverImageUrl || null
      };
      const response = await fetch('/api/books', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookData)
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        dispatch('success', { book: data.data.book, message: data.message });
        handleClose();
      } else {
        if (response.status === 401) {
          dispatch('error', { message: 'Authentication required. Please log in again.' });
        } else if (response.status === 403) {
          dispatch('error', { message: 'You do not have permission to add books.' });
        } else if (response.status === 409) {
          errors.bookId = data.message || 'A book with this Book ID already exists';
        } else {
          dispatch('error', { message: data.message || 'Failed to add book' });
        }
      }
    } catch (error) {
      console.error('Error adding book:', error);
      dispatch('error', { message: 'Network error. Please check your connection and try again.' });
    } finally {
      isSubmitting = false;
    }
  }

  function handleClose() {
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
      coverImage: ''
    };
    coverImageFile = null;
    coverImagePreview = '';
    errors = {};
    isSubmitting = false;
    dispatch('close');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isOpen && !isSubmitting) {
      handleClose();
    }
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div 
      class="fixed inset-0 bg-black/50 backdrop-blur-sm transition-all duration-300" 
      on:click={isSubmitting ? null : handleClose}
      role="button"
      tabindex="-1"
    ></div>
    
    <div class="relative w-full max-w-5xl max-h-[90vh] transform transition-all duration-300 scale-100">
      <div class="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-[#4A7C59]/30 overflow-hidden flex flex-col max-h-[90vh]">
        <form on:submit={handleSubmit} class="flex flex-col h-full">
          <div class="px-6 py-4 border-b border-[#4A7C59]/20 bg-white/80 flex-shrink-0">
            <div class="flex items-start sm:items-center justify-between gap-3">
              <div class="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                <div class="flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-[#0D5C29] to-[#4A7C59] shadow-lg flex-shrink-0">
                  <svg class="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                  </svg>
                </div>
      
                <div class="min-w-0 flex-1">
                  <h3 class="text-lg sm:text-xl font-bold text-[#0D5C29] truncate">Add New {capitalizedItemType}</h3>
                  <p class="text-xs sm:text-sm text-[#4A7C59] hidden sm:block">Enter the {itemType} details to add it to the library collection</p>
                </div>
              </div>
              <button 
                type="button" 
                on:click={handleClose} 
                disabled={isSubmitting}
                class="p-2 rounded-lg text-gray-400 hover:text-[#0D5C29] hover:bg-[#0D5C29]/10 transition-colors duration-200 disabled:opacity-50 flex-shrink-0"
               >
                <svg class="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
          
          <div class="px-6 py-6 max-h-[60vh] overflow-y-auto flex-1 custom-scrollbar">
            <div class="space-y-6">
              <div class="bg-[#f8faf9] border border-[#4A7C59]/20 rounded-xl p-4 sm:p-5">
                <div class="flex items-center gap-2 mb-4">
                  <svg class="h-5 w-5 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <h4 class="text-base sm:text-lg font-semibold text-[#0D5C29]">Basic Information</h4>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
                    <input 
                      type="text" 
                      bind:value={formData.title} 
                      disabled={isSubmitting}
                      class="w-full px-3 sm:px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-50 text-sm sm:text-base {errors.title ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'}" 
                      placeholder="Enter book title" 
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
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Author *</label>
                    <input 
                      type="text" 
                      bind:value={formData.author} 
                      disabled={isSubmitting}
                      class="w-full px-3 sm:px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-50 text-sm sm:text-base {errors.author ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'}" 
                      placeholder="Enter author name" 
                    />
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
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Book ID *</label>
                    <input 
                      type="text" 
                      bind:value={formData.bookId} 
                      disabled={isSubmitting}
                      class="w-full px-3 sm:px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-50 text-sm sm:text-base {errors.bookId ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'}" 
                      placeholder="e.g., FIC-PBS-2002" 
                    />
                    {#if errors.bookId}
                      <p class="text-red-600 text-xs mt-1.5 flex items-center gap-1">
                         <svg class="h-3 w-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                        </svg>
                        {errors.bookId}
                      </p>
                    {/if}
                  </div>
                  
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Category *</label>
                    <select 
                      bind:value={formData.categoryId} 
                      disabled={isSubmitting || categoriesLoading}
                      class="w-full px-3 sm:px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-50 text-sm sm:text-base {errors.category ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'}"
                    >
                      <option value="">Select a category</option>
                      {#if categoriesLoading}
                        <option disabled>Loading categories...</option>
                      {:else}
                        {#each categories as cat}
                           <option value={cat.id}>{cat.name}</option>
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
                  
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Publisher *</label>
                    <input 
                      type="text" 
                      bind:value={formData.publisher} 
                      disabled={isSubmitting}
                      class="w-full px-3 sm:px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-50 text-sm sm:text-base {errors.publisher ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'}" 
                      placeholder="Enter publisher name" 
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
                </div>
              </div>

              <div class="bg-[#f8faf9] border border-[#4A7C59]/20 rounded-xl p-4 sm:p-5">
                <div class="flex items-center gap-2 mb-4">
                  <svg class="h-5 w-5 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  <h4 class="text-base sm:text-lg font-semibold text-[#0D5C29]">Additional Details</h4>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Published Year *</label>
                    <input 
                      type="number" 
                      bind:value={formData.publishedYear} 
                      disabled={isSubmitting}
                      class="w-full px-3 sm:px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-50 text-sm sm:text-base {errors.publishedYear ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'}" 
                      placeholder="2024" 
                      min="1000" 
                      max={new Date().getFullYear()} 
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
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Language</label>
                    <select 
                      bind:value={formData.language} 
                      disabled={isSubmitting}
                      class="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-50 bg-white text-sm sm:text-base"
                    >
                      {#each languages as language}
                        <option value={language}>{language}</option>
                      {/each}
                    </select>
                  </div>
                  
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">ISBN</label>
                    <input 
                      type="text" 
                      bind:value={formData.isbn} 
                      disabled={isSubmitting}
                      class="w-full px-3 sm:px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-50 text-sm sm:text-base {errors.isbn ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'}" 
                      placeholder="e.g., 978-0-1234-5678-9" 
                    />
                    {#if errors.isbn}
                      <p class="text-red-600 text-xs mt-1.5 flex items-center gap-1">
                        <svg class="h-3 w-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                        </svg>
                        {errors.isbn}
                      </p>
                    {/if}
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Edition</label>
                    <input 
                      type="text" 
                      bind:value={formData.edition} 
                      disabled={isSubmitting}
                      class="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-50 bg-white text-sm sm:text-base" 
                      placeholder="e.g., 3rd Edition" 
                    />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Pages</label>
                    <input 
                      type="number" 
                      bind:value={formData.pages} 
                      disabled={isSubmitting}
                      class="w-full px-3 sm:px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-50 text-sm sm:text-base {errors.pages ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'}" 
                      min="1" 
                      placeholder="300" 
                    />
                    {#if errors.pages}
                      <p class="text-red-600 text-xs mt-1.5 flex items-center gap-1">
                        <svg class="h-3 w-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                        </svg>
                        {errors.pages}
                      </p>
                    {/if}
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Number of Copies *</label>
                    <input 
                      type="number" 
                      bind:value={formData.totalCopies} 
                      disabled={isSubmitting}
                      class="w-full px-3 sm:px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-50 text-sm sm:text-base {errors.totalCopies ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'}" 
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
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Location/Shelf</label>
                    <input 
                      type="text" 
                      bind:value={formData.location} 
                      disabled={isSubmitting}
                      class="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-50 bg-white text-sm sm:text-base" 
                      placeholder="e.g., A1-B2, Section 3" 
                    />
                    <p class="text-xs text-gray-500 mt-1.5">Physical location of the book in the library</p>
                  </div>
                </div>
              </div>

              <div class="bg-[#f8faf9] border border-[#4A7C59]/20 rounded-xl p-4 sm:p-5">
                <div class="flex items-center gap-2 mb-4">
                  <svg class="h-5 w-5 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h7"/>
                  </svg>
                  <h4 class="text-base sm:text-lg font-semibold text-[#0D5C29]">Description & Cover</h4>
                </div>
                
                <div class="space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1.5">Book Description</label>
                    <textarea 
                      bind:value={formData.description} 
                      rows="4" 
                      disabled={isSubmitting || uploadingCoverImage}
                      maxlength="500"
                      class="w-full px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 disabled:bg-gray-50 bg-white resize-none text-sm sm:text-base" 
                      placeholder="Brief description of the book content, plot summary, key topics covered, or any other relevant information about the book..."
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
          </div>
          
          <div class="px-6 py-4 border-t border-[#4A7C59]/20 bg-white/80 flex flex-col sm:flex-row-reverse gap-3 flex-shrink-0">
            <button 
              type="button" 
              on:click={handleClose} 
              disabled={isSubmitting}
              class="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg border border-gray-300 bg-white text-sm sm:text-base font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting || uploadingCoverImage}
              class="w-full sm:w-auto sm:ml-auto px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg bg-gradient-to-r from-[#0D5C29] to-[#4A7C59] text-sm sm:text-base font-semibold text-white hover:from-[#0A4520] hover:to-[#3D664A] shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {#if isSubmitting}
                <svg class="animate-spin h-4 w-4 sm:h-5 sm:w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Adding Book...
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
                Add Book
              {/if}
            </button>
          </div>
        </form>
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
    background: rgba(74, 124, 89, 0.3); /* #4A7C59 with opacity */
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(74, 124, 89, 0.5);
  }
</style>