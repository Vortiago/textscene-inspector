/**
 * The top-bar status while the scene's resources are still loading. It sits in the
 * header, never over the viewport, so a canvas capture never sees it. The work budget
 * check waits for it to detach, so it never measures a scene that is still loading.
 */
import { usePendingResourceCount } from '../../../resources/usePendingResourceCount.js';
import styles from './TscnPreviewShell.module.css';
import { RESOURCE_LOAD_STATUS_TESTID } from './resourceLoadStatusTestId.js';

export function ResourceLoadStatus() {
  if (usePendingResourceCount() === 0) return null;
  return (
    <span
      className={styles.statChip}
      role="status"
      aria-live="polite"
      data-testid={RESOURCE_LOAD_STATUS_TESTID}
    >
      Loading resources…
    </span>
  );
}
