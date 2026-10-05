const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

// Translate native keyboard edits into transport keys, never scores or validation.
export function inputKeys(type: string, data: string | null, value: string): string[] {
  if (type.startsWith('delete') && type.endsWith('Backward')) return ['Backspace'];
  if (type === 'insertFromPaste' || type === 'insertFromDrop') return [];
  if (type === 'insertLineBreak' || type === 'insertParagraph') return ['Enter'];
  if (!type.startsWith('insert')) return [];
  const text = (data ?? (value.startsWith(' ') ? value.slice(1) : value)).normalize('NFC');
  return Array.from(segmenter.segment(text), part => part.segment);
}
