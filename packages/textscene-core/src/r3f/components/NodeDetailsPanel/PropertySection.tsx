/**
 * One labeled section of `<label, value>` rows. Internal to
 * `<NodeDetailsPanel>` — not exported from the package.
 *
 * `value` is a plain display string — every `PropertyFormatter` emits
 * `toFixed` / enum-name / `rgba(...)` text — so it renders as a text node.
 * No `dangerouslySetInnerHTML`, no XSS surface.
 */
import type { PropertySection as PropertySectionData } from '../../../core/NodeRegistry.js';
import styles from './NodeDetailsPanel.module.css';

export interface PropertySectionProps {
  section: PropertySectionData;
}

export function PropertySection({ section }: PropertySectionProps) {
  return (
    <div className={styles.section}>
      <h4 className={styles.sectionTitle}>{section.title}</h4>
      {section.items.map((item, idx) => (
        <div className={styles.row} key={`${item.label}-${idx}`}>
          <span className={styles.label}>{item.label}:</span>
          <span className={styles.value}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}
