/**
 * The Split Dock's detail pane (ADR-0007): tabs for Inspector, Resources,
 * Cameras and Animation. The Inspector follows the selection, so it hides
 * instead of unmounting.
 */

import { lazy, Suspense } from 'react';
import { AnimationPanel } from '../AnimationPanel/AnimationPanel.js';
import { MissingResourcesPanel } from '../MissingResourcesPanel/MissingResourcesPanel.js';
import { CamerasPanel } from './CamerasPanel.js';
import styles from './TscnPreviewShell.module.css';

// Lazy, so the panel stays out of the first canvas-paint bundle. `React.lazy`
// takes a default export, so the `.then` maps the named export to one.
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
  /** The tree's fraction of the dock height. This pane takes the rest. */
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
