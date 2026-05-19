/**
 * Categorised dropdown for switching between fixture scenes in the web
 * previewer. The host supplies the option list and the current value.
 *
 * (Distinct from the imperative `ViewportSelector.ts` mesh-picker — that
 * behaviour now lives in the `useViewportSelection` hook.)
 */
import { useMemo, type ChangeEvent } from 'react';
import styles from './ViewportSelector.module.css';

export interface ViewportSelectorOption {
  /** Stable value passed back through `onChange` (typically a filename or path). */
  value: string;
  /** Human-visible label rendered in the option. */
  label: string;
  /** Optional category groups options into `<optgroup>` blocks. */
  category?: string;
}

export interface ViewportSelectorProps {
  options: readonly ViewportSelectorOption[];
  value: string;
  onChange: (value: string) => void;
  /** Optional label shown to the left of the select. */
  label?: string;
  /** Optional className applied to the root `<div>` for host-side layout. */
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
