/**
 * "Download .tscn": a Blob and anchor export, with no write-back to disk (ADR-0020).
 */

/**
 * Names the download after the active scene, so a batch of downloads does not
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
    // On a later task: `click()` only schedules the navigation, so a synchronous
    // revoke can beat the fetch and lose the download. In a `finally`, because a
    // host that refuses the synthetic click otherwise pins the buffer in the blob
    // store for the life of the tab.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
