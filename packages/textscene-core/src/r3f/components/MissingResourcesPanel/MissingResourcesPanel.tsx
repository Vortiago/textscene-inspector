import type { ChangeEvent } from 'react';
import { useMissingResources } from '../../contexts/MissingResourcesContext.js';
import type { SceneFile } from '../../../scene/sceneFiles.js';
import { failureChainText } from '../../../resources/loadFailure/failureText.js';
import styles from './MissingResourcesPanel.module.css';

export interface MissingResourcesPanelProps {
  /** Called when the user picks a file for a missing row, with the file that failed first. */
  onUpload: (path: string, file: File) => void;
  /**
   * Called when the user clicks "Remove" on an uploaded row. It gets the same
   * path `onUpload` got, or the removal misses the bytes it stored.
   */
  onRemove: (path: string) => void;
}

export function MissingResourcesPanel({ onUpload, onRemove }: MissingResourcesPanelProps) {
  const { missingFiles, uploadedPaths, removeUploaded } = useMissingResources();

  // With nothing missing and nothing uploaded, the panel takes no space.
  if (missingFiles.length === 0 && uploadedPaths.size === 0) {
    return null;
  }

  const uploaded = Array.from(uploadedPaths).sort();

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
        {missingFiles.map((file) => (
          <MissingRow key={`m-${file.path}`} file={file} onUpload={onUpload} />
        ))}
      </div>
    </div>
  );
}

interface MissingRowProps {
  file: SceneFile;
  onUpload: (path: string, file: File) => void;
}

function MissingRow({ file: { path, addresses, reason }, onUpload }: MissingRowProps) {
  // A pick replaces the file that failed first, which a sub-resource row names by its address.
  const failsThroughAnother = reason !== null && reason.chain.length > 1;
  const uploadPath = failsThroughAnother ? reason.chain.at(-1)! : path;
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
        <div className={styles.path} title={path}>
          {path}
        </div>
      </div>
      {addresses.length > 0 && (
        <div className={styles.chain} data-testid="missing-file-addresses">
          Asked inside it: {addresses.join(', ')}
        </div>
      )}
      {failsThroughAnother && (
        <div className={styles.chain} data-testid="load-failure-chain">
          Fails to load: {failureChainText(reason.chain, reason.cause)}
        </div>
      )}
      <div className={styles.action}>
        <input
          type="file"
          className={styles.upload}
          onChange={handleChange}
          // The title names the file a pick replaces.
          aria-label={`Upload file for ${path}`}
          title={replacesOtherFile ? `Replaces ${uploadPath}` : undefined}
        />
      </div>
    </div>
  );
}
