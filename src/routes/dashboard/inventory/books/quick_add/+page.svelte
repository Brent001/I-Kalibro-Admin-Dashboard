<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';

  // Interface aligned with tbl_book schema
  interface BookRow {
    id: string;
    title: string;
    author: string;
    bookId: string;
    isbn: string;
    publisher: string;
    publishedYear: string;
    edition: string;
    language: string;
    pages: string;
    categoryId: string;
    location: string;
    totalCopies: string;
    description: string;
    coverImage: string;
    errors: { [key: string]: string };
    status: 'pending' | 'submitted' | 'success' | 'error';
    message: string;
  }

  const defaultLanguage = 'English';
  const languages = ['English', 'Filipino', 'Spanish', 'French', 'German', 'Japanese', 'Chinese', 'Other'];
  
  // Column headers aligned with database schema
  const columnHeaders = [
    { key: 'bookId', label: 'Book ID', required: true, width: 120 },
    { key: 'title', label: 'Title', required: true, width: 200 },
    { key: 'author', label: 'Author', required: true, width: 150 },
    { key: 'isbn', label: 'ISBN', required: false, width: 130 },
    { key: 'categoryId', label: 'Category', required: true, width: 140 },
    { key: 'publisher', label: 'Publisher', required: true, width: 150 },
    { key: 'publishedYear', label: 'Year', required: true, width: 80 },
    { key: 'edition', label: 'Edition', required: false, width: 100 },
    { key: 'language', label: 'Language', required: false, width: 110 },
    { key: 'pages', label: 'Pages', required: false, width: 80 },
    { key: 'totalCopies', label: 'Copies', required: true, width: 80 },
    { key: 'location', label: 'Location', required: false, width: 120 },
    { key: 'description', label: 'Description', required: false, width: 200 },
    { key: 'coverImage', label: 'Cover Photo', required: false, width: 180 }
  ];

  let rows: BookRow[] = Array.from({ length: 30 }, () => createEmptyRow());
  let categories: { id: number; name: string }[] = [];
  let isSubmitting = false;
  let successMessage = '';
  let errorMessage = '';
  let selectedRows = new Set<string>();
  let activeCell: { rowId: string; field: string } | null = null;
  let fileInputs: { [key: string]: HTMLInputElement } = {};
  let uploadingFiles: { [key: string]: boolean } = {};

  async function uploadCoverImage(file: File): Promise<string | null> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'book-cover');

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        return data.data.url || data.data.path;
      } else {
        console.error('Upload failed:', data.message);
        return null;
      }
    } catch (err) {
      console.error('Upload error:', err);
      return null;
    }
  }

  async function handleFileSelect(rowId: string, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        alert('Please select a valid image file (JPG, PNG, GIF, or WebP)');
        return;
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        alert('File size must be less than 5MB');
        return;
      }

      const row = rows.find(r => r.id === rowId);
      if (row) {
        // Show uploading state
        uploadingFiles[rowId] = true;
        uploadingFiles = uploadingFiles;

        // Upload file to server
        const uploadedUrl = await uploadCoverImage(file);
        
        uploadingFiles[rowId] = false;
        uploadingFiles = uploadingFiles;

        if (uploadedUrl) {
          row.coverImage = uploadedUrl;
          rows = rows;
        } else {
          alert('Failed to upload image. Please try again.');
          input.value = ''; // Reset input
        }
      }
    }
  }

  function triggerFileInput(rowId: string) {
    const input = fileInputs[rowId];
    if (input) {
      input.click();
    }
  }

  function clearCoverImage(rowId: string, event: Event) {
    event.stopPropagation();
    const row = rows.find(r => r.id === rowId);
    if (row) {
      row.coverImage = '';
      rows = rows;
      const input = fileInputs[rowId];
      if (input) {
        input.value = '';
      }
    }
  }

  function createEmptyRow(): BookRow {
    return {
      id: Math.random().toString(36),
      bookId: '',
      title: '',
      author: '',
      isbn: '',
      publisher: '',
      publishedYear: '',
      edition: '',
      language: defaultLanguage,
      pages: '',
      categoryId: '',
      location: '',
      totalCopies: '',
      description: '',
      coverImage: '',
      errors: {},
      status: 'pending',
      message: ''
    };
  }

  onMount(() => {
    fetchCategories();
    function handleShortcuts(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        submitBooks();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        addRows(10);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        selectAllRows();
        return;
      }
      if (e.key === 'Delete') {
        if (selectedRows.size > 0) {
          e.preventDefault();
          deleteSelectedRows();
        }
      }
    }

    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
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

    // Required fields per schema
    if (!row.bookId.trim()) {
      errors.bookId = 'Required';
    } else if (!/^[A-Z0-9\-_]+$/i.test(row.bookId.trim())) {
      errors.bookId = 'Invalid format';
    }
    
    if (!row.title.trim()) errors.title = 'Required';
    if (!row.author.trim()) errors.author = 'Required';
    if (!row.categoryId) errors.categoryId = 'Required';
    if (!row.publisher.trim()) errors.publisher = 'Required';
    
    if (!row.publishedYear) {
      errors.publishedYear = 'Required';
    } else {
      const year = parseInt(row.publishedYear);
      const currentYear = new Date().getFullYear();
      if (year < 1000 || year > currentYear) {
        errors.publishedYear = `Invalid`;
      }
    }
    
    if (!row.totalCopies || parseInt(row.totalCopies) < 1) {
      errors.totalCopies = 'Min 1';
    }

    // Optional field validations
    if (row.isbn && row.isbn.trim()) {
      const isbnClean = row.isbn.replace(/[-\s]/g, '');
      if (!/^\d{10}(\d{3})?$/.test(isbnClean)) {
        errors.isbn = 'Invalid ISBN';
      }
    }

    if (row.pages && parseInt(row.pages) < 1) {
      errors.pages = 'Invalid';
    }

    row.errors = errors;
    return Object.keys(errors).length === 0;
  }

  function addRows(count: number = 10) {
    const newRows = Array.from({ length: count }, () => createEmptyRow());
    rows = [...rows, ...newRows];
  }

  function deleteSelectedRows() {
    if (selectedRows.size === 0) return;
    if (confirm(`Delete ${selectedRows.size} selected row(s)?`)) {
      rows = rows.filter(r => !selectedRows.has(r.id));
      selectedRows.clear();
      if (rows.length === 0) {
        rows = [createEmptyRow()];
      }
    }
  }

  function toggleRowSelection(id: string) {
    if (selectedRows.has(id)) {
      selectedRows.delete(id);
    } else {
      selectedRows.add(id);
    }
    selectedRows = new Set(selectedRows);
  }

  function selectAllRows() {
    selectedRows = new Set(rows.map(r => r.id));
  }

  function clearSelection() {
    selectedRows.clear();
    selectedRows = new Set(selectedRows);
  }

  function clearAllRows() {
    if (confirm('Clear all data? This cannot be undone.')) {
      rows = Array.from({ length: 30 }, () => createEmptyRow());
      selectedRows.clear();
      successMessage = '';
      errorMessage = '';
    }
  }

  async function submitBooks() {
    successMessage = '';
    errorMessage = '';
    
    const filledRows = rows.filter(r => r.bookId.trim() || r.title.trim() || r.author.trim());
    
    if (filledRows.length === 0) {
      errorMessage = 'No data to submit. Please fill in at least one row.';
      return;
    }

    let hasErrors = false;
    filledRows.forEach(row => {
      if (!validateRow(row)) {
        hasErrors = true;
      }
    });

    if (hasErrors) {
      errorMessage = 'Please fix all validation errors before submitting.';
      return;
    }

    isSubmitting = true;
    let successCount = 0;
    let failureCount = 0;

    for (const row of filledRows) {
      row.status = 'submitted';
      row.message = 'Submitting...';

      try {
        const response = await fetch('/api/inventory/books', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookId: row.bookId.trim(),
            title: row.title.trim(),
            author: row.author.trim() || null,
            isbn: row.isbn?.trim() || null,
            publisher: row.publisher.trim() || null,
            publishedYear: row.publishedYear ? parseInt(row.publishedYear) : null,
            edition: row.edition?.trim() || null,
            language: row.language || 'English',
            pages: row.pages ? parseInt(row.pages) : null,
            categoryId: row.categoryId ? parseInt(row.categoryId) : null,
            location: row.location.trim() || null,
            totalCopies: row.totalCopies ? parseInt(row.totalCopies) : 1,
            availableCopies: row.totalCopies ? parseInt(row.totalCopies) : 1,
            description: row.description.trim() || null,
            coverImage: row.coverImage || null,
            isActive: true
          })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          row.status = 'success';
          row.message = 'Success';
          successCount++;
        } else {
          row.status = 'error';
          row.message = data.message || 'Failed';
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
      successMessage = `Successfully added ${successCount} book(s)!`;
      setTimeout(() => {
        goto('/dashboard/inventory/books?page=1');
      }, 2000);
    } else {
      errorMessage = `${successCount} succeeded, ${failureCount} failed.`;
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

    const fields = columnHeaders.map(h => h.key);
    const startFieldIndex = fields.indexOf(field);

    lines.forEach((line, lineIndex) => {
      const values = line.split('\t');
      const rowIndex = startRowIndex + lineIndex;

      while (rows.length <= rowIndex) {
        rows = [...rows, createEmptyRow()];
      }

      values.forEach((value, valueIndex) => {
        const fieldIndex = startFieldIndex + valueIndex;
        if (fieldIndex < fields.length) {
          const fieldName = fields[fieldIndex] as keyof BookRow;
          if (fieldName !== 'errors' && fieldName !== 'id' && fieldName !== 'status' && fieldName !== 'message') {
            (rows[rowIndex] as any)[fieldName] = value.trim();
          }
        }
      });
    });

    rows = rows;
  }

  function exportTemplate() {
    const headers = columnHeaders.map(h => h.label).join('\t');
    const csv = headers + '\n';
    
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
    element.setAttribute('download', 'book_bulk_entry_template.tsv');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  function handleCellClick(rowId: string, field: string) {
    activeCell = { rowId, field };
  }

  $: formulaLabel = (() => {
    const ac = activeCell;
    if (!ac) return 'Select a cell to view details';
    const rowIndex = rows.findIndex(r => r.id === ac.rowId) + 1;
    const colLabel = columnHeaders.find(h => h.key === ac.field)?.label ?? '';
    return `Row ${rowIndex} - ${colLabel}`;
  })();
</script>

<svelte:head>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
</svelte:head>

<div class="spreadsheet-wrapper">
  <!-- Top Toolbar -->
  <div class="toolbar">
    <div class="toolbar-left">
      <button class="back-btn" on:click={() => goto('/dashboard/inventory/books')} title="Back to Books" aria-label="Back to Books">
        <i class="fas fa-arrow-left"></i>
      </button>
      <div class="toolbar-title">
        <i class="fas fa-table-cells"></i>
        <span>Book Bulk Entry</span>
      </div>
    </div>

    <div class="toolbar-actions">
      <button class="toolbar-btn" on:click={exportTemplate} disabled={isSubmitting}>
        <i class="fas fa-download"></i>
        <span>Template</span>
      </button>
      <button class="toolbar-btn" on:click={() => addRows(10)} disabled={isSubmitting}>
        <i class="fas fa-plus"></i>
        <span>Add 10 Rows</span>
      </button>
      <button class="toolbar-btn danger" on:click={deleteSelectedRows} disabled={isSubmitting || selectedRows.size === 0}>
        <i class="fas fa-trash"></i>
        <span>Delete ({selectedRows.size})</span>
      </button>
      <button class="toolbar-btn" on:click={clearAllRows} disabled={isSubmitting}>
        <i class="fas fa-eraser"></i>
        <span>Clear All</span>
      </button>
      <button class="toolbar-btn primary" on:click={submitBooks} disabled={isSubmitting}>
        <i class="fas fa-cloud-upload-alt"></i>
        <span>{isSubmitting ? 'Submitting...' : 'Submit All'}</span>
      </button>
    </div>
  </div>

  <!-- Messages -->
  {#if successMessage || errorMessage}
    <div class="messages">
      {#if successMessage}
        <div class="message success">
          <i class="fas fa-check-circle"></i>
          <span>{successMessage}</span>
          <button on:click={() => (successMessage = '')} class="close-btn" aria-label="Close success message">
            <i class="fas fa-times"></i>
          </button>
        </div>
      {/if}

      {#if errorMessage}
        <div class="message error">
          <i class="fas fa-exclamation-triangle"></i>
          <span>{errorMessage}</span>
          <button on:click={() => (errorMessage = '')} class="close-btn" aria-label="Close error message">
            <i class="fas fa-times"></i>
          </button>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Formula Bar -->
  <div class="formula-bar">
    <div class="formula-label">
      <i class="fas fa-function"></i>
    </div>
    <div class="formula-value">
      {formulaLabel}
    </div>
  </div>

  <!-- Selection Bar -->
  <div class="selection-bar">
    <button class="select-btn" on:click={selectAllRows} disabled={isSubmitting}>
      <i class="fas fa-check-double"></i>
      Select All
    </button>
    <button class="select-btn" on:click={clearSelection} disabled={isSubmitting || selectedRows.size === 0}>
      <i class="fas fa-times"></i>
      Clear Selection
    </button>
    <div class="selection-info">
      <span class="badge">{selectedRows.size} selected</span>
      <span class="badge">{rows.filter(r => r.bookId.trim() || r.title.trim()).length} filled</span>
      <span class="badge">{rows.length} total rows</span>
    </div>
  </div>

  <!-- Spreadsheet Grid -->
  <div class="grid-container">
    <div class="grid-scroll">
      <table class="data-grid">
        <thead>
          <tr>
            <th class="col-checkbox freeze-col">
              <input
                type="checkbox"
                checked={selectedRows.size === rows.length && rows.length > 0}
                on:change={() => selectedRows.size === rows.length ? clearSelection() : selectAllRows()}
              />
            </th>
            <th class="col-number freeze-col">#</th>
            {#each columnHeaders as col}
              <th class="col-header" style="width: {col.width}px; min-width: {col.width}px;">
                <div class="header-content">
                  <span class="header-text">{col.label}</span>
                  {#if col.required}
                    <span class="required-mark">*</span>
                  {/if}
                </div>
              </th>
            {/each}
            <th class="col-status">Status</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row, index (row.id)}
            <tr class="data-row" class:selected={selectedRows.has(row.id)}>
              <td class="cell-checkbox freeze-col">
                <input
                  type="checkbox"
                  checked={selectedRows.has(row.id)}
                  on:change={() => toggleRowSelection(row.id)}
                />
              </td>

              <td class="cell-number freeze-col">{index + 1}</td>

              {#each columnHeaders as col}
                <td 
                  class="data-cell"
                  class:active={activeCell && activeCell.rowId === row.id && activeCell.field === col.key}
                  class:has-error={row.errors[col.key]}
                  on:click={() => handleCellClick(row.id, col.key)}
                >
                  <div class="cell-wrapper">
                    {#if col.key === 'categoryId'}
                      <select bind:value={row.categoryId} class="cell-input">
                        <option value="">Select category...</option>
                        {#each categories as cat}
                          <option value={cat.id}>{cat.name}</option>
                        {/each}
                      </select>
                    {:else if col.key === 'language'}
                      <select bind:value={row.language} class="cell-input">
                        {#each languages as lang}
                          <option value={lang}>{lang}</option>
                        {/each}
                      </select>
                    {:else if col.key === 'coverImage'}
                      <div class="file-upload-cell">
                        <input
                          type="file"
                          accept="image/*"
                          bind:this={fileInputs[row.id]}
                          on:change={(e) => handleFileSelect(row.id, e)}
                          class="file-input-hidden"
                          disabled={uploadingFiles[row.id]}
                        />
                        {#if uploadingFiles[row.id]}
                          <div class="file-uploading">
                            <i class="fas fa-spinner fa-spin"></i>
                            <span>Uploading...</span>
                          </div>
                        {:else if row.coverImage}
                          <div class="file-selected">
                            <i class="fas fa-image"></i>
                            <span class="file-name" title={row.coverImage}>
                              {row.coverImage.split('/').pop() || row.coverImage}
                            </span>
                            <button 
                              class="clear-file-btn" 
                              on:click={(e) => clearCoverImage(row.id, e)}
                              title="Remove image"
                              aria-label="Remove image"
                            >
                              <i class="fas fa-times"></i>
                            </button>
                          </div>
                        {:else}
                          <button 
                            class="upload-btn" 
                            on:click={() => triggerFileInput(row.id)}
                            type="button"
                          >
                            <i class="fas fa-upload"></i>
                            <span>Choose Image</span>
                          </button>
                        {/if}
                      </div>
                    {:else if col.key === 'publishedYear' || col.key === 'pages' || col.key === 'totalCopies'}
                      <input
                        type="number"
                        bind:value={(row as any)[col.key]}
                        on:paste={(e) => handlePaste(e, row.id, col.key)}
                        class="cell-input"
                        placeholder="0"
                      />
                    {:else}
                      <input
                        type="text"
                        bind:value={(row as any)[col.key]}
                        on:paste={(e) => handlePaste(e, row.id, col.key)}
                        class="cell-input"
                        placeholder={col.required ? 'Required' : ''}
                      />
                    {/if}
                    {#if row.errors[col.key]}
                      <div class="error-icon" title={row.errors[col.key]}>
                        <i class="fas fa-exclamation-circle"></i>
                      </div>
                    {/if}
                  </div>
                </td>
              {/each}

              <td class="cell-status" class:status-success={row.status === 'success'} class:status-error={row.status === 'error'} class:status-pending={row.status === 'submitted'}>
                <div class="status-content">
                  {#if row.status === 'success'}
                    <i class="fas fa-check-circle"></i>
                  {:else if row.status === 'error'}
                    <i class="fas fa-times-circle"></i>
                  {:else if row.status === 'submitted'}
                    <i class="fas fa-spinner fa-spin"></i>
                  {:else}
                    <i class="far fa-circle"></i>
                  {/if}
                  {#if row.message}
                    <span class="status-text">{row.message}</span>
                  {/if}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Quick Action Buttons -->
  <div class="quick-actions">
    <button class="quick-btn" on:click={() => addRows(10)} disabled={isSubmitting}>
      <i class="fas fa-plus"></i>
      +10 Rows
      <span class="shortcut">Ctrl+I</span>
    </button>
    <button class="quick-btn primary" on:click={submitBooks} disabled={isSubmitting}>
      <i class="fas fa-paper-plane"></i>
      Submit
      <span class="shortcut">Ctrl+Enter</span>
    </button>
  </div>
</div>

<style>
  * {
    box-sizing: border-box;
  }

  .spreadsheet-wrapper {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100%;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  }

  /* Toolbar */
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    background: white;
    border-bottom: 1px solid #e5e7eb;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    background: white;
    cursor: pointer;
    transition: all 0.2s;
    color: #374151;
  }

  .back-btn:hover {
    background: #f3f4f6;
    border-color: #9ca3af;
  }

  .toolbar-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 18px;
    font-weight: 600;
    color: #111827;
  }

  .toolbar-title i {
    color: #10b981;
    font-size: 20px;
  }

  .toolbar-actions {
    display: flex;
    gap: 8px;
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    background: white;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 14px;
    font-weight: 500;
    color: #374151;
  }

  .toolbar-btn:hover:not(:disabled) {
    background: #f9fafb;
    border-color: #9ca3af;
  }

  .toolbar-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .toolbar-btn.primary {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    border-color: #059669;
    color: white;
  }

  .toolbar-btn.primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
  }

  .toolbar-btn.danger {
    color: #dc2626;
  }

  .toolbar-btn.danger:hover:not(:disabled) {
    background: #fef2f2;
    border-color: #fca5a5;
  }

  /* Messages */
  .messages {
    padding: 12px 20px;
  }

  .message {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
  }

  .message.success {
    background: #d1fae5;
    color: #065f46;
    border: 1px solid #10b981;
  }

  .message.error {
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #ef4444;
  }

  .close-btn {
    margin-left: auto;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px;
    color: inherit;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  .close-btn:hover {
    opacity: 1;
  }

  /* Formula Bar */
  .formula-bar {
    display: flex;
    align-items: center;
    height: 32px;
    background: white;
    border-bottom: 1px solid #e5e7eb;
  }

  .formula-label {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 50px;
    height: 100%;
    border-right: 1px solid #e5e7eb;
    background: #f9fafb;
    color: #6b7280;
    font-weight: 600;
    font-size: 13px;
  }

  .formula-value {
    flex: 1;
    padding: 0 12px;
    font-size: 13px;
    color: #374151;
  }

  /* Selection Bar */
  .selection-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 20px;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }

  .select-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: white;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 13px;
    color: #374151;
  }

  .select-btn:hover:not(:disabled) {
    background: white;
    border-color: #9ca3af;
  }

  .select-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .selection-info {
    display: flex;
    gap: 8px;
    margin-left: auto;
  }

  .badge {
    padding: 4px 10px;
    border-radius: 12px;
    background: white;
    border: 1px solid #e5e7eb;
    font-size: 12px;
    font-weight: 500;
    color: #6b7280;
  }

  /* Grid */
  .grid-container {
    flex: 1;
    overflow: hidden;
    background: white;
  }

  .grid-scroll {
    width: 100%;
    height: 100%;
    overflow: auto;
  }

  .data-grid {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .data-grid thead {
    position: sticky;
    top: 0;
    z-index: 20;
  }

  .data-grid th,
  .data-grid td {
    border: 1px solid #e5e7eb;
  }

  .col-header,
  .col-checkbox,
  .col-number,
  .col-status {
    background: #f9fafb;
    font-weight: 600;
    font-size: 13px;
    color: #374151;
    text-align: left;
    user-select: none;
  }

  .col-checkbox {
    width: 50px;
    text-align: center;
  }

  .col-number {
    width: 60px;
    text-align: center;
  }

  .col-status {
    width: 120px;
    text-align: center;
  }

  .freeze-col {
    position: sticky;
    background: #f9fafb;
    z-index: 15;
  }

  .col-checkbox.freeze-col {
    left: 0;
  }

  .col-number.freeze-col {
    left: 50px;
  }

  .cell-checkbox.freeze-col {
    left: 0;
    background: white;
  }

  .cell-number.freeze-col {
    left: 50px;
    background: white;
  }

  .data-row.selected .freeze-col {
    background: #eff6ff !important;
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 12px;
  }

  .header-text {
    flex: 1;
  }

  .required-mark {
    color: #ef4444;
    font-weight: 700;
  }

  .data-row {
    transition: background-color 0.15s;
  }

  .data-row:hover {
    background: #f9fafb;
  }

  .data-row.selected {
    background: #eff6ff;
  }

  .cell-checkbox,
  .cell-number {
    text-align: center;
    padding: 8px;
    font-size: 13px;
    color: #6b7280;
  }

  .data-cell {
    padding: 0;
    position: relative;
  }

  .cell-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .cell-input {
    width: 100%;
    height: 100%;
    border: none;
    outline: none;
    padding: 8px 12px;
    font-size: 13px;
    font-family: inherit;
    background: transparent;
    color: #111827;
  }

  .cell-input::placeholder {
    color: #9ca3af;
    font-style: italic;
  }

  .cell-input:focus {
    outline: 2px solid #3b82f6;
    outline-offset: -2px;
    z-index: 5;
    position: relative;
  }

  .data-cell.active {
    outline: 2px solid #3b82f6;
    outline-offset: -2px;
  }

  .data-cell.has-error .cell-input {
    background: #fef2f2;
  }

  .error-icon {
    position: absolute;
    top: 4px;
    right: 4px;
    color: #ef4444;
    font-size: 12px;
    pointer-events: none;
  }

  .cell-status {
    padding: 8px;
  }

  .status-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 13px;
  }

  .cell-status i {
    font-size: 16px;
  }

  .cell-status.status-success {
    background: #f0fdf4;
  }

  .cell-status.status-success i {
    color: #10b981;
  }

  .cell-status.status-error {
    background: #fef2f2;
  }

  .cell-status.status-error i {
    color: #ef4444;
  }

  .cell-status.status-pending i {
    color: #3b82f6;
  }

  .status-text {
    font-size: 11px;
    color: #6b7280;
  }

  /* File Upload Styles */
  .file-upload-cell {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    padding: 4px 8px;
  }

  .file-input-hidden {
    display: none;
  }

  .upload-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px dashed #d1d5db;
    border-radius: 6px;
    background: #f9fafb;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 12px;
    color: #6b7280;
    width: 100%;
    justify-content: center;
  }

  .upload-btn:hover {
    background: #f3f4f6;
    border-color: #9ca3af;
    color: #374151;
  }

  .upload-btn i {
    font-size: 11px;
  }

  .file-selected {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 4px 8px;
    background: #eff6ff;
    border-radius: 4px;
  }

  .file-selected i {
    color: #3b82f6;
    font-size: 12px;
  }

  .file-name {
    flex: 1;
    font-size: 11px;
    color: #374151;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .clear-file-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
    transition: all 0.2s;
    color: #6b7280;
    flex-shrink: 0;
  }

  .clear-file-btn:hover {
    background: #fee2e2;
    color: #dc2626;
  }

  .clear-file-btn i {
    font-size: 10px;
  }

  .file-uploading {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 12px;
    background: #eff6ff;
    border-radius: 4px;
    justify-content: center;
  }

  .file-uploading i {
    color: #3b82f6;
    font-size: 12px;
  }

  .file-uploading span {
    font-size: 12px;
    color: #3b82f6;
  }

  /* Quick Actions */
  .quick-actions {
    position: fixed;
    bottom: 24px;
    right: 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    z-index: 100;
  }

  .quick-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 20px;
    border: 1px solid #d1d5db;
    border-radius: 12px;
    background: white;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    cursor: pointer;
    transition: all 0.2s;
    font-size: 14px;
    font-weight: 600;
    color: #374151;
  }

  .quick-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
  }

  .quick-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .quick-btn.primary {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    border-color: #059669;
    color: white;
  }

  .shortcut {
    margin-left: auto;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.1);
    font-size: 11px;
    font-weight: 500;
  }

  /* Scrollbar */
  .grid-scroll::-webkit-scrollbar {
    width: 12px;
    height: 12px;
  }

  .grid-scroll::-webkit-scrollbar-track {
    background: #f9fafb;
  }

  .grid-scroll::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 6px;
    border: 2px solid #f9fafb;
  }

  .grid-scroll::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }

  /* Responsive */
  @media (max-width: 1024px) {
    .toolbar {
      flex-direction: column;
      gap: 12px;
      align-items: stretch;
    }

    .toolbar-left {
      justify-content: space-between;
    }

    .toolbar-actions {
      flex-wrap: wrap;
    }

    .selection-info {
      margin-left: 0;
      margin-top: 8px;
    }
  }

  @media (max-width: 768px) {
    .quick-actions {
      bottom: 16px;
      right: 16px;
    }

    .toolbar-btn span:not(.fa):not(.fas):not(.far) {
      display: none;
    }

    .badge {
      font-size: 11px;
      padding: 3px 8px;
    }
  }
</style>