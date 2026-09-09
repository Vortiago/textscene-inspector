/**
 * The Split Dock's detail pane (ADR-0007): a tab strip over Inspector /
 * Resources / Cameras / Animation. The Inspector follows selection, so it stays
 * mounted and is hidden rather than unmounted — no tab hop when the user picks
 * a node.
 */

import { lazy, Suspense } from 'react';
import { AnimationPanel } from '../AnimationPanel/AnimationPanel.js';
import { MissingResourcesPanel } from '../MissingResourcesPanel/MissingResourcesPanel.js';
import { CamerasPanel } from './CamerasPanel.js';
import styles from './TscnPreviewShell.module.css';

// Bundle reduction: lazy-load the DOM panel so it doesn't land in the initial
// canvas-paint bundle. The first frame doesn't need it — it hydrates after the
// canvas is up. A `React.lazy` of the module's default export; the underlying
// file re-exports the named component as the default to satisfy that contract.
const NodeDetailsPanel = lazy(() =>
  import('../NodeDetailsPanel/NodeDetailsPanel.js').then((m) => ({
    default: m.NodeDetailsPanel,
  }))
);

export type DetailTab = 'inspector' | 'resources' | 'cameras' | 'animation';

export function DetailTabs({
  activeTab,
  setActiveTab,
  animationTabVisible,
  treeShare,
  onResourceUpload,
  onResourceRemove,
}: {
  activeTab: DetailTab;
  setActiveTab: (tab: DetailTab) => void;
  /** ADR-0012: the Animation tab exists only while an AnimationPlayer is selected. */
  animationTabVisible: boolean;
  /** The master's fraction of the dock height; this pane takes the rest. */
  treeShare: number;
  onResourceUpload?: (path: string, file: File) => void;
  onResourceRemove?: (path: string) => void;
}) {
  return (
    <div className={styles.detailPane} style={{ flexGrow: 1 - treeShare }}>
      <div className={styles.paneTabs} role="tablist" aria-label="Detail panels">
        {(
          [
            ['inspector', 'Inspector'],
            ['resources', 'Resources'],
            ['cameras', 'Cameras'],
            ...(animationTabVisible
              ? ([['animation', 'Animation']] as Array<[DetailTab, string]>)
              : []),
          ] as Array<[DetailTab, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={
              activeTab === id
                ? `${styles.paneTab} ${styles.paneTabActive}`
                : styles.paneTab
            }
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={styles.dockBody}>
        <div className={styles.detailsPane} hidden={activeTab !== 'inspector'}>
          <Suspense
            fallback={
              <div className={styles.loading} aria-busy="true">
                Loading details…
              </div>
            }
          >
            <NodeDetailsPanel />
          </Suspense>
        </div>
        {activeTab === 'resources' && (
          <div className={styles.detailsPane}>
            {onResourceUpload ? (
              <MissingResourcesPanel
                onUpload={onResourceUpload}
                onRemove={onResourceRemove ?? (() => {})}
              />
            ) : (
              <div className={styles.emptyState}>
                Resource uploads aren’t available in this host.
              </div>
            )}
          </div>
        )}
        {activeTab === 'cameras' && (
          <div className={styles.detailsPane}>
            <CamerasPanel />
          </div>
        )}
        {animationTabVisible && activeTab === 'animation' && (
          <div className={styles.detailsPane}>
            <AnimationPanel />
          </div>
        )}
      </div>
    </div>
  );
}
