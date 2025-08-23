<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';

  export let isOpen: boolean = false;

  const dispatch = createEventDispatcher();

  let formData = {
    title: '',
    author: '',
    isbn: '',
    category: '',
    publisher: '',
    publishedYear: '',
    edition: '',
    pages: '',
    language: 'English',
    copiesAvailable: 1,
    location: '',
    description: '',
    tags: '',
    price: '',
    supplier: ''
  };

  let errors: {[key: string]: string} = {};
  let isSubmitting = false;

  // Fetch categories from API
  let categories: string[] = [];
  let categoriesLoading = false;

  // Always fetch categories when modal opens
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
        categories = data.data.categories.map((cat: { name: string }) => cat.name);
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

  function validateForm() {
    const newErrors: {[key: string]: string} = {};
    
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.author.trim()) newErrors.author = 'Author is required';
    if (!formData.isbn.trim()) {
      newErrors.isbn = 'ISBN is required';
    } else if (!/^(?:ISBN(?:-1[03])?:? )?(?=[0-9X]{10}$|(?=(?:[0-9]+[- ]){3})[- 0-9X]{13}$|97[89][0-9]{10}$|(?=(?:[0-9]+[- ]){4})[- 0-9]{17}$)(?:97[89][- ]?)?[0-9]{1,5}[- ]?[0-9]+[- ]?[0-9]+[- ]?[0-9X]$/.test(formData.isbn.replace(/[- ]/g, ''))) {
      newErrors.isbn = 'Please enter a valid ISBN';
    }
    
    if (!formData.category) newErrors.category = 'Category is required';
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
    
    if (formData.copiesAvailable < 1) newErrors.copiesAvailable = 'Number of copies must be at least 1';
    if (formData.pages && parseInt(formData.pages) < 1) newErrors.pages = 'Number of pages must be positive';
    if (formData.price && parseFloat(formData.price) < 0) newErrors.price = 'Price cannot be negative';
    
    errors = newErrors;
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!validateForm()) return;
    
    isSubmitting = true;
    
    try {
      // Transform data to match your API expectations
      const bookData = {
        title: formData.title.trim(),
        author: formData.author.trim(),
        isbn: formData.isbn.trim(),
        publishedYear: parseInt(formData.publishedYear),
        copiesAvailable: parseInt(formData.copiesAvailable.toString()),
        category: formData.category,
        publisher: formData.publisher.trim(),
        edition: formData.edition.trim() || null,
        pages: formData.pages ? parseInt(formData.pages) : null,
        language: formData.language,
        location: formData.location.trim() || null,
        description: formData.description.trim() || null,
        tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
        price: formData.price ? parseFloat(formData.price) : null,
        supplier: formData.supplier.trim() || null,
        dateAdded: new Date().toISOString(),
      };

      // Make API call
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
        // Dispatch success event with the created book data
        dispatch('success', { book: data.data.book, message: data.message });
        handleClose();
      } else {
        // Handle API errors
        if (response.status === 401) {
          dispatch('error', { message: 'Authentication required. Please log in again.' });
        } else if (response.status === 403) {
          dispatch('error', { message: 'You do not have permission to add books.' });
        } else if (response.status === 409) {
          errors.isbn = data.message || 'A book with this ISBN already exists';
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
    // Reset form
    formData = {
      title: '',
      author: '',
      isbn: '',
      category: '',
      publisher: '',
      publishedYear: '',
      edition: '',
      pages: '',
      language: 'English',
      copiesAvailable: 1,
      location: '',
      description: '',
      tags: '',
      price: '',
      supplier: ''
    };
    errors = {};
    isSubmitting = false;
    dispatch('close');
  }

  function handleISBNScan() {
    alert('ISBN Scanner feature coming soon!');
  }

  // Close modal on Escape key
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isOpen && !isSubmitting) {
      handleClose();
    }
  }
</script>

