import type { ReactNode } from 'react';
import { PerformanceOverlay } from './frameProfile/PerformanceOverlay.js';
import styles from './TscnCanvas.module.css';

/** The element a stage of the view fills, with the view's own class, then the host's. */
export function StageRoot({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={className ? `${styles.root} ${className}` : styles.root}>
      {children}
      <PerformanceOverlay />
    </div>
  );
}
