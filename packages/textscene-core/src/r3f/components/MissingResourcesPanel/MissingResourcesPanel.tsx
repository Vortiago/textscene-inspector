/**
 * Aggregated DOM panel listing every missing-resource path the
 * dispatcher's `useResource` calls have reported, plus every path the
 * user has uploaded a file for. One row per path, uploaded rows first.
 *
 * Mirrors the pre-migration `updateResourceFilesList()` from
 * `apps/textscene-web/src/main.ts` (see
 * `docs/archive/MAIN-FEATURE-INVENTORY.md` "Missing-files-list" section).
 *
 * The component is host-agnostic: it only knows about paths. The host
 * supplies `onUpload(path, file)` and `onRemove(path)` callbacks, which
 * in the web app wrap `provider.addUploadedFile` + `loader.provideFile`.
 *
 * A row may name a resource INSIDE a `.tres` (a **Sub-resource path**), because
 * that is the identity a failed load is reported under. The file a user picks or
 * removes is always the OWNING file, so both callbacks are handed the file half
 * and no host has to know the grammar — the row keeps its own address so it
 * still disappears and reappears under the identity `useResource` reports.
 */
import { type ChangeEvent } from 'react';
import { useMissingResources } from '../../contexts/MissingResourcesContext.js';
import { resourceFilePath } from '../../../resources/subResourcePath.js';
import styles from './MissingResourcesPanel.module.css';

export interface MissingResourcesPanelProps {
  /**
   * Called when the user picks a file for a specific missing-row path.
   * The host wires the file into its resource provider and asks the
   * loader to re-resolve dependents. Always a real file path, never a
   * **Sub-resource path** — a host keys its provider by file.
   */
  onUpload: (path: string, file: File) => void;
  /**
   * Called when the user clicks "Remove" on an uploaded row. The host
   * deletes the file from its provider's cache. Also always a real file path,
   * and necessarily the same one `onUpload` was given, or the removal would
   * miss the bytes the upload stored.
   */
  onRemove: (path: string) => void;
}

export function MissingResourcesPanel({ onUpload, onRemove }: MissingResourcesPanelProps) {
  const { missingPaths, uploadedPaths, removeUploaded } = useMissingResources();

  // Hidden when nothing's missing AND nothing's been uploaded — matches
  // main's `.visible` class toggle. The panel takes no space at all
  // when the user has nothing to do.
  if (missingPaths.size === 0 && uploadedPaths.size === 0) {
    return null;
  }

  const uploaded = Array.from(uploadedPaths).sort();
  const missing = Array.from(missingPaths).sort();

  const handleRemove = (path: string) => {
    // Drop the uploaded entry from the panel state first so the row
    // disappears immediately. Then let the host invalidate its
    // provider + loader; if `useResource` re-resolves as `missing`
    // the path will reappear as a missing row on the next render.
    removeUploaded(path);
    // The row keeps its own identity; the host is told the file, which is the
    // key its provider stored the bytes under when the row was uploaded.
    onRemove(resourceFilePath(path));
  };

  return (
    <div
      className={styles.panel}
      role="region"
      aria-label="Resource files"
      data-testid="missing-resources-panel"
    >
      <div className={styles.title}>Resource files</div>
      <div className={styles.list}>
        {uploaded.map((path) => (
          <div
            key={`u-${path}`}
            className={`${styles.item} ${styles.uploaded}`}
            data-state="uploaded"
            data-path={path}
          >
            <div className={styles.itemHead}>
              <div className={`${styles.icon} ${styles.uploaded}`} aria-hidden="true">
                ✓
              </div>
              <div className={styles.path} title={path}>
                {path}
              </div>
            </div>
            <div className={styles.action}>
              <button
                type="button"
                className={styles.remove}
                onClick={() => handleRemove(path)}
                aria-label={`Remove uploaded file for ${path}`}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        {missing.map((path) => (
          <MissingRow key={`m-${path}`} path={path} onUpload={onUpload} />
        ))}
      </div>
    </div>
  );
}

interface MissingRowProps {
  path: string;
  onUpload: (path: string, file: File) => void;
}

function MissingRow({ path, onUpload }: MissingRowProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // The row may name a resource inside a `.tres`; what the user picked is the
    // owning file, which is the only thing a provider can be keyed by.
    onUpload(resourceFilePath(path), file);
    // Reset the input so picking the same filename again would re-fire.
    e.target.value = '';
  };

  return (
    <div
      className={`${styles.item} ${styles.missing}`}
      data-state="missing"
      data-path={path}
    >
      <div className={styles.itemHead}>
        <div className={`${styles.icon} ${styles.missing}`} aria-hidden="true">
          ⚠
        </div>
        <div className={styles.path} title={path}>
          {path}
        </div>
      </div>
      <div className={styles.action}>
        <input
          type="file"
          className={styles.upload}
          onChange={handleChange}
          aria-label={`Upload file for ${path}`}
        />
      </div>
    </div>
  );
}
