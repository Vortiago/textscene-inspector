/**
 * The top-bar status while procedural textures are still building or uploading.
 * It sits in the header, never over the viewport, so a canvas capture never sees
 * it. A capture harness waits for it to detach (ADR-0042).
 */
import { usePendingTextureWork } from '../../../resources/usePendingTextureWork.js';
import styles from './TscnPreviewShell.module.css';

/** The status element's test id, which the capture harnesses read from outside the app. */
export const TEXTURE_WORK_STATUS_TESTID = 'texture-work-status';

export function TextureWorkStatus() {
  if (usePendingTextureWork() === 0) return null;
  return (
    <span className={styles.statChip} role="status" aria-live="polite" data-testid={TEXTURE_WORK_STATUS_TESTID}>
      Building textures…
    </span>
  );
}
