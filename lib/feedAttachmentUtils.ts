/** Shared helpers for feed post attachments (preview, viewer routing). */

export function attachmentLooksLikeImage(file: { name: string; url: string; mimeType?: string | null }) {
  const mime = String(file.mimeType || '').toLowerCase();
  const url = String(file.url || '').toLowerCase();
  return mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|heic)(\?|$)/i.test(url);
}

export function attachmentLooksLikePdf(file: { name: string; url: string; mimeType?: string | null }) {
  const mime = String(file.mimeType || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  const url = String(file.url || '').toLowerCase();
  return mime.includes('pdf') || name.endsWith('.pdf') || /\.pdf(\?|$)/i.test(url);
}
