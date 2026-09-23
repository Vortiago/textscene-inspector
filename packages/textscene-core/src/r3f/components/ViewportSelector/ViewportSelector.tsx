/**
 * A categorised dropdown of fixture scenes for the web previewer. The host
 * supplies the options and the current value.
 */
import { useMemo, type ChangeEvent } from 'react';
import styles from './ViewportSelector.module.css';

export interface ViewportSelectorOption {
  /** The value `onChange` passes back, such as a filename. */
  value: string;
  label: string;
  /** Groups options into `<optgroup>` blocks. */
  category?: string;
}

export interface ViewportSelectorProps {
  options: readonly ViewportSelectorOption[];
  value: string;
  onChange: (value: string) => void;
  /** A label left of the select. */
  label?: string;
  /** A className on the root `<div>`, for the host's layout. */
  className?: string;
}

interface CategoryBucket {
  category: string;
  items: readonly ViewportSelectorOption[];
}

function bucketByCategory(
  options: readonly ViewportSelectorOption[]
): readonly CategoryBucket[] {
  const map = new Map<string, ViewportSelectorOption[]>();
  for (const opt of options) {
    const key = opt.category ?? '';
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(opt);
    } else {
      map.set(key, [opt]);
    }
  }
  return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
}

export function ViewportSelector({
  options,
  value,
  onChange,
  label = 'Scene:',
  className,
}: ViewportSelectorProps) {
  const buckets = useMemo(() => bucketByCategory(options), [options]);

  function handleChange(e: ChangeEvent<HTMLSelectElement>) {
    onChange(e.target.value);
  }

  const rootClass = className ? `${styles.root} ${className}` : styles.root;

  return (
    <div className={rootClass}>
      <label className={styles.label}>{label}</label>
      <select
        className={styles.select}
        value={value}
        onChange={handleChange}
        aria-label={label}
      >
        {buckets.map(({ category, items }) =>
          category ? (
            <optgroup key={category} label={category}>
              {items.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </optgroup>
          ) : (
            items.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))
          )
        )}
      </select>
    </div>
  );
}
