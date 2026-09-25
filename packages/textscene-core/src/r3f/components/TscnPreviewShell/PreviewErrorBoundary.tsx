/**
 * A render error in `<ViewportArea>` shows a recoverable message. It misses
 * errors inside `<Canvas>`, a separate reconciler root that `NodeDispatcher`'s
 * per-node `<ErrorBoundary>` covers. `resetKeys`, not a `key` remount, clears
 * it on a new `SceneGraph`, so a reparse keeps the viewport camera state.
 */
import type { ReactNode } from 'react';
import type { SceneGraph } from '../../../core/SceneGraph.js';
import { ErrorBoundary } from '../ErrorBoundary.js';
import styles from './TscnPreviewShell.module.css';

export interface PreviewErrorBoundaryProps {
  sceneGraph: SceneGraph | null;
  children: ReactNode;
}

export function PreviewErrorBoundary({ sceneGraph, children }: PreviewErrorBoundaryProps) {
  return (
    <ErrorBoundary
      resetKeys={[sceneGraph]}
      fallback={(error, reset) => (
        <div className={styles.viewportCrashed} role="alert">
          <p>
            <strong>The viewport crashed while rendering this scene.</strong>
          </p>
          <p className={styles.viewportCrashedDetail}>{error.message}</p>
          <button type="button" onClick={reset}>
            Try again
          </button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
