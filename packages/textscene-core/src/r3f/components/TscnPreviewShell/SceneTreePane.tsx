/** The Split Dock's master pane (ADR-0007): the scene tree and its header. */

import { lazy, Suspense, type ReactNode } from 'react';
import type { SceneGraph } from '../../../core/SceneGraph.js';
import type { TscnNode } from '../../../parser/types.js';
import { SceneNodeCount } from './SceneStats.js';
import styles from './TscnPreviewShell.module.css';

// Bundle reduction: lazy-load the DOM panel so it doesn't land in the initial
// canvas-paint bundle. The first frame doesn't need it — it hydrates after the
// canvas is up. A `React.lazy` of the module's default export; the underlying
// file re-exports the named component as the default to satisfy that contract.
const SceneTreeViewer = lazy(() =>
  import('../SceneTreeViewer/SceneTreeViewer.js').then((m) => ({
    default: m.SceneTreeViewer,
  }))
);

export function SceneTreePane({
  sceneGraph,
  error,
  treeShare,
  onCollapse,
  onNodeReveal,
  onOpenSubScene,
}: {
  sceneGraph: SceneGraph | null;
  error: string | null;
  /** The master's fraction of the dock height (0..1). */
  treeShare: number;
  onCollapse: () => void;
  onNodeReveal?: (path: string, node: TscnNode) => void;
  onOpenSubScene?: (scenePath: string) => void;
}) {
  // When `error` is truthy, mounting `<SceneTreeViewer>` with a null
  // sceneGraph triggers its own "Loading scene…" empty-state — which
  // makes the tree pane look stuck (Gap 7). Use a dedicated empty-state
  // message in the tree pane so the user knows the load failed and the
  // banner above is the actionable surface.
  let treeBody: ReactNode;
  if (error) {
    treeBody = (
      <div className={styles.emptyState}>
        No scene loaded — fix the parse error above to continue.
      </div>
    );
  } else if (sceneGraph === null) {
    treeBody = <div className={styles.loading}>Loading scene…</div>;
  } else {
    treeBody = (
      <Suspense
        fallback={
          <div className={styles.loading} aria-busy="true">
            Loading tree…
          </div>
        }
      >
        <SceneTreeViewer onNodeReveal={onNodeReveal} onOpenSubScene={onOpenSubScene} />
      </Suspense>
    );
  }

  return (
    <div className={styles.masterPane} style={{ flexGrow: treeShare }}>
      <div className={styles.dockHeader}>
        <span className={styles.dockTitle}>Scene Tree</span>
        <SceneNodeCount />
        <span className={styles.dockSpacer} />
        <button
          type="button"
          className={styles.collapseButton}
          onClick={onCollapse}
          title="Collapse the side panel"
          aria-label="Collapse the side panel"
        >
          ›
        </button>
      </div>
      <div className={styles.dockBody}>
        <div className={styles.treePane}>{treeBody}</div>
      </div>
    </div>
  );
}
