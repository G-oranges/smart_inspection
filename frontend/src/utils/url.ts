const RESOLVE_BASE =
  import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || '';

export function resolvePhotoUrl(rawUrl: string | null | undefined): string {
  if (!rawUrl) return '';
  const url = String(rawUrl).trim();
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return encodeURI(url);
  }
  const base = RESOLVE_BASE.replace(/\/$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return encodeURI(`${base}${path}`);
}
