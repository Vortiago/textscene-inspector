/**
 * The composition root of one preview panel: the canvas beside one right
 * Split Dock (ADR-0007), the scene tree over a tabbed detail pane. There is no
 * left rail, since the VS Code webview already sits right of the activity bar.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  FRAME_ON_OPEN_STORAGE_KEY,
  SHOW_GRID_STORAGE_KEY,
  VIEWPORT_MODE_STORAGE_KEY,
  type ViewportMode,
} from '../../contexts/ViewportModeContext.js';
import { readPersisted, usePersistedState } from '../../hooks/usePersistedState.js';
import { useParsedScene } from '../../hooks/useParsedScene.js';
import { ViewportToolbar } from '../ViewportToolbar/ViewportToolbar.js';
import { Splitter } from '../Splitter/Splitter.js';
import { ViewportArea } from './ViewportArea.js';
import { PreviewErrorBoundary } from './PreviewErrorBoundary.js';
import { EscapeDeselect } from './EscapeDeselect.js';
import { SceneChangeResetter } from './SceneChangeResetter.js';
import { WorkspaceAutoSelect } from './WorkspaceAutoSelect.js';
import { SceneStats } from './SceneStats.js';
import { MasterDetailHandle, CollapsedDock } from './DockChrome.js';
import { HelpLink } from './HelpLink.js';
import { AnimationTabWatcher } from './AnimationTabWatcher.js';
import { DetailTabs, type DetailTab } from './DetailTabs.js';
import { SceneTreePane } from './SceneTreePane.js';
import { previewShellProviders } from './previewShellProviders.js';
import type { TscnPreviewShellProps } from './previewShellProps.js';
import styles from './TscnPreviewShell.module.css';

export type { TscnPreviewShellProps } from './previewShellProps.js';

const DEFAULT_ROOT_SCENE_PATH = 'res://__inline__.tscn';

// A persisted value of an unexpected shape falls back to the hook's default.
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}
function isViewportMode(value: unknown): value is ViewportMode {
  return value === '2D' || value === '3D';
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
  onMissingPathsChange,
  initialViewportMode,
  initialActiveCameraPath,
}: TscnPreviewShellProps) {
  const { sceneGraph, error } = useParsedScene(content, rootScenePath);

  const hierarchyValue = useMemo(
    () => ({ sceneGraph, panelId }),
    [sceneGraph, panelId]
  );

  // `treeShare` is the tree's fraction of the dock height (0..1). The dock
  // layout persists across sessions, a VS Code webview being a browser too.
  const [dockWidth, setDockWidth] = usePersistedState('tsi.dockWidth', 320, isFiniteNumber);
  const [dockCollapsed, setDockCollapsed] = usePersistedState('tsi.dockCollapsed', false, isBoolean);
  const [treeShare, setTreeShare] = usePersistedState('tsi.treeShare', 0.46, isFiniteNumber);
  const [activeTab, setActiveTab] = useState<DetailTab>('inspector');

  // ADR-0012: the Animation tab exists only while an AnimationPlayer is selected.
  // A selected player focuses the tab.
  const [animationTabVisible, setAnimationTabVisible] = useState(false);
  useEffect(() => {
    if (animationTabVisible) setActiveTab('animation');
    else setActiveTab((tab) => (tab === 'animation' ? 'inspector' : tab));
  }, [animationTabVisible]);

  // Read once to seed the provider, which holds the live value. Only the
  // toolbar's click handlers write back, so a programmatic mode change never
  // persists.
  const [initialViewport] = useState(() => ({
    mode: readPersisted<ViewportMode>(VIEWPORT_MODE_STORAGE_KEY, '3D', isViewportMode),
    showGrid: readPersisted(SHOW_GRID_STORAGE_KEY, false, isBoolean),
    frameOnOpen: readPersisted(FRAME_ON_OPEN_STORAGE_KEY, false, isBoolean),
  }));

  const withProviders = previewShellProviders({
    hierarchyValue,
    initialActiveCameraPath,
    onMissingPathsChange,
    initialViewportMode,
    initialViewport,
    panelId,
    rootScenePath,
  });

  return withProviders(
    <>
      {/* A host-forced mode turns auto-select off, or the root's claim overrides it. */}
      {initialViewportMode === undefined && (
        <WorkspaceAutoSelect sceneGraph={sceneGraph} />
      )}
      <SceneChangeResetter sceneGraph={sceneGraph} />
      <AnimationTabWatcher onVisibleChange={setAnimationTabVisible} />
      <EscapeDeselect />
      <div className={styles.shell} data-panel-id={panelId}>
        <header className={styles.topBar}>
          <span className={styles.brand}>TextScene Inspector</span>
          {toolbar && <div className={styles.topToolbar}>{toolbar}</div>}
          <div className={styles.topSpacer} />
          <SceneStats />
          <HelpLink />
        </header>
        {error && (
          <div className={styles.errorBanner} role="alert">
            <strong>Parse error:</strong> {error}
          </div>
        )}
        <div className={styles.columns}>
          {/* The 3D canvas or the 2D overlay takes all width left of the dock. */}
          <main className={styles.center} aria-label="Viewport">
            {/* Over the viewport, not the header: .viewportToolbarOverlay says why. */}
            <div className={styles.viewportToolbarOverlay} data-testid="viewport-toolbar-overlay">
              <ViewportToolbar />
            </div>
            <PreviewErrorBoundary sceneGraph={sceneGraph}>
              <ViewportArea sceneGraph={sceneGraph} />
            </PreviewErrorBoundary>
          </main>

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
                style={{ '--tsi-dock-basis': `${dockWidth}px` } as CSSProperties}
                aria-label="Scene and Inspector"
              >
                <SceneTreePane
                  sceneGraph={sceneGraph}
                  error={error}
                  treeShare={treeShare}
                  onCollapse={() => setDockCollapsed(true)}
                  onNodeReveal={onNodeReveal}
                  onOpenSubScene={onOpenSubScene}
                />

                <MasterDetailHandle value={treeShare} setValue={setTreeShare} />

                <DetailTabs
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  animationTabVisible={animationTabVisible}
                  treeShare={treeShare}
                  onResourceUpload={onResourceUpload}
                  onResourceRemove={onResourceRemove}
                />
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
