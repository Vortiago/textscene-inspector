/**
 * The composition root of one preview panel: the canvas beside one right
 * Split Dock (ADR-0007), the scene tree over a tabbed detail pane. There is no
 * left rail, since the VS Code webview already sits right of the activity bar.
 * A narrow panel turns the dock into a bottom sheet that shows one half at a time
 * (ADR-0048).
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  DEFAULT_VIEWPORT,
  FRAME_ON_OPEN_STORAGE_KEY,
  SHOW_STORAGE_KEYS,
  VIEWPORT_MODE_STORAGE_KEY,
  type PersistedShowKey,
  type PersistedViewport,
  type ViewportMode,
} from '../../contexts/ViewportModeContext.js';
import { readPersisted, usePersistedState } from '../../hooks/usePersistedState.js';
import { DEFAULT_SHOW } from '../../viewShow/viewShow.js';
import { useSceneGraphs } from '../../hooks/useSceneGraphs.js';
import { ViewportToolbar } from '../ViewportToolbar/ViewportToolbar.js';
import { Splitter } from '../Splitter/Splitter.js';
import { ViewportArea } from './ViewportArea.js';
import { PreviewErrorBoundary } from './PreviewErrorBoundary.js';
import { EscapeDeselect } from './EscapeDeselect.js';
import { SceneChangeResetter } from './SceneChangeResetter.js';
import { WorkspaceAutoSelect } from './WorkspaceAutoSelect.js';
import { SceneStats } from './SceneStats.js';
import { SceneLoadStatus } from './SceneLoadStatus.js';
import { TextureWorkStatus } from './TextureWorkStatus.js';
import { SoftwareRenderingStatus } from '../../softwareRendering/SoftwareRenderingStatus.js';
import {
  CollapsedDock,
  isNarrowPane,
  isSheetShare,
  MasterDetailHandle,
  NarrowPaneSwitcher,
  SheetHandle,
} from './DockChrome.js';
import { HelpLink } from './HelpLink.js';
import { AnimationTabWatcher } from './AnimationTabWatcher.js';
import { DetailTabs, type DetailTab } from './DetailTabs.js';
import { SceneTreePane } from './SceneTreePane.js';
import { previewShellProviders } from './previewShellProviders.js';
import { useSceneLoader } from '../../sceneResourcePipeline.js';
import { CaptureStateReporter } from './CaptureStateReporter.js';
import { PreviewCameraProvider } from './previewCamera.js';
import { useViewSettle } from './viewSettle.js';
import type { ViewAnswers } from '../../viewStatus/viewAnswers.js';
import type { TscnPreviewShellProps } from './previewShellProps.js';
import styles from './TscnPreviewShell.module.css';

export type { TscnPreviewShellProps } from './previewShellProps.js';

// A persisted value of an unexpected shape falls back to the hook's default.
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}
function isViewportMode(value: unknown): value is ViewportMode {
  return value === '2D' || value === '3D' || value === 'in-game';
}

export function TscnPreviewShell({
  panelId,
  scene,
  onNodeReveal,
  onOpenSubScene,
  toolbar,
  onResourceUpload,
  onResourceRemove,
  initialViewportMode,
  initialPreviewedCameraPath,
  onCaptureStateChange,
  isVisible,
  onCopyNodePath,
}: TscnPreviewShellProps) {
  const { parsed, sceneGraph } = useSceneGraphs(scene);
  const { sceneGraph: parsedGraph, error } = parsed;

  const hierarchyValue = useMemo(() => ({ sceneGraph, panelId, scene }), [sceneGraph, panelId, scene]);
  const [viewportError, setViewportError] = useState<Error | null>(null);
  const [view, setView] = useState<ViewAnswers | null>(null);
  const settle = useViewSettle(scene, view);
  const hasScene = parsedGraph !== null;

  // `treeShare` is the tree's fraction of the dock height (0..1). The dock
  // layout persists across sessions, a VS Code webview being a browser too.
  const [dockWidth, setDockWidth] = usePersistedState('tsi.dockWidth', 320, isFiniteNumber);
  const [dockCollapsed, setDockCollapsed] = usePersistedState('tsi.dockCollapsed', false, isBoolean);
  const [treeShare, setTreeShare] = usePersistedState('tsi.treeShare', 0.46, isFiniteNumber);
  // The narrow layout's own geometry: the sheet's share of the column, and the half it shows.
  const [sheetShare, setSheetShare] = usePersistedState('tsi.sheetShare', 0.45, isSheetShare);
  const [narrowPane, setNarrowPane] = usePersistedState('tsi.narrowPane', 'tree', isNarrowPane);
  const [activeTab, setActiveTab] = useState<DetailTab>('inspector');
  const collapseDock = () => setDockCollapsed(true);

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
  const [initialViewport] = useState<PersistedViewport>(() => ({
    mode: readPersisted<ViewportMode>(VIEWPORT_MODE_STORAGE_KEY, DEFAULT_VIEWPORT.mode, isViewportMode),
    show: Object.fromEntries(
      Object.entries(SHOW_STORAGE_KEYS).map(([key, storageKey]) => [
        key,
        readPersisted(storageKey, DEFAULT_SHOW[key as PersistedShowKey], isBoolean),
      ])
    ),
    frameOnOpen: readPersisted(FRAME_ON_OPEN_STORAGE_KEY, DEFAULT_VIEWPORT.frameOnOpen, isBoolean),
  }));

  const withProviders = previewShellProviders({
    hierarchyValue,
    loader: useSceneLoader(scene),
    initialViewportMode,
    initialViewport,
    isVisible,
    panelId,
    rootScenePath: scene.rootScenePath,
  });

  return withProviders(
    <PreviewCameraProvider scene={scene} initialCamera={initialPreviewedCameraPath}>
      {/* A host-forced mode turns auto-select off, or the root's claim overrides it. */}
      {initialViewportMode === undefined && <WorkspaceAutoSelect scene={scene} />}
      <SceneChangeResetter sceneGraph={parsedGraph} />
      <AnimationTabWatcher onVisibleChange={setAnimationTabVisible} />
      <CaptureStateReporter
        onCaptureStateChange={onCaptureStateChange}
        view={view}
        settle={settle}
        hasScene={hasScene}
        viewportError={viewportError}
      />
      <EscapeDeselect />
      <div className={styles.shell} data-panel-id={panelId}>
        <header className={styles.topBar}>
          <span className={styles.brand}>TextScene Inspector</span>
          {toolbar && <div className={styles.topToolbar}>{toolbar}</div>}
          <div className={styles.topSpacer} />
          <SceneLoadStatus settle={settle} hasScene={hasScene} viewportError={viewportError} />
          <TextureWorkStatus />
          <SoftwareRenderingStatus />
          <SceneStats scene={scene} />
          <HelpLink />
        </header>
        {error && (
          <div className={styles.errorBanner} role="alert">
            <strong>Parse error:</strong> {error}
          </div>
        )}
        <div className={styles.columns}>
          {/* The view takes all width left of the dock, in every mode. */}
          <main className={styles.center} aria-label="Viewport">
            {/* Over the viewport, not the header: .viewportToolbarOverlay says why. */}
            <div className={styles.viewportToolbarOverlay} data-testid="viewport-toolbar-overlay">
              <ViewportToolbar view={view} />
            </div>
            <PreviewErrorBoundary sceneGraph={sceneGraph} onViewportErrorChange={setViewportError}>
              <ViewportArea viewRef={setView} />
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
                className={styles.wideOnly}
              />
              <section
                className={styles.dock}
                style={
                  {
                    '--tsi-dock-basis': `${dockWidth}px`,
                    '--tsi-sheet-basis': `${sheetShare * 100}%`,
                  } as CSSProperties
                }
                aria-label="Scene and Inspector"
                data-narrow-pane={narrowPane}
              >
                <SheetHandle value={sheetShare} setValue={setSheetShare} />
                <NarrowPaneSwitcher pane={narrowPane} setPane={setNarrowPane} onCollapse={collapseDock} />
                <SceneTreePane
                  scene={scene}
                  sceneGraph={sceneGraph}
                  error={error}
                  treeShare={treeShare}
                  onCollapse={collapseDock}
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
                  onCopyNodePath={onCopyNodePath}
                />
              </section>
            </>
          )}
        </div>
      </div>
    </PreviewCameraProvider>
  );
}
