export function normalizeResearchAuthors(value: unknown): string {
  const entries = Array.isArray(value) ? value : [value];

  return entries
    .flatMap((entry) => String(entry ?? '').split(/[;\r\n]+/))
    .map((author) => author.trim())
    .filter(Boolean)
    .join('; ');
}

export function getLeadResearchAuthor(value: unknown): string {
  return normalizeResearchAuthors(value).split(';', 1)[0] ?? '';
}

export function handleResearchAuthorKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter') return;

  event.preventDefault();
  const input = event.currentTarget as HTMLInputElement;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  const beforeCaret = input.value.slice(0, start);
  const afterSelection = input.value.slice(end);
  const left = beforeCaret.replace(/[ \t]+$/, '');
  const right = afterSelection.replace(/^[ \t]+/, '');
  if (!left) return;

  const separator = /;$/.test(left) ? ' ' : '; ';
  const replaceEnd = end + afterSelection.length - right.length;

  input.setRangeText(separator, left.length, replaceEnd, 'end');
  input.dispatchEvent(new Event('input', { bubbles: true }));
}