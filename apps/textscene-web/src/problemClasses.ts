/**
 * The class lists a problem marker is drawn with: a severity dot and its popover. A gutter row
 * and the file-level section share them, so a finding reads the same wherever the pane shows it.
 */
import type { Severity } from '@textscene/core/linter';
import styles from './r3f-main.module.css';

const SEVERITY_CLASS: Record<Severity, string> = {
  error: styles.severityError ?? '',
  warning: styles.severityWarning ?? '',
  info: styles.severityInfo ?? '',
};

/** The dot for `severity`. */
export function severityDotClass(severity: Severity): string {
  return `${styles.severityDot} ${SEVERITY_CLASS[severity]}`;
}

/** The popover's look, placed by `placement`, a class of its own. */
export function problemPopoverClass(placement: string | undefined): string {
  return `${styles.problemPopover} ${placement ?? ''}`;
}
