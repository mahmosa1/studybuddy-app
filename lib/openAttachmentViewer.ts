import type { Router } from 'expo-router';

export type AttachmentViewerParams = {
  url: string;
  name?: string | null;
  mimeType?: string | null;
};

/** Navigate to in-app attachment viewer (URL-encoded query params). */
export function pushAttachmentViewer(router: Router, file: AttachmentViewerParams) {
  const url = String(file.url || '').trim();
  if (!url) return;
  const name = (file.name != null && String(file.name).trim()) || 'attachment';
  const mimeType = file.mimeType != null ? String(file.mimeType).trim() : '';
  const href = `/attachment-viewer?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}&mimeType=${encodeURIComponent(mimeType)}`;
  router.push(href as any);
}
