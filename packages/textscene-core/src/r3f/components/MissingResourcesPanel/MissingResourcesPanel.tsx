/**
 * Lists every missing-resource path that `useMissingReport` reported and every
 * path the user uploaded a file for, one row per path, uploaded rows first.
 * It knows only paths: the host supplies `onUpload` and `onRemove`. An
 * uploaded row is already a file, since `markUploaded` keys by file.
 */
import { useMemo, type ChangeEvent } from 'react';
import { useMissingResources } from '../../contexts/MissingResourcesContext.js';
import { resourceFilePath } from '../../../resources/subResourcePath.js';
import { useFirstLoadFailure } from '../../../resources/loadFailure/useFirstLoadFailure.js';
import { failureChainText } from '../../../resources/loadFailure/failureText.js';
import styles from './MissingResourcesPanel.module.css';

export interface MissingResourcesPanelProps {
  /**
   * Called when the user picks a file for a missing row. The path is always a
   * file, never a **Sub-resource path**, because a host keys its provider by file.
   */
  onUpload: (path: string, file: File) => void;
  /**
   * Called when the user clicks "Remove" on an uploaded row. It gets the same
   * path `onUpload` got, or the removal misses the bytes it stored.
   */
  onRemove: (path: string) => void;
}

export function MissingResourcesPanel({ onUpload, onRemove }: MissingResourcesPanelProps) {
  const { missingPaths, uploadedPaths, removeUploaded } = useMissingResources();

  // With nothing missing and nothing uploaded, the panel takes no space.
  if (missingPaths.size === 0 && uploadedPaths.size === 0) {
    return null;
  }

  const uploaded = Array.from(uploadedPaths).sort();
  const missing = Array.from(missingPaths).sort();

  const handleRemove = (path: string) => {
    // Drop the row first so it disappears at once. If the host's re-resolve
    // reports the path missing again, it comes back as a missing row.
    removeUploaded(path);
    onRemove(path);
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
  // A pick replaces the `.tres` a resource row names, or the file that failed first.
  const filePath = resourceFilePath(path);
  const failure = useFirstLoadFailure(useMemo(() => [filePath], [filePath]));
  const failsThroughAnother = failure !== null && failure.chain.length > 1;
  const uploadPath = failsThroughAnother ? failure.chain.at(-1)! : filePath;
  const replacesOtherFile = uploadPath !== path;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onUpload(uploadPath, file);
    // Reset the input so picking the same filename again would re-fire.
    e.target.value = '';
  };

  return (
    <div className={`${styles.item} ${styles.missing}`} data-state="missing" data-path={path}>
      <div className={styles.itemHead}>
        <div className={`${styles.icon} ${styles.missing}`} aria-hidden="true">
          ⚠
        </div>
        <div className={styles.path} title={filePath !== path ? `${path}, inside ${filePath}` : path}>
          {path}
        </div>
      </div>
      {failsThroughAnother && (
        <div className={styles.chain} data-testid="load-failure-chain">
          Fails to load: {failureChainText(failure.chain, failure.cause)}
        </div>
      )}
      <div className={styles.action}>
        <input
          type="file"
          className={styles.upload}
          onChange={handleChange}
          // Named by the row, so two sub-resource rows of one file stay distinct to
          // assistive tech. The title names the file a pick replaces.
          aria-label={`Upload file for ${path}`}
          title={replacesOtherFile ? `Replaces ${uploadPath}` : undefined}
        />
      </div>
    </div>
  );
}
