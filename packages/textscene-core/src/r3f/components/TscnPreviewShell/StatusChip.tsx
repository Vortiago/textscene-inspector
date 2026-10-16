/** A top-bar status, announced politely. It sits in the header, so a canvas capture never sees it. */
import styles from './TscnPreviewShell.module.css';

export function StatusChip({ label, testId }: { label: string; testId: string }) {
  return (
    <span className={styles.statChip} role="status" aria-live="polite" data-testid={testId}>
      {label}
    </span>
  );
}
