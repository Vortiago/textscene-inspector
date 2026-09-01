/**
 * "Download .tscn" — a Blob + anchor export, no write-back to disk (ADR-0020).
 */

/**
 * Name the download after whatever is active so a batch of downloads doesn't
 * collide on a generic "scene.tscn".
 */
export function downloadFilename(uploadedTscnName: string | null, fixtureFile: string): string {
  const base = uploadedTscnName || fixtureFile.split('/').pop() || 'scene.tscn';
  return base.endsWith('.tscn') ? base : `${base}.tscn`;
}

export function downloadTscn(buffer: string, filename: string): void {
  const blob = new Blob([buffer], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // Revoked on a later task, never in a `finally`: `click()` only SCHEDULES the
  // navigation, so tearing the blob URL down synchronously can beat the browser
  // to fetching it and the download silently never happens.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
