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

  const defaultLanguage = 'English';
  const languages = ['English', 'Filipino', 'Spanish', 'French', 'German', 'Japanese', 'Chinese', 'Other'];
  const columnHeaders = [
    { key: 'title', label: 'Title', required: true, width: 200 },
    { key: 'author', label: 'Author', required: true, width: 150 },
    { key: 'bookId', label: 'Book ID', required: true, width: 120 },
    { key: 'categoryId', label: 'Category', required: true, width: 140 },
    { key: 'publisher', label: 'Publisher', required: true, width: 150 },
    { key: 'publishedYear', label: 'Year', required: true, width: 80 },
    { key: 'language', label: 'Language', required: false, width: 120 },
    { key: 'copiesAvailable', label: 'Copies', required: true, width: 80 },
    { key: 'location', label: 'Location', required: false, width: 120 },
    { key: 'originPlace', label: 'Origin', required: false, width: 120 },
    { key: 'description', label: 'Description', required: false, width: 200 }
  ];

  let rows: BookRow[] = Array.from({ length: 30 }, () => createEmptyRow());
  let categories: { id: number; name: string }[] = [];
  let isSubmitting = false;
  let successMessage = '';
  let errorMessage = '';
  let selectedRows = new Set<string>();
  let activeCell: { rowId: string; field: string } | null = null;
  let showFilters = false;

  function createEmptyRow(): BookRow {
    return {
      id: Math.random().toString(36),
      title: '',
      author: '',
      bookId: '',
      categoryId: '',
      publisher: '',
      publishedYear: '',
      language: defaultLanguage,
      copiesAvailable: '',
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
      errors.bookId = 'Invalid format';
    }
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
    if (!row.copiesAvailable || parseInt(row.copiesAvailable) < 1) {
      errors.copiesAvailable = 'Min 1';
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
    
    const filledRows = rows.filter(r => r.title.trim() || r.author.trim() || r.bookId.trim());
    
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
        goto('/dashboard/books?page=1');
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
</script>

<svelte:head>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
</svelte:head>

<div class="spreadsheet-container">
  <!-- Ribbon Menu -->
  <div class="ribbon">
    <div class="ribbon-header">
      <div class="ribbon-title">
        <i class="fas fa-table text-emerald-600"></i>
        <span class="font-semibold">Book Bulk Entry</span>
      </div>
      <button
        on:click={() => goto('/dashboard/books')}
        class="icon-btn"
        title="Back to Books"
      >
        <i class="fas fa-arrow-left"></i>
      </button>
    </div>

    <div class="ribbon-tabs">
      <!-- File Tab -->
      <div class="ribbon-tab active">
        <div class="ribbon-group">
          <div class="ribbon-group-label">Clipboard</div>
          <div class="ribbon-buttons">
            <button class="ribbon-btn" on:click={exportTemplate} disabled={isSubmitting} title="Download Template">
              <i class="fas fa-paste text-xl"></i>
              <span>Paste</span>
            </button>
          </div>
        </div>

        <div class="ribbon-separator"></div>

        <div class="ribbon-group">
          <div class="ribbon-group-label">Rows</div>
          <div class="ribbon-buttons">
            <button class="ribbon-btn" on:click={() => addRows(10)} disabled={isSubmitting} title="Add 10 Rows">
              <i class="fas fa-plus text-xl text-blue-600"></i>
              <span>Insert</span>
            </button>
            <button 
              class="ribbon-btn" 
              on:click={deleteSelectedRows} 
              disabled={isSubmitting || selectedRows.size === 0}
              title="Delete Selected Rows"
            >
              <i class="fas fa-trash text-xl text-red-600"></i>
              <span>Delete</span>
            </button>
          </div>
        </div>

        <div class="ribbon-separator"></div>

        <div class="ribbon-group">
          <div class="ribbon-group-label">Selection</div>
          <div class="ribbon-buttons">
            <button class="ribbon-btn-small" on:click={selectAllRows} disabled={isSubmitting}>
              <i class="fas fa-check-double"></i>
              <span>Select All</span>
            </button>
            <button class="ribbon-btn-small" on:click={clearSelection} disabled={isSubmitting || selectedRows.size === 0}>
              <i class="fas fa-times-circle"></i>
              <span>Clear ({selectedRows.size})</span>
            </button>
          </div>
        </div>

        <div class="ribbon-separator"></div>

        <div class="ribbon-group">
          <div class="ribbon-group-label">Data</div>
          <div class="ribbon-buttons">
            <button class="ribbon-btn" on:click={exportTemplate} disabled={isSubmitting} title="Download TSV Template">
              <i class="fas fa-file-download text-xl text-green-600"></i>
              <span>Template</span>
            </button>
            <button class="ribbon-btn" on:click={clearAllRows} disabled={isSubmitting} title="Clear All Data">
              <i class="fas fa-eraser text-xl text-orange-600"></i>
              <span>Clear All</span>
            </button>
          </div>
        </div>

        <div class="ribbon-separator"></div>

        <div class="ribbon-group">
          <div class="ribbon-group-label">Submit</div>
          <div class="ribbon-buttons">
            <button 
              class="ribbon-btn submit-btn" 
              on:click={submitBooks} 
              disabled={isSubmitting}
            >
              <i class="fas fa-cloud-upload-alt text-2xl"></i>
              <span class="font-semibold">{isSubmitting ? 'Submitting...' : 'Submit All'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Messages -->
    {#if successMessage}
      <div class="alert alert-success">
        <i class="fas fa-check-circle"></i>
        <span>{successMessage}</span>
        <button on:click={() => (successMessage = '')} class="alert-close">
          <i class="fas fa-times"></i>
        </button>
      </div>
    {/if}

    {#if errorMessage}
      <div class="alert alert-error">
        <i class="fas fa-exclamation-triangle"></i>
        <span>{errorMessage}</span>
        <button on:click={() => (errorMessage = '')} class="alert-close">
          <i class="fas fa-times"></i>
        </button>
      </div>
    {/if}
  </div>

  <!-- Formula Bar -->
  <div class="formula-bar">
    <div class="formula-label">
      <i class="fas fa-function"></i>
      <span>fx</span>
    </div>
    <div class="formula-input">
      {#if activeCell}
        <input 
          type="text" 
          readonly 
          value={activeCell?.rowId && activeCell?.field ? `Cell: Row ${rows.findIndex(r => r.id === activeCell.rowId) + 1}, ${columnHeaders.find(h => h.key === activeCell.field)?.label}` : ''} 
          class="w-full px-2"
        />
      {:else}
        <input type="text" readonly placeholder="Select a cell to view details" class="w-full px-2" />
      {/if}
    </div>
  </div>

  <!-- Spreadsheet Grid -->
  <div class="sheet-container">
    <div class="sheet-viewport">
      <table class="sheet-table">
        <thead>
          <tr class="sheet-header-row">
            <th class="sheet-cell header-cell row-selector sticky-cell">
              <input
                type="checkbox"
                checked={selectedRows.size === rows.length && rows.length > 0}
                on:change={() => selectedRows.size === rows.length ? clearSelection() : selectAllRows()}
              />
            </th>
            <th class="sheet-cell header-cell row-number sticky-cell">#</th>
            {#each columnHeaders as col}
              <th 
                class="sheet-cell header-cell column-header"
                style="width: {col.width}px; min-width: {col.width}px;"
              >
                <div class="column-header-content">
                  <span>{col.label}</span>
                  {#if col.required}
                    <i class="fas fa-asterisk text-red-500 text-xs"></i>
                  {/if}
                  <button class="column-filter-btn" title="Filter">
                    <i class="fas fa-filter text-xs"></i>
                  </button>
                </div>
              </th>
            {/each}
            <th class="sheet-cell header-cell status-column">
              <i class="fas fa-flag"></i>
              <span>Status</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row, index (row.id)}
            <tr class="sheet-row" class:row-selected={selectedRows.has(row.id)}>
              <!-- Checkbox -->
              <td class="sheet-cell row-selector sticky-cell" class:cell-selected={selectedRows.has(row.id)}>
                <input
                  type="checkbox"
                  checked={selectedRows.has(row.id)}
                  on:change={() => toggleRowSelection(row.id)}
                />
              </td>

              <!-- Row Number -->
              <td class="sheet-cell row-number sticky-cell" class:cell-selected={selectedRows.has(row.id)}>
                {index + 1}
              </td>

              <!-- Data Cells -->
              {#each columnHeaders as col}
                <td 
                  class="sheet-cell data-cell"
                  class:cell-active={activeCell?.rowId === row.id && activeCell?.field === col.key}
                  class:cell-error={row.errors[col.key]}
                  on:click={() => handleCellClick(row.id, col.key)}
                >
                  {#if col.key === 'categoryId'}
                    <select
                      bind:value={row.categoryId}
                      class="cell-input"
                    >
                      <option value=""></option>
                      {#each categories as cat}
                        <option value={cat.id}>{cat.name}</option>
                      {/each}
                    </select>
                  {:else if col.key === 'language'}
                    <select
                      bind:value={row.language}
                      class="cell-input"
                    >
                      {#each languages as lang}
                        <option value={lang}>{lang}</option>
                      {/each}
                    </select>
                  {:else if col.key === 'publishedYear' || col.key === 'copiesAvailable'}
                    <input
                      type="number"
                      bind:value={row[col.key]}
                      on:paste={(e) => handlePaste(e, row.id, col.key)}
                      class="cell-input"
                    />
                  {:else}
                    <input
                      type="text"
                      bind:value={row[col.key]}
                      on:paste={(e) => handlePaste(e, row.id, col.key)}
                      class="cell-input"
                    />
                  {/if}
                  {#if row.errors[col.key]}
                    <div class="cell-error-indicator" title={row.errors[col.key]}>
                      <i class="fas fa-exclamation-triangle"></i>
                    </div>
                  {/if}
                </td>
              {/each}

              <!-- Status -->
              <td class="sheet-cell status-cell" class:status-success={row.status === 'success'} class:status-error={row.status === 'error'} class:status-pending={row.status === 'submitted'}>
                {#if row.status === 'success'}
                  <i class="fas fa-check-circle text-green-600"></i>
                {:else if row.status === 'error'}
                  <i class="fas fa-times-circle text-red-600"></i>
                {:else if row.status === 'submitted'}
                  <i class="fas fa-spinner fa-spin text-blue-600"></i>
                {:else}
                  <i class="far fa-circle text-gray-300"></i>
                {/if}
                {#if row.message}
                  <span class="status-message">{row.message}</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Status Bar -->
  <div class="status-bar">
    <div class="status-item">
      <i class="fas fa-table"></i>
      <span>Rows: {rows.length}</span>
    </div>
    <div class="status-separator"></div>
    <div class="status-item">
      <i class="fas fa-check-square"></i>
      <span>Selected: {selectedRows.size}</span>
    </div>
    <div class="status-separator"></div>
    <div class="status-item">
      <i class="fas fa-edit"></i>
      <span>Filled: {rows.filter(r => r.title.trim() || r.author.trim()).length}</span>
    </div>
    <div class="flex-1"></div>
    <div class="status-item">
      <i class="fas fa-keyboard"></i>
      <span>Ready</span>
    </div>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .spreadsheet-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  /* Ribbon */
  .ribbon {
    border-bottom: 1px solid #d1d5db;
  }

  .ribbon-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    border-bottom: 1px solid #e5e7eb;
  }

  .ribbon-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    color: #111827;
  }

  .ribbon-tabs {
    padding: 8px 16px;
  }

  .ribbon-tab {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }

  .ribbon-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .ribbon-group-label {
    font-size: 10px;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 0 4px;
  }

  .ribbon-buttons {
    display: flex;
    gap: 4px;
  }

  .ribbon-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
    transition: all 0.15s;
    font-size: 11px;
    color: #374151;
  }

  .ribbon-btn:hover:not(:disabled) {
    background: #f3f4f6;
    border-color: #d1d5db;
  }

  .ribbon-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .ribbon-btn-small {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
    transition: all 0.15s;
    font-size: 11px;
    color: #374151;
  }

  .ribbon-btn-small:hover:not(:disabled) {
    background: #f3f4f6;
    border-color: #d1d5db;
  }

  .ribbon-btn-small:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .submit-btn {
    background: #10b981;
    color: white;
    border-color: #059669;
  }

  .submit-btn:hover:not(:disabled) {
    background: #059669;
  }

  .ribbon-separator {
    width: 1px;
    background: #d1d5db;
    margin: 0 8px;
  }

  .icon-btn {
    padding: 6px 12px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    transition: all 0.15s;
    color: #374151;
  }

  .icon-btn:hover {
    background: #f3f4f6;
  }

  /* Alerts */
  .alert {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    margin: 8px 16px 0;
    border-radius: 4px;
    font-size: 13px;
  }

  .alert-success {
    background: #d1fae5;
    color: #065f46;
    border: 1px solid #10b981;
  }

  .alert-error {
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #ef4444;
  }

  .alert-close {
    margin-left: auto;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px;
    color: inherit;
    opacity: 0.7;
  }

  .alert-close:hover {
    opacity: 1;
  }

  /* Formula Bar */
  .formula-bar {
    display: flex;
    align-items: center;
    height: 28px;
    border-bottom: 1px solid #d1d5db;
  }

  .formula-label {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 12px;
    border-right: 1px solid #d1d5db;
    font-weight: 500;
    font-size: 12px;
    color: #374151;
    min-width: 60px;
  }

  .formula-input {
    flex: 1;
    padding: 0 8px;
  }

  .formula-input input {
    border: none;
    outline: none;
    width: 100%;
    font-size: 12px;
    color: #111827;
  }

  /* Sheet */
  .sheet-container {
    flex: 1;
    overflow: auto;
  }

  .sheet-viewport {
    display: inline-block;
    min-width: 100%;
  }

  .sheet-table {
    border-collapse: collapse;
    table-layout: fixed;
  }

  .sheet-header-row {
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .sheet-cell {
    border: 1px solid #d1d5db;
    position: relative;
  }

  .header-cell {
    background: #f3f4f6;
    font-weight: 600;
    font-size: 11px;
    color: #374151;
    padding: 6px 8px;
    text-align: left;
    user-select: none;
  }

  .row-selector {
    width: 40px;
    text-align: center;
  }

  .row-number {
    width: 50px;
    text-align: center;
    font-size: 11px;
    color: #6b7280;
  }

  .sticky-cell {
    position: sticky;
    z-index: 15;
  }

  .row-selector.sticky-cell {
    left: 0;
  }

  .row-number.sticky-cell {
    left: 40px;
  }

  .column-header {
    position: relative;
  }

  .column-header-content {
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: space-between;
  }

  .column-filter-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 2px;
    color: #9ca3af;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .column-header:hover .column-filter-btn {
    opacity: 1;
  }

  .column-filter-btn:hover {
    color: #374151;
  }

  .status-column {
    width: 100px;
    text-align: center;
  }

  .data-cell {
    padding: 0;
  }

  .cell-input {
    width: 100%;
    height: 100%;
    border: none;
    outline: none;
    padding: 6px 8px;
    font-size: 12px;
    font-family: inherit;
    background: transparent;
  }

  .cell-input:focus {
    outline: 2px solid #3b82f6;
    outline-offset: -2px;
    position: relative;
    z-index: 5;
  }

  .cell-active {
    outline: 2px solid #3b82f6;
    outline-offset: -2px;
  }

  .cell-error .cell-input {
    background: #fef2f2;
  }

  .cell-error-indicator {
    position: absolute;
    top: 2px;
    right: 2px;
    color: #ef4444;
    font-size: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
  }

  .sheet-row {
    height: 32px;
  }

  .sheet-row:hover {
    background: #f9fafb;
  }

  .row-selected {
    background: #eff6ff;
  }

  .cell-selected {
    background: #dbeafe;
  }

  .status-cell {
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 8px;
    position: relative;
  }

  .status-cell i {
    font-size: 14px;
  }

  .status-message {
    font-size: 10px;
    color: #6b7280;
    position: absolute;
    bottom: -18px;
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    background: #1f2937;
    color: white;
    padding: 4px 8px;
    border-radius: 3px;
    pointer-events: none;
  }

  .status-success {
    background: #f0fdf4;
  }

  .status-error {
    background: #fef2f2;
  }

  .status-pending {
    background: #eff6ff;
  }

  /* Status Bar */
  .status-bar {
    display: flex;
    align-items: center;
    height: 28px;
    border-top: 1px solid #d1d5db;
    padding: 0 16px;
    font-size: 12px;
    color: #6b7280;
    gap: 16px;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }

  .status-separator {
    width: 1px;
    height: 16px;
    background: #d1d5db;
  }

  .flex-1 {
    flex: 1;
  }

  /* Scrollbar Styling */
  .sheet-container::-webkit-scrollbar {
    width: 12px;
    height: 12px;
  }

  .sheet-container::-webkit-scrollbar-track {
    background: #f9fafb;
  }

  .sheet-container::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 6px;
  }

  .sheet-container::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .column-header-content {
      flex-direction: column;
    }
    
    .column-filter-btn {
      opacity: 1;
    }
  }
</style>