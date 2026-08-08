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
 * The pieces live in sibling files: the host-facing props in
 * `previewShellProps`, the provider stack in `previewShellProviders`, the parse
 * pipeline in `useParsedScene`, viewport switching in `ViewportArea`, the 2D
 * stage in `Canvas2DStage`, the dock's two panes in `SceneTreePane` and
 * `DetailTabs`, plus `CamerasPanel`, `SceneStats`, `DockChrome`,
 * `SceneChangeResetter`.
 */
import { useEffect, useMemo, useState } from 'react';
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

// usePersistedState validators — reject a corrupt/unexpected persisted
// shape (a stale schema, a hand-edited localStorage entry) in favor of the
// hook's own default rather than propagating garbage into layout state.
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

  // Split Dock (ADR-0007): a single resizable + collapsible RIGHT dock holding
  // a master (scene tree) over a tabbed detail. `treeShare` is the master's
  // fraction of the dock height (0..1), dragged via the horizontal handle.
  // Persisted across sessions (host-agnostic — VS Code webviews are a
  // browser context too) so a resized/collapsed dock survives a reload; a
  // fresh session with no persisted value keeps the defaults below.
  const [dockWidth, setDockWidth] = usePersistedState('tsi.dockWidth', 320, isFiniteNumber);
  const [dockCollapsed, setDockCollapsed] = usePersistedState('tsi.dockCollapsed', false, isBoolean);
  const [treeShare, setTreeShare] = usePersistedState('tsi.treeShare', 0.46, isFiniteNumber);
  const [activeTab, setActiveTab] = useState<DetailTab>('inspector');

  // ADR-0012: the Animation tab exists only while an AnimationPlayer is the
  // selected node. `<AnimationTabWatcher>` (inside SelectionProvider) reports
  // that up; selecting a player auto-focuses the tab, deselecting falls back.
  const [animationTabVisible, setAnimationTabVisible] = useState(false);
  useEffect(() => {
    if (animationTabVisible) setActiveTab('animation');
    else setActiveTab((tab) => (tab === 'animation' ? 'inspector' : tab));
  }, [animationTabVisible]);

  // Seed ViewportModeProvider's initial mode/grid from whatever was
  // persisted last session (defaults match the baseline — 3D,
  // grid off — for a fresh session with nothing in localStorage yet).
  // Read ONCE (never-set state): the live value lives in the provider; the
  // toolbar writes an explicit user choice back to storage at its own click
  // handlers — no second React copy of the mode for the shell to re-render
  // over, and no blanket sync that would persist programmatic mode changes.
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
      {/* A host-forced initial mode opts this panel out of Godot-parity
          auto-select entirely — otherwise the scene root's own claim would
          immediately clobber the host's choice on first parse. */}
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
          {/* CENTER — 3D canvas or 2D overlay; takes all width left of the dock. */}
          <main className={styles.center} aria-label="Viewport">
            {/* Floated over the viewport, not the header — see
                .viewportToolbarOverlay in the CSS module for why. */}
            <div className={styles.viewportToolbarOverlay} data-testid="viewport-toolbar-overlay">
              <ViewportToolbar />
            </div>
            <PreviewErrorBoundary sceneGraph={sceneGraph}>
              <ViewportArea sceneGraph={sceneGraph} />
            </PreviewErrorBoundary>
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
