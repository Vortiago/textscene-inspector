/**
 * Composition root for a single TSCN preview panel.
 *
 * Owns the provider stack and the layout: canvas alongside a single right
 * "Split Dock" (ADR-0007) — a master scene tree on top and a tabbed detail
 * (Inspector / Resources / Cameras) directly below, so selecting a node
 * surfaces its properties with no tab hop. No left rail — the VS Code webview
 * already sits right of VS Code's own activity bar + Explorer, so a left rail
 * would clash and waste width.
 *
 * The pieces live in sibling files: parse pipeline in `useParsedScene`,
 * viewport switching in `ViewportArea`, the 2D stage in `Canvas2DStage`,
 * plus `CamerasPanel`, `SceneStats`, `DockChrome`, `SceneChangeResetter`.
 */
import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { TscnNode } from '../../../parser/types.js';
import { HierarchyProvider } from '../../contexts/HierarchyContext.js';
import { SelectionProvider } from '../../contexts/SelectionContext.js';
import { CameraControlProvider } from '../../contexts/CameraControlContext.js';
import { MissingResourcesProvider } from '../../contexts/MissingResourcesContext.js';
import { ViewportModeProvider } from '../../contexts/ViewportModeContext.js';
import { AnimatedValueProvider } from '../../contexts/AnimatedValueContext.js';
import {
  AnimationTransportProvider,
  useAnimationTransport,
} from '../../contexts/AnimationTransportContext.js';
import { AnimationPanel } from '../AnimationPanel/AnimationPanel.js';
import { useParsedScene } from '../../hooks/useParsedScene.js';
import { MissingResourcesPanel } from '../MissingResourcesPanel/MissingResourcesPanel.js';
import { ViewportToolbar } from '../ViewportToolbar/ViewportToolbar.js';
import { Splitter } from '../Splitter/Splitter.js';
import { ViewportArea } from './ViewportArea.js';
import { CamerasPanel } from './CamerasPanel.js';
import { SceneChangeResetter } from './SceneChangeResetter.js';
import { WorkspaceAutoSelect } from './WorkspaceAutoSelect.js';
import { SceneStats, SceneNodeCount } from './SceneStats.js';
import { MasterDetailHandle, CollapsedDock } from './DockChrome.js';
import styles from './TscnPreviewShell.module.css';

// WI-R3F-18 bundle reduction: lazy-load the DOM panels so they don't
// land in the initial canvas-paint bundle. The first frame doesn't
// need either panel — they hydrate after the canvas is up. Each is a
// `React.lazy` of the module's default export; the underlying file
// re-exports the named component as the default to satisfy that
// contract.
const SceneTreeViewer = lazy(() =>
  import('../SceneTreeViewer/SceneTreeViewer.js').then((m) => ({
    default: m.SceneTreeViewer,
  }))
);
const NodeDetailsPanel = lazy(() =>
  import('../NodeDetailsPanel/NodeDetailsPanel.js').then((m) => ({
    default: m.NodeDetailsPanel,
  }))
);

const DEFAULT_ROOT_SCENE_PATH = 'res://__inline__.tscn';

type DetailTab = 'inspector' | 'resources' | 'cameras' | 'animation';

export interface TscnPreviewShellProps {
  /** Stable identifier for this panel — used in logs and for context coordination. */
  panelId: string;
  /** Raw TSCN content. Re-parsed via `useMemo` whenever this changes. */
  content: string;
  /** Optional scene path used as the SceneGraph root. Synthetic default suits inline content. */
  rootScenePath?: string;
  /** Fired when a tree row is double-clicked (host can jump to source). */
  onNodeReveal?: (path: string, node: TscnNode) => void;
  onOpenSubScene?: (scenePath: string) => void;
  /** Optional content to inject in the top bar (e.g. a fixture dropdown). */
  toolbar?: ReactNode;
  /**
   * Fired when the user picks a file for a missing-resource row in the
   * `<MissingResourcesPanel>`. Host wires this into its ResourceProvider
   * + ResourceLoader (typically `provider.addUploadedFile` followed by
   * `loader.provideFile`). When omitted, the panel is suppressed
   * because the host has no way to consume uploads.
   */
  onResourceUpload?: (path: string, file: File) => void;
  /**
   * Fired when the user clicks "Remove" on an uploaded row. Host
   * deletes the file from its provider's cache. When omitted, the
   * Remove button still renders but is a no-op.
   */
  onResourceRemove?: (path: string) => void;
}

