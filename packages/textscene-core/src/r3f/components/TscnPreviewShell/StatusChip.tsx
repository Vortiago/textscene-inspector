/** A top-bar status, announced politely. It sits in the header, so a canvas capture never sees it. */
import styles from './TscnPreviewShell.module.css';

/** `title` is a tooltip, for a status whose label alone does not say what to do. */
export function StatusChip({ label, title, testId }: { label: string; title?: string; testId: string }) {
  return (
    <span className={styles.statChip} role="status" aria-live="polite" title={title} data-testid={testId}>
      {label}
    </span>
  );
}
