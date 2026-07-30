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
import {
  ViewportModeProvider,
  FRAME_ON_OPEN_STORAGE_KEY,
  SHOW_GRID_STORAGE_KEY,
  VIEWPORT_MODE_STORAGE_KEY,
  USE_NATIVE_CONTROLS_STORAGE_KEY,
  type ViewportMode,
} from '../../contexts/ViewportModeContext.js';
import { readPersisted, usePersistedState } from '../../hooks/usePersistedState.js';
import { AnimatedValueProvider } from '../../contexts/AnimatedValueContext.js';
import { AnimationDriverProvider } from '../../contexts/AnimationDriverContext.js';
import { ViewportTextureProvider } from '../../contexts/ViewportTextureContext.js';
import { ViewportRectProvider } from '../../contexts/ViewportRectContext.js';
import { ProjectSettingsProvider } from '../../contexts/ProjectSettingsContext.js';
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
import { PreviewErrorBoundary } from './PreviewErrorBoundary.js';
import { EscapeDeselect } from './EscapeDeselect.js';
import { composeProviders } from '../../composeProviders.js';
import { CamerasPanel } from './CamerasPanel.js';
import { SceneChangeResetter } from './SceneChangeResetter.js';
import { WorkspaceAutoSelect } from './WorkspaceAutoSelect.js';
import { SceneStats, SceneNodeCount } from './SceneStats.js';
import { MasterDetailHandle, CollapsedDock } from './DockChrome.js';
import { HelpLink } from './HelpLink.js';
import styles from './TscnPreviewShell.module.css';

// Bundle reduction: lazy-load the DOM panels so they don't
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
  /**
   * Observer for the shell's live missing-resources set — fired after mount
   * and after every change. The explicit surface for host code that lives
   * OUTSIDE the shell (e.g. a page-level drop handler matching dropped files
   * against currently-missing paths) to read the set the shell aggregates.
   */
  onMissingPathsChange?: (paths: ReadonlySet<string>) => void;
  /**
   * Host-provided viewport-mode override (VS Code's `textscene.defaultViewportMode`
   * setting). Omitted (the default) preserves Godot-editor parity: `WorkspaceAutoSelect`
   * (ADR-0006) picks 2D/3D from the scene root's node type. An explicit mode both seeds
   * the initial viewport AND suppresses that auto-select for this panel — otherwise a
   * typed root's own claim would immediately override the host's forced choice, making
   * the setting silently useless for the vast majority of real scenes. A manual toolbar
   * toggle still works afterward in either case.
   */
  initialViewportMode?: ViewportMode;
  /**
   * A Camera3D node path to activate on open (the web previewer resolves it from
   * the `?camera=` query param). Threaded into `<CameraControlProvider>`, which
   * seeds the active camera so the canvas looks through it once the scene loads.
   * Omitted (the default) opens in free-orbit. Hosts without a URL (the VS Code
   * webview) simply never pass it.
   */
  initialActiveCameraPath?: string | null;
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
    useNativeControls: readPersisted(USE_NATIVE_CONTROLS_STORAGE_KEY, false, isBoolean),
  }));

  // Flattens what was an 8-level hand-nested provider pyramid into one
  // call. Each entry still mounts its own INDEPENDENT provider, in the SAME
  // order as before — composeProviders only removes the JSX-nesting
  // boilerplate; ADR-0002 (and its per-domain-UI-state analogues here) keeps
  // these contexts separate on purpose, so this is not a merge.
  const withProviders = composeProviders(
    (children) => <HierarchyProvider value={hierarchyValue}>{children}</HierarchyProvider>,
    (children) => <SelectionProvider>{children}</SelectionProvider>,
    (children) => (
      <CameraControlProvider initialActiveCameraPath={initialActiveCameraPath}>
        {children}
      </CameraControlProvider>
    ),
    (children) => (
      <MissingResourcesProvider onMissingPathsChange={onMissingPathsChange}>
        {children}
      </MissingResourcesProvider>
    ),
    (children) => (
      // A host-forced `initialViewportMode` (e.g. the VS Code extension's
      // `textscene.defaultViewportMode` setting) wins over whatever was
      // persisted from a prior session.
      <ViewportModeProvider
        initialMode={initialViewportMode ?? initialViewport.mode}
        initialShowGrid={initialViewport.showGrid}
        initialFrameOnOpen={initialViewport.frameOnOpen}
        initialUseNativeControls={initialViewport.useNativeControls}
      >
        {children}
      </ViewportModeProvider>
    ),
    (children) => <AnimationTransportProvider>{children}</AnimationTransportProvider>,
    (children) => <AnimationDriverProvider>{children}</AnimationDriverProvider>,
    // Same reason as the driver registry directly above: a `<SubViewport>`
    // publishes its offscreen target here and a `ViewportTexture` consumer
    // resolves it by NodePath. It wraps BOTH canvases and the DOM overlay
    // because consumers live on both sides of that split (ADR-0030).
    (children) => <ViewportTextureProvider>{children}</ViewportTextureProvider>,
    // The return leg of the same seam: a stretching SubViewportContainer
    // measures its own DOM box and the publisher sizes the target from it,
    // because Godot's `recalc_force_viewport_sizes` makes the CONTAINER's rect
    // the viewport's size. Wraps both canvases and the overlay for the same
    // reason the texture registry does — the two ends live on either side.
    (children) => <ViewportRectProvider>{children}</ViewportRectProvider>,
    (children) => <AnimatedValueProvider>{children}</AnimatedValueProvider>,
    // The scene's `project.godot`. Outermost of the Control-facing providers
    // because BOTH consumers of the theme scale sit under it — the on-screen
    // overlay in `<Canvas2DStage>` and the off-screen `<ControlRasterHosts>`,
    // which `<ViewportArea>` mounts side by side.
    //
    // The key carries `panelId` as well as the scene's res:// identity because
    // `rootScenePath` is relative to the **Corpus root**: two vendored projects
    // can each hold a `res://main.tscn`, and on that swap the path alone would
    // not change, so the settings would stay the outgoing project's while the
    // byte layer had already been cleared for the incoming one.
    (children) => (
      <ProjectSettingsProvider sceneKey={`${panelId} ${rootScenePath}`}>
        {children}
      </ProjectSettingsProvider>
    )
  );

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
    </>
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
