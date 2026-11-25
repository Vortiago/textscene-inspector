import type { PropertySection as PropertySectionData } from './formatters/inspectedNode.js';
import styles from './NodeDetailsPanel.module.css';

interface PropertySectionProps {
  section: PropertySectionData;
}

export function PropertySection({ section }: PropertySectionProps) {
  return (
    <div className={styles.section}>
      <h4 className={styles.sectionTitle}>{section.title}</h4>
      {section.items.map((item, idx) => (
        <div className={styles.row} key={`${item.label}-${idx}`}>
          <span className={styles.label}>{item.label}:</span>
          {/* A text node, not dangerouslySetInnerHTML: a value is text a file wrote. */}
          <span className={styles.value}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}
