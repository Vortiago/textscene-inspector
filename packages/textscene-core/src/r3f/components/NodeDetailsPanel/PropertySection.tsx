/**
 * One labeled section of `<label, value>` rows. Internal to
 * `<NodeDetailsPanel>` — not exported from the package.
 *
 * `value` is rendered via dangerouslySetInnerHTML because the existing
 * `PropertyFormatter` registry produces HTML strings (e.g. `<code>1.23</code>`).
 * These strings come from internal formatters, not user input — no XSS path.
 * TODO(follow-up): migrate `PropertyItem.value` to `ReactNode` for type safety.
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
          <span
            className={styles.value}
            // eslint-disable-next-line react/no-danger -- value strings are formatter-generated, not user input
            dangerouslySetInnerHTML={{ __html: item.value }}
          />
        </div>
      ))}
    </div>
  );
}
