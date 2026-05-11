export function safeLower(value: string | undefined | null): string {
  return String(value || '').toLowerCase().trim();
}

/** Date part for Hebrew join-request lines, e.g. "6 במאי 2026". */
export function formatHebrewJoinRequestDate(date: Date): string {
  return new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** 24-hour time for Hebrew lines, zero-padded, e.g. "00:05". */
export function formatHebrewJoinRequestTime(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** Single natural datetime for English lecturer join-request lines. */
export function formatEnglishJoinRequestWhen(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function isHebrewUiLanguage(language: string | undefined): boolean {
  const lang = String(language || '').toLowerCase();
  return lang === 'he' || lang.startsWith('he-');
}
