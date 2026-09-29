/**
 * The top-bar status while procedural textures are still building or uploading.
 * It sits in the header, never over the viewport, so a canvas capture never sees
 * it. A capture harness waits for it to detach (ADR-0042).
 */
import { usePendingTextureWork } from '../../../resources/usePendingTextureWork.js';
import styles from './TscnPreviewShell.module.css';
import { TEXTURE_WORK_STATUS_TESTID } from './textureWorkStatusTestId.js';

export function TextureWorkStatus() {
  if (usePendingTextureWork() === 0) return null;
  return (
    <span className={styles.statChip} role="status" aria-live="polite" data-testid={TEXTURE_WORK_STATUS_TESTID}>
      Building textures…
    </span>
  );
}