export function TscnPreviewShell({
  panelId,
  content,
  rootScenePath = DEFAULT_ROOT_SCENE_PATH,
  onNodeReveal,
  onOpenSubScene,
  toolbar,
  onResourceUpload,
  onResourceRemove,
}: TscnPreviewShellProps) {
  const { sceneGraph, error } = useParsedScene(content, rootScenePath);

  const hierarchyValue = useMemo(
    () => ({ sceneGraph, panelId }),
    [sceneGraph, panelId]
  );

  // Split Dock (ADR-0007): a single resizable + collapsible RIGHT dock holding
  // a master (scene tree) over a tabbed detail. `treeShare` is the master's
  // fraction of the dock height (0..1), dragged via the horizontal handle.
  const [dockWidth, setDockWidth] = useState(320);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [treeShare, setTreeShare] = useState(0.46);
  const [activeTab, setActiveTab] = useState<DetailTab>('inspector');

  // ADR-0012: the Animation tab exists only while an AnimationPlayer is the
  // selected node. `<AnimationTabWatcher>` (inside SelectionProvider) reports
  // that up; selecting a player auto-focuses the tab, deselecting falls back.
  const [animationTabVisible, setAnimationTabVisible] = useState(false);
  useEffect(() => {
    if (animationTabVisible) setActiveTab('animation');
    else setActiveTab((tab) => (tab === 'animation' ? 'inspector' : tab));
  }, [animationTabVisible]);

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
    <HierarchyProvider value={hierarchyValue}>
      <SelectionProvider>
        <CameraControlProvider>
          <MissingResourcesProvider>
            <ViewportModeProvider>
             <AnimationTransportProvider>
              <AnimatedValueProvider>
              <WorkspaceAutoSelect sceneGraph={sceneGraph} />
              <SceneChangeResetter sceneGraph={sceneGraph} />
              <AnimationTabWatcher onVisibleChange={setAnimationTabVisible} />
              <div className={styles.shell} data-panel-id={panelId}>
                <header className={styles.topBar}>
                  <span className={styles.brand}>TextScene Inspector</span>
                  {toolbar && <div className={styles.topToolbar}>{toolbar}</div>}
                  <div className={styles.topSpacer} />
                  <SceneStats />
                  <ViewportToolbar />
                </header>
                {error && (
                  <div className={styles.errorBanner} role="alert">
                    <strong>Parse error:</strong> {error}
                  </div>
                )}
                <div className={styles.columns}>
                  {/* CENTER — 3D canvas or 2D overlay; takes all width left of the dock. */}
                  <main className={styles.center} aria-label="Viewport">
                    <ViewportArea sceneGraph={sceneGraph} />
                  </main>

                  {/* RIGHT DOCK — Split Dock: scene tree (master) over a tabbed detail. */}
                  {dockCollapsed ? (
                    <CollapsedDock onExpand={() => setDockCollapsed(false)} />
                  ) : (
                    <>
                      <Splitter
                        width={dockWidth}
                        setWidth={setDockWidth}
                        invert
                        label="Resize the side panel"
                      />
                      <section
                        className={styles.dock}
                        style={{ flexBasis: dockWidth }}
                        aria-label="Scene and Inspector"
                      >
                        {/* MASTER — scene tree */}
                        <div className={styles.masterPane} style={{ flexGrow: treeShare }}>
                          <div className={styles.dockHeader}>
                            <span className={styles.dockTitle}>Scene Tree</span>
                            <SceneNodeCount />
                            <span className={styles.dockSpacer} />
                            <button
                              type="button"
                              className={styles.collapseButton}
                              onClick={() => setDockCollapsed(true)}
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

                        <MasterDetailHandle value={treeShare} setValue={setTreeShare} />

                        {/* DETAIL — tabbed; Inspector follows selection (no tab hop). */}
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
                      </section>
                    </>
                  )}
                </div>
              </div>
              </AnimatedValueProvider>
             </AnimationTransportProvider>
            </ViewportModeProvider>
          </MissingResourcesProvider>
        </CameraControlProvider>
      </SelectionProvider>
    </HierarchyProvider>
  );
}

/**
 * Effect-only child (inside AnimationTransportProvider): reports whether an
 * AnimationPlayer is registered with the transport — the render-time source of
 * truth for Animation-tab visibility (ADR-0012). Registration follows tree
 * selection and covers instanced players, which never reach the parse-time
 * `flattenedNodes`.
 */
function AnimationTabWatcher({ onVisibleChange }: { onVisibleChange: (visible: boolean) => void }) {
  const { hasPlayer } = useAnimationTransport();
  useEffect(() => {
    onVisibleChange(hasPlayer);
  }, [hasPlayer, onVisibleChange]);
  return null;
}
