<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';

  interface BookRow {
    id: string;
    title: string;
    author: string;
    bookId: string;
    categoryId: string;
    publisher: string;
    publishedYear: string;
    language: string;
    copiesAvailable: string;
    location: string;
    originPlace: string;
    description: string;
    errors: { [key: string]: string };
    status: 'pending' | 'submitted' | 'success' | 'error';
    message: string;
  }

  // Constants - declare before use
  const defaultLanguage = 'English';
  const languages = ['English', 'Filipino', 'Spanish', 'French', 'German', 'Japanese', 'Chinese', 'Other'];
  const languages_map = languages;

  // State variables
  let rows: BookRow[] = [createEmptyRow()];
  let categories: { id: number; name: string }[] = [];
  let isSubmitting = false;
  let successMessage = '';
  let errorMessage = '';
  let selectedRows = new Set<string>();
  let showPreview = false;

  function createEmptyRow(): BookRow {
    return {
      id: Math.random().toString(36),
      title: '',
      author: '',
      bookId: '',
      categoryId: '',
      publisher: '',
      publishedYear: new Date().getFullYear().toString(),
      language: defaultLanguage,
      copiesAvailable: '1',
      location: '',
      originPlace: '',
      description: '',
      errors: {},
      status: 'pending',
      message: ''
    };
  }

  onMount(async () => {
    await fetchCategories();
  });

  async function fetchCategories() {
    try {
      const response = await fetch('/api/books/categories', {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        categories = data.data.categories;
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  }

  function validateRow(row: BookRow): boolean {
    const errors: { [key: string]: string } = {};

    if (!row.title.trim()) errors.title = 'Required';
    if (!row.author.trim()) errors.author = 'Required';
    if (!row.bookId.trim()) {
      errors.bookId = 'Required';
    } else if (!/^[A-Z0-9\-]+$/i.test(row.bookId.trim())) {
      errors.bookId = 'Alphanumeric only';
    }
    if (!row.categoryId) errors.categoryId = 'Required';
    if (!row.publisher.trim()) errors.publisher = 'Required';
    if (!row.publishedYear) {
      errors.publishedYear = 'Required';
    } else {
      const year = parseInt(row.publishedYear);
      const currentYear = new Date().getFullYear();
      if (year < 1000 || year > currentYear) {
        errors.publishedYear = `1000-${currentYear}`;
      }
    }
    if (!row.copiesAvailable || parseInt(row.copiesAvailable) < 1) {
      errors.copiesAvailable = 'Min 1';
    }

    row.errors = errors;
    return Object.keys(errors).length === 0;
  }

  function addRow() {
    rows = [...rows, createEmptyRow()];
  }

  function deleteRow(id: string) {
    rows = rows.filter(r => r.id !== id);
  }

  function deleteSelectedRows() {
    rows = rows.filter(r => !selectedRows.has(r.id));
    selectedRows.clear();
  }

  function toggleRowSelection(id: string) {
    if (selectedRows.has(id)) {
      selectedRows.delete(id);
    } else {
      selectedRows.add(id);
    }
    selectedRows = new Set(selectedRows);
  }

  function toggleAllRowsSelection() {
    if (selectedRows.size === rows.length && selectedRows.size > 0) {
      selectedRows.clear();
    } else {
      selectedRows = new Set(rows.map(r => r.id));
    }
    selectedRows = new Set(selectedRows);
  }

  function clearAllRows() {
    if (confirm('Are you sure you want to clear all rows?')) {
      rows = [createEmptyRow()];
      selectedRows.clear();
      successMessage = '';
      errorMessage = '';
    }
  }

  async function submitBooks() {
    successMessage = '';
    errorMessage = '';
    let hasErrors = false;

    // Validate all rows
    rows.forEach(row => {
      if (!validateRow(row)) {
        hasErrors = true;
      }
    });

    if (hasErrors) {
      errorMessage = 'Please fix all errors before submitting.';
      return;
    }

    isSubmitting = true;
    let successCount = 0;
    let failureCount = 0;

    for (const row of rows) {
      // Skip empty rows
      if (!row.title.trim() && !row.author.trim() && !row.bookId.trim()) {
        continue;
      }

      row.status = 'submitted';
      row.message = 'Submitting...';

      try {
        const response = await fetch('/api/books', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: row.title.trim(),
            author: row.author.trim(),
            bookId: row.bookId.trim(),
            categoryId: parseInt(row.categoryId),
            publisher: row.publisher.trim(),
            publishedYear: parseInt(row.publishedYear),
            language: row.language,
            copiesAvailable: parseInt(row.copiesAvailable),
            location: row.location.trim(),
            originPlace: row.originPlace.trim(),
            description: row.description.trim()
          })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          row.status = 'success';
          row.message = 'Added successfully';
          successCount++;
        } else {
          row.status = 'error';
          row.message = data.message || 'Failed to add book';
          failureCount++;
        }
      } catch (err) {
        row.status = 'error';
        row.message = 'Network error';
        failureCount++;
      }
    }

    isSubmitting = false;

    if (failureCount === 0) {
      successMessage = `Successfully added ${successCount} book${successCount !== 1 ? 's' : ''}!`;
      setTimeout(() => {
        goto('/dashboard/books?page=1');
      }, 2000);
    } else {
      errorMessage = `Added ${successCount} book${successCount !== 1 ? 's' : ''}, ${failureCount} failed.`;
    }
  }

  function handlePaste(event: ClipboardEvent, rowId: string, field: string) {
    const pastedText = event.clipboardData?.getData('text') || '';
    if (!pastedText.includes('\t') && !pastedText.includes('\n')) {
      return;
    }

    event.preventDefault();

    const lines = pastedText.trim().split('\n');
    const startRowIndex = rows.findIndex(r => r.id === rowId);

    if (startRowIndex === -1) return;

    // Determine field index based on the field parameter
    const fields = ['title', 'author', 'bookId', 'categoryId', 'publisher', 'publishedYear', 'language', 'copiesAvailable', 'location', 'originPlace', 'description'];
    const startFieldIndex = fields.indexOf(field);

    lines.forEach((line, lineIndex) => {
      const values = line.split('\t');
      const rowIndex = startRowIndex + lineIndex;

      // Add new rows if needed
      while (rows.length <= rowIndex) {
        rows = [...rows, createEmptyRow()];
      }

      // Fill in the values
      values.forEach((value, valueIndex) => {
        const fieldIndex = startFieldIndex + valueIndex;
        if (fieldIndex < fields.length) {
          const fieldName = fields[fieldIndex] as keyof BookRow;
          if (fieldName !== 'errors' && fieldName !== 'id' && fieldName !== 'status' && fieldName !== 'message') {
            rows[rowIndex][fieldName] = value.trim();
          }
        }
      });
    });

    rows = rows;
  }

  function exportTemplate() {
    const headers = ['Title', 'Author', 'Book ID', 'Category ID', 'Publisher', 'Year', 'Language', 'Copies', 'Location', 'Origin', 'Description'];
    const csv = headers.join('\t') + '\n';
    
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
    element.setAttribute('download', 'book_template.tsv');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  function getRowStatusIcon(status: string) {
    switch (status) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'submitted':
        return '⟳';
      default:
        return '';
    }
  }

  function getCategoryName(id: string): string {
    const cat = categories.find(c => c.id.toString() === id);
    return cat ? cat.name : '';
  }
</script>

<div class="space-y-4 p-4 lg:p-6">
  <!-- Header -->
  <div>
    <h2 class="text-2xl font-bold text-slate-900">Quick Add Books</h2>
    <p class="text-slate-600">Add multiple books at once using a spreadsheet-like interface</p>
  </div>

  <!-- Action Buttons -->
  <div class="flex flex-wrap gap-2">
    <button
      on:click={addRow}
      disabled={isSubmitting}
      class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 transition-colors"
    >
      + Add Row
    </button>
    <button
      on:click={exportTemplate}
      disabled={isSubmitting}
      class="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:bg-slate-400 transition-colors"
    >
      📥 Download Template
    </button>
    {#if selectedRows.size > 0}
      <button
        on:click={deleteSelectedRows}
        disabled={isSubmitting}
        class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-slate-400 transition-colors"
      >
        Delete Selected ({selectedRows.size})
      </button>
    {/if}
    <button
      on:click={clearAllRows}
      disabled={isSubmitting}
      class="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-slate-400 transition-colors"
    >
      Clear All
    </button>
  </div>

  <!-- Success/Error Messages -->
  {#if successMessage}
    <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg flex justify-between items-center">
      <span>{successMessage}</span>
      <button on:click={() => (successMessage = '')} class="text-xl">×</button>
    </div>
  {/if}

  {#if errorMessage}
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg flex justify-between items-center">
      <span>{errorMessage}</span>
      <button on:click={() => (errorMessage = '')} class="text-xl">×</button>
    </div>
  {/if}

  <!-- Info Box -->
  <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
    <p class="text-sm text-blue-900">
      💡 <strong>Tip:</strong> You can copy and paste data from Excel/Google Sheets. Click on any cell and paste tab-separated values to fill multiple cells at once.
    </p>
  </div>

  <!-- Spreadsheet Table -->
  <div class="bg-white rounded-lg shadow-lg border border-slate-200 overflow-x-auto">
    <table class="w-full border-collapse text-sm">
      <thead>
        <tr class="bg-slate-100 border-b border-slate-300">
          <th class="p-2 text-left w-8">
            <input
              type="checkbox"
              checked={selectedRows.size === rows.length && rows.length > 0}
              on:change={toggleAllRowsSelection}
              class="cursor-pointer"
            />
          </th>
          <th class="p-2 text-left w-8 bg-slate-50">#</th>
          <th class="p-2 text-left min-w-[150px]">Title *</th>
          <th class="p-2 text-left min-w-[120px]">Author *</th>
          <th class="p-2 text-left min-w-[100px]">Book ID *</th>
          <th class="p-2 text-left min-w-[100px]">Category *</th>
          <th class="p-2 text-left min-w-[120px]">Publisher *</th>
          <th class="p-2 text-left min-w-[80px]">Year *</th>
          <th class="p-2 text-left min-w-[100px]">Language</th>
          <th class="p-2 text-left min-w-[80px]">Copies *</th>
          <th class="p-2 text-left min-w-[100px]">Location</th>
          <th class="p-2 text-left min-w-[100px]">Origin</th>
          <th class="p-2 text-left min-w-[120px]">Description</th>
          <th class="p-2 text-center w-12">Status</th>
          <th class="p-2 text-center w-16">Action</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row, index (row.id)}
          <tr class={`border-b border-slate-200 hover:bg-slate-50 transition-colors ${
            row.status === 'success' ? 'bg-green-50' : 
            row.status === 'error' ? 'bg-red-50' : 
            row.status === 'submitted' ? 'bg-blue-50' : ''
          }`}>
            <td class="p-2">
              <input
                type="checkbox"
                checked={selectedRows.has(row.id)}
                on:change={() => toggleRowSelection(row.id)}
                class="cursor-pointer"
              />
            </td>
            <td class="p-2 bg-slate-50 text-slate-500 font-medium">{index + 1}</td>

            <!-- Title -->
            <td class="p-2">
              <input
                type="text"
                bind:value={row.title}
                on:paste={(e) => handlePaste(e, row.id, 'title')}
                placeholder="Enter title"
                class={`w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  row.errors.title ? 'border-red-500 bg-red-50' : 'border-slate-300'
                }`}
              />
              {#if row.errors.title}
                <div class="text-red-600 text-xs mt-1">{row.errors.title}</div>
              {/if}
            </td>

            <!-- Author -->
            <td class="p-2">
              <input
                type="text"
                bind:value={row.author}
                on:paste={(e) => handlePaste(e, row.id, 'author')}
                placeholder="Enter author"
                class={`w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  row.errors.author ? 'border-red-500 bg-red-50' : 'border-slate-300'
                }`}
              />
              {#if row.errors.author}
                <div class="text-red-600 text-xs mt-1">{row.errors.author}</div>
              {/if}
            </td>

            <!-- Book ID -->
            <td class="p-2">
              <input
                type="text"
                bind:value={row.bookId}
                on:paste={(e) => handlePaste(e, row.id, 'bookId')}
                placeholder="e.g., B-001"
                class={`w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  row.errors.bookId ? 'border-red-500 bg-red-50' : 'border-slate-300'
                }`}
              />
              {#if row.errors.bookId}
                <div class="text-red-600 text-xs mt-1">{row.errors.bookId}</div>
              {/if}
            </td>

            <!-- Category -->
            <td class="p-2">
              <select
                bind:value={row.categoryId}
                class={`w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  row.errors.categoryId ? 'border-red-500 bg-red-50' : 'border-slate-300'
                }`}
              >
                <option value="">Select...</option>
                {#each categories as cat}
                  <option value={cat.id}>{cat.name}</option>
                {/each}
              </select>
              {#if row.errors.categoryId}
                <div class="text-red-600 text-xs mt-1">{row.errors.categoryId}</div>
              {/if}
            </td>

            <!-- Publisher -->
            <td class="p-2">
              <input
                type="text"
                bind:value={row.publisher}
                on:paste={(e) => handlePaste(e, row.id, 'publisher')}
                placeholder="Enter publisher"
                class={`w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  row.errors.publisher ? 'border-red-500 bg-red-50' : 'border-slate-300'
                }`}
              />
              {#if row.errors.publisher}
                <div class="text-red-600 text-xs mt-1">{row.errors.publisher}</div>
              {/if}
            </td>

            <!-- Published Year -->
            <td class="p-2">
              <input
                type="number"
                bind:value={row.publishedYear}
                on:paste={(e) => handlePaste(e, row.id, 'publishedYear')}
                placeholder="YYYY"
                min="1000"
                max={new Date().getFullYear()}
                class={`w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  row.errors.publishedYear ? 'border-red-500 bg-red-50' : 'border-slate-300'
                }`}
              />
              {#if row.errors.publishedYear}
                <div class="text-red-600 text-xs mt-1">{row.errors.publishedYear}</div>
              {/if}
            </td>

            <!-- Language -->
            <td class="p-2">
              <select bind:value={row.language} class="w-full px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                {#each languages_map as lang}
                  <option value={lang}>{lang}</option>
                {/each}
              </select>
            </td>

            <!-- Copies Available -->
            <td class="p-2">
              <input
                type="number"
                bind:value={row.copiesAvailable}
                on:paste={(e) => handlePaste(e, row.id, 'copiesAvailable')}
                min="1"
                placeholder="1"
                class={`w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  row.errors.copiesAvailable ? 'border-red-500 bg-red-50' : 'border-slate-300'
                }`}
              />
              {#if row.errors.copiesAvailable}
                <div class="text-red-600 text-xs mt-1">{row.errors.copiesAvailable}</div>
              {/if}
            </td>

            <!-- Location -->
            <td class="p-2">
              <input
                type="text"
                bind:value={row.location}
                on:paste={(e) => handlePaste(e, row.id, 'location')}
                placeholder="Shelf location"
                class="w-full px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </td>

            <!-- Origin Place -->
            <td class="p-2">
              <input
                type="text"
                bind:value={row.originPlace}
                on:paste={(e) => handlePaste(e, row.id, 'originPlace')}
                placeholder="Origin"
                class="w-full px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </td>

            <!-- Description -->
            <td class="p-2">
              <input
                type="text"
                bind:value={row.description}
                on:paste={(e) => handlePaste(e, row.id, 'description')}
                placeholder="Description"
                class="w-full px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </td>

            <!-- Status -->
            <td class="p-2 text-center font-semibold" class:text-green-600={row.status === 'success'} class:text-red-600={row.status === 'error'} class:text-blue-600={row.status === 'submitted'}>
              {getRowStatusIcon(row.status)}
              {#if row.message}
                <div class="text-xs text-slate-600 mt-1">{row.message}</div>
              {/if}
            </td>

            <!-- Delete Button -->
            <td class="p-2 text-center">
              <button
                on:click={() => deleteRow(row.id)}
                disabled={isSubmitting}
                class="text-red-600 hover:text-red-800 disabled:text-slate-400 font-bold"
              >
                ✕
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <!-- Submit Button -->
  <div class="flex gap-2 justify-end">
    <button
      on:click={() => goto('/dashboard/books')}
      disabled={isSubmitting}
      class="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:bg-slate-400 transition-colors"
    >
      Back
    </button>
    <button
      on:click={submitBooks}
      disabled={isSubmitting || rows.every(r => !r.title.trim() && !r.author.trim() && !r.bookId.trim())}
      class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-400 transition-colors font-semibold"
    >
      {#if isSubmitting}
        Submitting...
      {:else}
        Submit All Books
      {/if}
    </button>
  </div>

  <!-- Footer Info -->
  <div class="text-xs text-slate-600 space-y-1">
    <p>* Required fields</p>
    <p>Rows with all empty fields will be skipped during submission.</p>
  </div>
</div>

<style>
  :global(body) {
    overflow-x: auto;
  }
</style>