{#if isOpen}
  <!-- Modal Backdrop with Blur Effect -->
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Blurred Background Overlay -->
    <div 
      class="fixed inset-0 bg-black/50 backdrop-blur-sm transition-all duration-300" 
      on:click={isSubmitting ? null : handleClose}
      role="button"
      tabindex="-1"
    ></div>
    
    <!-- Modal Container -->
    <div class="relative w-full max-w-4xl max-h-[90vh] transform transition-all duration-300 scale-100">
      <!-- Modal Panel - Floating Card -->
      <div class="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200/50 overflow-hidden">
        <form on:submit={handleSubmit}>
          <!-- Header -->
          <div class="px-6 py-4 border-b border-slate-200/50 bg-white/80">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <div class="flex items-center justify-center h-10 w-10 rounded-xl bg-slate-900 shadow-lg">
                  <svg class="h-5 w-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                  </svg>
                </div>
                <div>
                  <h3 class="text-xl font-bold text-slate-900">Add New Book</h3>
                  <p class="text-sm text-slate-600">Enter the book details to add it to the library collection</p>
                </div>
              </div>
              <button 
                type="button" 
                on:click={handleClose} 
                disabled={isSubmitting}
                class="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100/50 transition-colors duration-200 disabled:opacity-50"
              >
                <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
          
          <!-- Form Content with Scroll -->
          <div class="px-6 py-6 max-h-[60vh] overflow-y-auto">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <!-- Basic Information -->
              <div class="space-y-6">
                <div class="flex items-center space-x-2 mb-4">
                  <div class="h-1 w-8 bg-slate-900 rounded-full"></div>
                  <h4 class="text-lg font-semibold text-slate-900">Basic Information</h4>
                </div>
                
                <!-- Title -->
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-2">Title *</label>
                  <input 
                    type="text" 
                    bind:value={formData.title} 
                    disabled={isSubmitting}
                    class="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 disabled:opacity-50 disabled:bg-slate-100 {errors.title ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white/50'}" 
                    placeholder="Enter book title" 
                  />
                  {#if errors.title}<p class="text-red-600 text-xs mt-1 flex items-center"><svg class="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>{errors.title}</p>{/if}
                </div>
                
                <!-- Author -->
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-2">Author *</label>
                  <input 
                    type="text" 
                    bind:value={formData.author} 
                    disabled={isSubmitting}
                    class="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 disabled:opacity-50 disabled:bg-slate-100 {errors.author ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white/50'}" 
                    placeholder="Enter author name" 
                  />
                  {#if errors.author}<p class="text-red-600 text-xs mt-1 flex items-center"><svg class="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>{errors.author}</p>{/if}
                </div>
                
                <!-- ISBN -->
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-2">ISBN *</label>
                  <div class="flex">
                    <input 
                      type="text" 
                      bind:value={formData.isbn} 
                      disabled={isSubmitting}
                      class="flex-1 px-4 py-3 border rounded-l-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 disabled:opacity-50 disabled:bg-slate-100 {errors.isbn ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white/50'}" 
                      placeholder="978-0-123456-78-9" 
                    />
                    <button 
                      type="button" 
                      on:click={handleISBNScan} 
                      disabled={isSubmitting}
                      class="px-4 py-3 border border-l-0 border-slate-300 rounded-r-xl hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all duration-200 disabled:opacity-50 disabled:bg-slate-100 bg-white/50"
                      title="Scan ISBN"
                    >
                      <svg class="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <rect x="3" y="3" width="7" height="7" rx="1.5"/>
                        <rect x="14" y="3" width="7" height="7" rx="1.5"/>
                        <rect x="14" y="14" width="7" height="7" rx="1.5"/>
                        <rect x="3" y="14" width="7" height="7" rx="1.5"/>
                      </svg>
                    </button>
                  </div>
                  {#if errors.isbn}<p class="text-red-600 text-xs mt-1 flex items-center"><svg class="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>{errors.isbn}</p>{/if}
                </div>
                
                <!-- Category -->
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-2">Category *</label>
                  <select 
                    bind:value={formData.category} 
                    disabled={isSubmitting || categoriesLoading}
                    class="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 disabled:opacity-50 disabled:bg-slate-100 {errors.category ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white/50'}"
                  >
                    <option value="">Select a category</option>
                    {#if categoriesLoading}
                      <option disabled>Loading categories...</option>
                    {:else}
                      {#each categories as category}
                        <option value={category}>{category}</option>
                      {/each}
                    {/if}
                  </select>
                  {#if errors.category}<p class="text-red-600 text-xs mt-1 flex items-center"><svg class="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>{errors.category}</p>{/if}
                </div>
                
                <!-- Publisher -->
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-2">Publisher *</label>
                  <input 
                    type="text" 
                    bind:value={formData.publisher} 
                    disabled={isSubmitting}
                    class="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 disabled:opacity-50 disabled:bg-slate-100 {errors.publisher ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white/50'}" 
                    placeholder="Enter publisher name" 
                  />
                  {#if errors.publisher}<p class="text-red-600 text-xs mt-1 flex items-center"><svg class="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>{errors.publisher}</p>{/if}
                </div>
                
                <!-- Published Year and Edition -->
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-slate-700 mb-2">Published Year *</label>
                    <input 
                      type="number" 
                      bind:value={formData.publishedYear} 
                      disabled={isSubmitting}
                      class="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 disabled:opacity-50 disabled:bg-slate-100 {errors.publishedYear ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white/50'}" 
                      placeholder="2024" 
                      min="1000" 
                      max={new Date().getFullYear()} 
                    />
                    {#if errors.publishedYear}<p class="text-red-600 text-xs mt-1 flex items-center"><svg class="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>{errors.publishedYear}</p>{/if}
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-slate-700 mb-2">Edition</label>
                    <input 
                      type="text" 
                      bind:value={formData.edition} 
                      disabled={isSubmitting}
                      class="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 disabled:opacity-50 disabled:bg-slate-100 bg-white/50" 
                      placeholder="1st, 2nd, etc." 
                    />
                  </div>
                </div>
              </div>
              
              <!-- Additional Details -->
              <div class="space-y-6">
                <div class="flex items-center space-x-2 mb-4">
                  <div class="h-1 w-8 bg-slate-600 rounded-full"></div>
                  <h4 class="text-lg font-semibold text-slate-900">Additional Details</h4>
                </div>
                
                <!-- Language and Pages -->
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-slate-700 mb-2">Language</label>
                    <select 
                      bind:value={formData.language} 
                      disabled={isSubmitting}
                      class="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 disabled:opacity-50 disabled:bg-slate-100 bg-white/50"
                    >
                      {#each languages as language}
                        <option value={language}>{language}</option>
                      {/each}
                    </select>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-slate-700 mb-2">Pages</label>
                    <input 
                      type="number" 
                      bind:value={formData.pages} 
                      disabled={isSubmitting}
                      class="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 disabled:opacity-50 disabled:bg-slate-100 {errors.pages ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white/50'}" 
                      placeholder="Number of pages" 
                      min="1" 
                    />
                    {#if errors.pages}<p class="text-red-600 text-xs mt-1 flex items-center"><svg class="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>{errors.pages}</p>{/if}
                  </div>
                </div>
                
                <!-- Number of Copies -->
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-2">Number of Copies *</label>
                  <input 
                    type="number" 
                    bind:value={formData.copiesAvailable} 
                    disabled={isSubmitting}
                    class="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 disabled:opacity-50 disabled:bg-slate-100 {errors.copiesAvailable ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white/50'}" 
                    min="1" 
                    placeholder="1" 
                  />
                  {#if errors.copiesAvailable}<p class="text-red-600 text-xs mt-1 flex items-center"><svg class="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>{errors.copiesAvailable}</p>{/if}
                </div>
                
                <!-- Location -->
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-2">Location/Shelf</label>
                  <input 
                    type="text" 
                    bind:value={formData.location} 
                    disabled={isSubmitting}
                    class="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 disabled:opacity-50 disabled:bg-slate-100 bg-white/50" 
                    placeholder="e.g., A1-B2, Section 3" 
                  />
                </div>
                
                <!-- Price and Supplier -->
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-slate-700 mb-2">Price (₱)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      bind:value={formData.price} 
                      disabled={isSubmitting}
                      class="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 disabled:opacity-50 disabled:bg-slate-100 {errors.price ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white/50'}" 
                      placeholder="0.00" 
                      min="0" 
                    />
                    {#if errors.price}<p class="text-red-600 text-xs mt-1 flex items-center"><svg class="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>{errors.price}</p>{/if}
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-slate-700 mb-2">Supplier</label>
                    <input 
                      type="text" 
                      bind:value={formData.supplier} 
                      disabled={isSubmitting}
                      class="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 disabled:opacity-50 disabled:bg-slate-100 bg-white/50" 
                      placeholder="Book supplier" 
                    />
                  </div>
                </div>
                
                <!-- Tags -->
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-2">Tags</label>
                  <input 
                    type="text" 
                    bind:value={formData.tags} 
                    disabled={isSubmitting}
                    class="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 disabled:opacity-50 disabled:bg-slate-100 bg-white/50" 
                    placeholder="programming, computer science, beginner (comma separated)" 
                  />
                  <p class="text-xs text-slate-500 mt-1">Separate tags with commas</p>
                </div>
                
                <!-- Description -->
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-2">Description</label>
                  <textarea 
                    bind:value={formData.description} 
                    rows="4" 
                    disabled={isSubmitting}
                    class="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all duration-200 disabled:opacity-50 disabled:bg-slate-100 bg-white/50 resize-none" 
                    placeholder="Brief description of the book content..."
                  ></textarea>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Footer -->
          <div class="px-6 py-4 border-t border-slate-200/50 bg-white/80 flex flex-col sm:flex-row-reverse gap-3">
            <button 
              type="submit" 
              disabled={isSubmitting}
              class="flex-1 sm:flex-initial sm:min-w-[120px] inline-flex justify-center items-center rounded-xl border border-transparent shadow-lg px-6 py-3 bg-slate-900 text-base font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-900"
            >
              {#if isSubmitting}
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Adding Book...
              {:else}
                <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                </svg>
                Add Book
              {/if}
            </button>
            <button 
              type="button" 
              on:click={handleClose} 
              disabled={isSubmitting}
              class="flex-1 sm:flex-initial sm:min-w-[120px] inline-flex justify-center items-center rounded-xl border border-slate-300 shadow-sm px-6 py-3 bg-white/80 text-base font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
  /* Custom scrollbar for webkit browsers */
  .overflow-y-auto::-webkit-scrollbar {
    width: 6px;
  }
  
  .overflow-y-auto::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 10px;
  }
  
  .overflow-y-auto::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 10px;
  }
  
  .overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.3);
  }
</style>