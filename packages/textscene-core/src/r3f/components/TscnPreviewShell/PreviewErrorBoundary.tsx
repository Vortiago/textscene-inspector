/**
 * Wraps `<ViewportArea>` so a render-time exception there (thrown before
 * `<Canvas>` even mounts, or from the 2D `Canvas2DStage` DOM overlay) shows a
 * recoverable message instead of leaving the whole shell dark (#216). This is
 * the OUTER half of the fix — it does NOT catch anything thrown from inside
 * `<TscnCanvas>`'s own `<Canvas>` (R3F mounts a separate react-reconciler
 * root there); `NodeDispatcher`'s per-node `<ErrorBoundary>` covers that half.
 *
 * `resetKeys={[sceneGraph]}` clears the caught error the instant a fresh
 * parse hands the shell a new `SceneGraph` (the user fixed whatever crashed
 * it) — via `ErrorBoundary`'s props-driven reset, NOT a `key`-driven remount,
 * so a successful reparse does not tear down `<TscnCanvas>` and lose
 * OrbitControls camera state on every edit (see
 * "preserves the same TscnCanvas instance across content changes" in
 * TscnPreviewShell.test.tsx).
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
