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
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
  } finally {
    // Scheduled on a later task rather than revoked inside the `finally`:
    // `click()` only SCHEDULES the navigation, so tearing the blob URL down
    // synchronously can beat the browser to fetching it and the download
    // silently never happens. The `finally` is still needed — a host that
    // refuses the synthetic click leaves the whole buffer pinned in the
    // document's blob store for the life of the tab otherwise.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
