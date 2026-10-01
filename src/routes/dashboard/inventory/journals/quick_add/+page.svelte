<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { toast } from '$lib/stores/toastStore.js';

  type Field = { key: string; label: string; width: number; type?: 'text' | 'number' | 'date' | 'category' | 'language' | 'textarea'; required?: boolean };
  type Row = { id: string; values: Record<string, string>; errors: Record<string, string>; status: 'ready' | 'submitting' | 'success' | 'error'; message: string };

  const fields: Field[] = [
    { key: 'journalId', label: 'Journal ID', width: 150 },
    { key: 'title', label: 'Title', width: 220, required: true },
    { key: 'publisher', label: 'Publisher', width: 160 },
    { key: 'issn', label: 'ISSN', width: 130 },
    { key: 'categoryId', label: 'Category', width: 160, type: 'category', required: true },
    { key: 'volume', label: 'Volume', width: 100 },
    { key: 'issueNumber', label: 'Issue', width: 100 },
    { key: 'publishedDate', label: 'Published date', width: 150, type: 'date' },
    { key: 'language', label: 'Language', width: 130, type: 'language' },
    { key: 'totalCopies', label: 'Copies', width: 90, type: 'number', required: true },
    { key: 'location', label: 'Location', width: 140 },
    { key: 'description', label: 'Description', width: 220, type: 'textarea' },
    { key: 'coverImage', label: 'Cover image URL', width: 210 }
  ];
  let languages = ['English', 'Filipino', 'Spanish', 'French', 'German', 'Japanese', 'Chinese', 'Other'];
  let rows: Row[] = [newRow()];
  let categories: { id: number; name: string }[] = [];
  let categoriesLoading = true;
  let categoriesError = '';
  let selectedRows = new Set<string>();
  let submitting = false;

  function newRow(): Row {
    return { id: Math.random().toString(36).slice(2), values: { language: 'English', totalCopies: '1' }, errors: {}, status: 'ready', message: '' };
  }

  onMount(() => { loadCategories(); loadLanguages(); });

  async function loadCategories() {
    categoriesLoading = true;
    categoriesError = '';
    try {
      const response = await fetch('/api/inventory/journals/categories?itemType=journal', { credentials: 'include' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Could not load journal categories.');
      categories = result.data?.categories || [];
      if (!categories.length) categoriesError = 'No journal categories are set up yet.';
    } catch (cause) {
      categoriesError = cause instanceof Error ? cause.message : 'Could not load journal categories.';
      categories = [];
      toast.error(categoriesError);
    } finally {
      categoriesLoading = false;
    }
  }

  async function loadLanguages() {
    try {
      const response = await fetch('/api/inventory/journals/languages', { credentials: 'include' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Could not load journal languages.');
      languages = result.data?.languages || ['English'];
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not load journal languages.');
    }
  }

  async function generateCallNumber(row: Row) {
    const category = categories.find((item) => String(item.id) === row.values.categoryId)?.name;
    if (!row.values.title?.trim() || !category) { toast.warning('Enter a title and choose a category first.'); return; }
    try {
      const response = await fetch('/api/inventory/journals/generate-call-number', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: row.values.title.trim(), authorLastName: row.values.publisher?.trim() || row.values.title.trim().split(/\s+/)[0],
          publisher: row.values.publisher?.trim() || undefined, category, year: row.values.publishedDate ? Number(row.values.publishedDate.slice(0, 4)) : undefined,
          isSerial: true, volume: row.values.volume ? Number(row.values.volume) : undefined,
          issue: row.values.issueNumber ? Number(row.values.issueNumber) : undefined
        })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || result.error || 'Could not generate journal call number.');
      row.values.location = result.data.display?.compact || result.data.callNumber;
      rows = [...rows];
      toast.success('Journal call number generated.');
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Could not generate journal call number.'); }
  }

  function validate(row: Row) {
    const value = row.values;
    const errors: Record<string, string> = {};
    if (!value.title?.trim()) errors.title = 'Required';
    if (!value.categoryId || !categories.some((category) => String(category.id) === value.categoryId)) errors.categoryId = 'Choose a listed category';
    const copies = Number(value.totalCopies);
    if (!Number.isInteger(copies) || copies < 1 || copies > 999) errors.totalCopies = 'Enter 1 to 999';
    if (value.journalId?.trim() && !/^[A-Z0-9_-]+$/i.test(value.journalId.trim())) errors.journalId = 'Invalid ID format';
    if (value.issn?.trim() && !/^\d{7}[\dX]$/i.test(value.issn.replace(/[-\s]/g, ''))) errors.issn = 'Enter a valid ISSN';
    row.errors = errors;
    return Object.keys(errors).length === 0;
  }

  function addRows(count = 1) { rows = [...rows, ...Array.from({ length: count }, newRow)]; }
  function toggleRow(id: string) { const next = new Set(selectedRows); next.has(id) ? next.delete(id) : next.add(id); selectedRows = next; }
  function toggleAll() { selectedRows = selectedRows.size === rows.length ? new Set() : new Set(rows.map((row) => row.id)); }
  function removeSelected() {
    const count = selectedRows.size;
    if (!count) return;
    rows = rows.filter((row) => !selectedRows.has(row.id));
    selectedRows = new Set();
    if (!rows.length) rows = [newRow()];
    toast.info(`Removed ${count} journal row${count === 1 ? '' : 's'}.`);
  }
  function clearRows() { rows = [newRow()]; selectedRows = new Set(); toast.info('Cleared journal entry rows.'); }

  function pasteRows(event: ClipboardEvent, rowIndex: number, fieldIndex: number) {
    const text = event.clipboardData?.getData('text') || '';
    if (!text.includes('\t') && !text.includes('\n')) return;
    event.preventDefault();
    for (const [lineOffset, line] of text.trim().split(/\r?\n/).entries()) {
      const target = rowIndex + lineOffset;
      while (rows.length <= target) rows = [...rows, newRow()];
      for (const [valueOffset, pasted] of line.split('\t').entries()) {
        const field = fields[fieldIndex + valueOffset];
        if (!field) break;
        const value = pasted.trim();
        if (field.key === 'categoryId') {
          const match = categories.find((category) => String(category.id) === value || category.name.toLowerCase() === value.toLowerCase());
          rows[target].values[field.key] = match ? String(match.id) : value;
        } else rows[target].values[field.key] = value;
      }
    }
    rows = [...rows];
  }

  function exportTemplate() {
    const link = document.createElement('a');
    link.href = `data:text/tab-separated-values;charset=utf-8,${encodeURIComponent(fields.map((field) => field.label).join('\t') + '\n')}`;
    link.download = 'journal_bulk_entry_template.tsv';
    link.click();
    toast.success('Journal template downloaded.');
  }

  async function submitRows() {
    if (submitting) return;
    const filled = rows.filter((row) => Object.entries(row.values).some(([key, value]) => key !== 'journalId' && value.trim()));
    if (!filled.length) { toast.warning('Enter at least one journal before submitting.'); return; }
    if (!categories.length) { toast.error(categoriesError || 'A journal category is required.'); return; }
    let invalidRows = false;
    for (const row of filled) {
      if (!validate(row)) { row.status = 'error'; row.message = 'Fix marked fields'; invalidRows = true; }
    }
    if (invalidRows) { rows = [...rows]; toast.error('Some journal rows need attention. Correct the marked fields and submit again.'); return; }

    submitting = true;
    let added = 0;
    let failed = 0;
    for (const row of filled) {
      row.status = 'submitting';
      row.message = 'Submitting...';
      const value = row.values;
      const payload = {
        itemType: 'journal',
        journalId: value.journalId?.trim() || undefined,
        title: value.title.trim(),
        publisher: value.publisher?.trim() || undefined,
        issn: value.issn?.replace(/[-\s]/g, '') || undefined,
        volume: value.volume?.trim() || undefined,
        issueNumber: value.issueNumber?.trim() || undefined,
        publishedDate: value.publishedDate || undefined,
        language: value.language || 'English',
        categoryId: Number(value.categoryId),
        location: value.location?.trim() || undefined,
        totalCopies: Number(value.totalCopies),
        description: value.description?.trim() || undefined,
        coverImage: value.coverImage?.trim() || undefined
      };
      try {
        const response = await fetch('/api/inventory/journals', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Failed to add journal.');
        if (result.data?.journalId) value.journalId = result.data.journalId;
        row.status = 'success'; row.message = 'Added'; added++;
      } catch (cause) {
        row.status = 'error'; row.message = cause instanceof Error ? cause.message : 'Request failed'; failed++;
      }
      rows = [...rows];
    }
    submitting = false;
    if (!failed) toast.success(`Added ${added} journal${added === 1 ? '' : 's'} successfully.`);
    else if (added) toast.warning(`Added ${added}; ${failed} journal row${failed === 1 ? '' : 's'} failed.`);
    else toast.error(`Could not add ${failed} journal row${failed === 1 ? '' : 's'}. Review the row statuses.`);
  }
</script>

<svelte:head><title>Bulk Add Journals | E-Kalibro Admin Portal</title></svelte:head>
<div class="quick-add-page">
  <header class="toolbar">
    <div><button type="button" class="back-button" onclick={() => goto('/dashboard/inventory/journals')}>Back to Journals</button><h1>Bulk Add Journals</h1></div>
    <div class="actions">
      <button type="button" onclick={exportTemplate} disabled={submitting}>Download Template</button><button type="button" onclick={() => addRows()} disabled={submitting}>Add Journal</button>
      <button type="button" onclick={removeSelected} disabled={submitting || selectedRows.size === 0}>Delete Selected</button><button type="button" onclick={clearRows} disabled={submitting}>Clear Rows</button>
      <button type="button" class="primary" onclick={submitRows} disabled={submitting || categoriesLoading}>{submitting ? 'Submitting...' : 'Submit Journals'}</button>
    </div>
  </header>
  <section class="help-panel">
    <p>Enter one journal per row. Fields marked <strong>*</strong> are required. Leave Journal ID blank to generate it automatically.</p><p>Paste tab-separated rows from a spreadsheet. Category names can be pasted as written.</p>
    {#if categoriesLoading}<p role="status">Loading journal categories...</p>{:else if categoriesError}<p role="alert">{categoriesError}</p><button type="button" onclick={loadCategories}>Retry categories</button>{/if}
  </section>
  <div class="table-scroll">
    <table>
      <thead><tr><th class="check"><input type="checkbox" checked={rows.length > 0 && selectedRows.size === rows.length} onchange={toggleAll} aria-label="Select all rows" /></th><th class="number">#</th>
        {#each fields as field}<th style={`width:${field.width}px;min-width:${field.width}px`}>{field.label}{field.required ? ' *' : ''}</th>{/each}<th class="status">Status</th>
      </tr></thead>
      <tbody>{#each rows as row, index (row.id)}
        <tr><td class="check"><input type="checkbox" checked={selectedRows.has(row.id)} onchange={() => toggleRow(row.id)} aria-label={`Select row ${index + 1}`} /></td><td class="number">{index + 1}</td>
          {#each fields as field, fieldIndex}
            <td class:error-cell={Boolean(row.errors[field.key])} style={`width:${field.width}px;min-width:${field.width}px`}>
              {#if field.type === 'category'}
                <select bind:value={row.values[field.key]} disabled={categoriesLoading || submitting} aria-label={`Category, row ${index + 1}`} onpaste={(event) => pasteRows(event, index, fieldIndex)}><option value="">Select category...</option>{#each categories as category}<option value={category.id}>{category.name}</option>{/each}</select>
              {:else if field.type === 'language'}
                <select bind:value={row.values[field.key]} disabled={submitting} aria-label={`Language, row ${index + 1}`} onpaste={(event) => pasteRows(event, index, fieldIndex)}>{#each languages as language}<option value={language}>{language}</option>{/each}</select>
              {:else if field.type === 'textarea'}
                <textarea bind:value={row.values[field.key]} disabled={submitting} aria-label={`${field.label}, row ${index + 1}`} onpaste={(event) => pasteRows(event, index, fieldIndex)}></textarea>
              {:else if field.key === 'location'}
                <div class="flex min-w-0 gap-1"><input type="text" bind:value={row.values[field.key]} disabled={submitting} aria-label={`${field.label}, row ${index + 1}`} onpaste={(event) => pasteRows(event, index, fieldIndex)} /><button type="button" onclick={() => generateCallNumber(row)} disabled={submitting} aria-label={`Generate call number for row ${index + 1}`}>Generate</button></div>
              {:else}
                <input type={field.type || 'text'} bind:value={row.values[field.key]} disabled={submitting} aria-label={`${field.label}, row ${index + 1}`} onpaste={(event) => pasteRows(event, index, fieldIndex)} />
              {/if}
              {#if row.errors[field.key]}<small>{row.errors[field.key]}</small>{/if}
            </td>
          {/each}
          <td class="status-cell" class:success={row.status === 'success'} class:failed={row.status === 'error'}>{row.message || (row.status === 'ready' ? 'Ready' : '—')}</td>
        </tr>
      {/each}</tbody>
    </table>
  </div>
  <footer><span>{selectedRows.size} selected</span><span>{rows.filter((row) => row.values.title?.trim()).length} filled</span><span>{rows.length} rows</span><button type="button" onclick={() => addRows(10)} disabled={submitting}>Add 10 rows</button></footer>
</div>
<style>
  * { box-sizing:border-box; }
  .quick-add-page { display:flex; flex-direction:column; width:calc(100% + 48px); height:100vh; margin:-24px; overflow:hidden; background:#f8faf9; color:#17231b; font-family:Arial,sans-serif; }
  .toolbar { display:flex; justify-content:space-between; align-items:center; gap:16px; padding:14px 20px; border-bottom:1px solid #d8e1db; background:#fff; }
  h1 { margin:8px 0 0; font-size:20px; }.actions { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:8px; }
  button { min-height:36px; padding:7px 12px; border:1px solid #cbd5ce; border-radius:5px; background:#fff; color:#244b34; font-size:13px; font-weight:600; cursor:pointer; }
  button:hover:not(:disabled) { background:#edf4ef; } button:disabled { cursor:not-allowed; opacity:.55; }.primary { border-color:#0d5c29; background:#0d5c29; color:#fff; }
  .help-panel { padding:10px 20px; border-bottom:1px solid #d8e1db; background:#eef7f0; color:#234b32; }.help-panel p { margin:3px 0; font-size:13px; line-height:1.45; }
  .table-scroll { flex:1; min-height:0; overflow:auto; background:#fff; } table { width:max-content; min-width:100%; border-collapse:collapse; table-layout:fixed; } th,td { position:relative; border:1px solid #dfe6e1; }
  th { position:sticky; top:0; z-index:2; padding:9px 10px; background:#f1f5f2; color:#344b3b; text-align:left; font-size:12px; }
  .check { position:sticky; left:0; z-index:3; width:42px; min-width:42px; text-align:center; }.number { position:sticky; left:42px; z-index:3; width:48px; min-width:48px; text-align:center; }
  td.check,td.number { z-index:1; padding:6px; background:#f8faf9; } td:not(.check):not(.number):not(.status-cell) { padding:0; }
  td input,td select,td textarea { display:block; width:100%; min-height:42px; padding:8px 10px; border:0; border-radius:0; background:transparent; font:inherit; font-size:13px; }td textarea { resize:vertical; }
  td input:focus,td select:focus,td textarea:focus { outline:2px solid #3b82f6; outline-offset:-2px; }.error-cell { background:#fff0f0; }small { display:block; padding:0 8px 5px; color:#b42318; font-size:11px; }
  .status-cell { position:sticky; right:0; min-width:120px; padding:8px; background:white; font-size:12px; }.status-cell.success { background:#edf8ef; color:#176b31; }.status-cell.failed { background:#fff0f0; color:#b42318; }
  footer { display:flex; align-items:center; gap:14px; padding:9px 20px; border-top:1px solid #d8e1db; background:#fff; color:#58685d; font-size:12px; }footer button { margin-left:auto; }
  @media(max-width:900px) { .toolbar { align-items:flex-start; flex-direction:column; }.actions { justify-content:flex-start; } }
  @media(max-width:639px) { .quick-add-page { width:calc(100% + 20px); height:100dvh; margin:-10px; }.toolbar { padding:10px 12px; }.help-panel { padding:8px 12px; }footer { flex-wrap:wrap; padding:8px 12px; }footer button { margin-left:0; } }
</style>
