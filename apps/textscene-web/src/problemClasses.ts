/**
 * The severity dot's class list. A gutter row and the file-level section share it, so a finding
 * reads the same wherever the pane shows it.
 */
import type { Severity } from '@textscene/core/linter';
import styles from './r3f-main.module.css';

const SEVERITY_CLASS: Record<Severity, string> = {
  error: styles.severityError ?? '',
  warning: styles.severityWarning ?? '',
  info: styles.severityInfo ?? '',
};

export function severityDotClass(severity: Severity): string {
  return `${styles.severityDot} ${SEVERITY_CLASS[severity]}`;
}
