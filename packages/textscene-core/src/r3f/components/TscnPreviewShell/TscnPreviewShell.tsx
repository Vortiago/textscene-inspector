/**
 * Composition root for a single TSCN preview panel.
 *
 * Owns the parse pipeline (`TscnParser` + `SceneGraphBuilder`), provides
 * the per-panel contexts, and lays out the canvas alongside a single right
 * "Split Dock" (ADR-0007): a master scene tree on top and a tabbed detail
 * (Inspector / Resources / Cameras) directly below, so selecting a node
 * surfaces its properties with no tab hop. No left rail — the VS Code webview
 * already sits right of VS Code's own activity bar + Explorer, so a left rail
 * would clash and waste width.
 *
 * Replaces the imperative `packages/textscene-core/src/ui/TscnPreviewUI.ts`.
 */
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { TscnParser } from '../../../parser/TscnParser.js';
import { SceneGraphBuilder } from '../../../core/SceneGraphBuilder.js';
import { tscnSceneToParsedScene } from '../../../core/SceneGraph.js';
import type { SceneGraph } from '../../../core/SceneGraph.js';
import type {
  TscnNode,
  TscnExternalResource,
  TscnInternalResource,
} from '../../../parser/types.js';
import { HierarchyProvider, useHierarchy } from '../../contexts/HierarchyContext.js';
import { SelectionProvider, useSelection } from '../../contexts/SelectionContext.js';
import {
  CameraControlProvider,
  useOptionalCameraControl,
} from '../../contexts/CameraControlContext.js';
import { MissingResourcesProvider } from '../../contexts/MissingResourcesContext.js';
import { ViewportModeProvider, useViewportMode } from '../../contexts/ViewportModeContext.js';
import { has2DUIContent } from '../../controls/has2DUIContent.js';
import { TscnCanvas } from '../../TscnCanvas.js';
import { MissingResourcesPanel } from '../MissingResourcesPanel/MissingResourcesPanel.js';
import { ViewportToolbar } from '../ViewportToolbar/ViewportToolbar.js';
import { Splitter } from '../Splitter/Splitter.js';
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
// The 2D-UI overlay (ADR-0003) is only needed in 2D viewport mode, so it's
// lazy-loaded — keeping the 15 Control components + their registrations out of
// the initial canvas-paint bundle. Importing the barrel (`controls/index.js`)
// rather than ControlOverlay.tsx directly is load-bearing: the barrel's
// side-effect imports are what register the Control DOM components.
const ControlOverlay = lazy(() =>
  import('../../controls/index.js').then((m) => ({ default: m.ControlOverlay }))
);

const DEFAULT_ROOT_SCENE_PATH = 'res://__inline__.tscn';

type DetailTab = 'inspector' | 'resources' | 'cameras';

export interface TscnPreviewShellProps {
  /** Stable identifier for this panel — used in logs and for context coordination. */
  panelId: string;
  /** Raw TSCN content. Re-parsed via `useMemo` whenever this changes. */
  content: string;
  /** Optional scene path used as the SceneGraph root. Synthetic default suits inline content. */
  rootScenePath?: string;
  /** Fired when a tree row is double-clicked (host can jump to source). */
  onNodeReveal?: (path: string, node: TscnNode) => void;
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

interface ParseResult {
  sceneGraph: SceneGraph | null;
  error: string | null;
}

function parseContent(content: string, rootScenePath: string): ParseResult {
  if (!content) {
    return { sceneGraph: null, error: null };
  }
  try {
    const parser = new TscnParser();
    const tscnScene = parser.parse(content);

    // The lenient `TscnParser` recovers from most malformed input by
    // returning whatever nodes it could salvage. If the body had any
    // text at all but the parser produced zero root nodes, the file is
    // probably broken — surface that as an error rather than letting
    // the user stare at "No nodes to display" (WI-R3F-7 / WEB-10).
    if (tscnScene.nodes.length === 0 && content.trim().length > 0) {
      return {
        sceneGraph: null,
        error: 'Parser could not extract any nodes from the content. The file may be malformed.',
      };
    }

    const parsedScene = tscnSceneToParsedScene(
      rootScenePath,
      tscnScene.nodes,
      tscnScene.externalResources,
      tscnScene.internalResources
    );
    const sceneGraph = new SceneGraphBuilder()
      .setRootScene(rootScenePath)
      .addScene(parsedScene)
      .build();
    return { sceneGraph, error: null };
  } catch (err) {
    return {
      sceneGraph: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function TscnPreviewShell({
  panelId,
  content,
  rootScenePath = DEFAULT_ROOT_SCENE_PATH,
  onNodeReveal,
  toolbar,
  onResourceUpload,
  onResourceRemove,
}: TscnPreviewShellProps) {
  const { sceneGraph, error } = useMemo(
    () => parseContent(content, rootScenePath),
    [content, rootScenePath]
  );

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
        <SceneTreeViewer onNodeReveal={onNodeReveal} />
      </Suspense>
    );
  }

  return (
    <HierarchyProvider value={hierarchyValue}>
      <SelectionProvider>
        <CameraControlProvider>
          <MissingResourcesProvider>
            <ViewportModeProvider>
              <SceneChangeResetter sceneGraph={sceneGraph} />
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
                          </div>
                        </div>
                      </section>
                    </>
                  )}
                </div>
              </div>
            </ViewportModeProvider>
          </MissingResourcesProvider>
        </CameraControlProvider>
      </SelectionProvider>
    </HierarchyProvider>
  );
}

/**
 * The center viewport. Reads `useViewportMode()` and renders either the R3F
 * canvas (3D) or the lazy-loaded 2D Control overlay (2D). In 2D mode it feeds
 * the overlay the root scene's nodes + resources so Control nodes lay out and
 * StyleBox/Texture refs resolve. Lives below `<ViewportModeProvider>` so it can
 * read the mode the toolbar writes.
 */
function ViewportArea({ sceneGraph }: { sceneGraph: SceneGraph | null }) {
  const { mode, setMode } = useViewportMode();
  const rootScene = sceneGraph?.scenes.get(sceneGraph.rootScene);
  const has2DUI = useMemo(() => has2DUIContent(rootScene?.nodes ?? []), [rootScene]);

  if (mode === '2D') {
    return (
      <Canvas2DStage
        nodes={rootScene?.nodes ?? []}
        internalResources={rootScene?.internalResources ?? []}
        externalResources={rootScene?.externalResources ?? []}
      />
    );
  }

  // 3D mode. Default per ADR-0006 is 3D; when the scene also carries 2D-UI
  // (Control/CanvasLayer) nodes, surface a hint so the overlay is discoverable
  // instead of the user staring at a viewport with no visible UI.
  return (
    <>
      <TscnCanvas />
      {has2DUI && (
        <button
          type="button"
          className={styles.viewportHint}
          onClick={() => setMode('2D')}
          title="This scene contains 2D UI — switch to the 2D overlay"
        >
          Contains 2D&nbsp;UI — switch to 2D
        </button>
      )}
    </>
  );
}

// Godot's default 2D project viewport. The 2D canvas frame uses it as a stable
// surface Control nodes anchor to (mirrors how Godot's 2D editor frames a scene),
// rather than the variable viewport-region size the bare overlay filled before.
const CANVAS_2D_WIDTH = 1152;
const CANVAS_2D_HEIGHT = 648;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 4;
const clampZoom = (z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));

/**
 * The 2D viewport (ADR-0007): a pannable/zoomable stage that frames the live
 * `<ControlOverlay>` as a fixed-size canvas — bounds, zoom %, scroll-to-zoom,
 * drag-to-pan — so 2D scenes read as a flat canvas editor, not a 3D viewport
 * showing flat content. The overlay still does the real Control layout; this
 * only adds the canvas chrome around it.
 */
function Canvas2DStage({
  nodes,
  internalResources,
  externalResources,
}: {
  nodes: readonly TscnNode[];
  internalResources: readonly TscnInternalResource[];
  externalResources: readonly TscnExternalResource[];
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Current values mirrored into refs so the non-passive wheel listener (added
  // once) reads fresh state without re-subscribing.
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const panRef = useRef(pan);
  panRef.current = pan;

  const fit = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const margin = 56;
    const z = clampZoom(
      Math.min((r.width - margin) / CANVAS_2D_WIDTH, (r.height - margin) / CANVAS_2D_HEIGHT)
    );
    setZoom(z);
    setPan({
      x: (r.width - CANVAS_2D_WIDTH * z) / 2,
      y: (r.height - CANVAS_2D_HEIGHT * z) / 2,
    });
  }, []);

  // Fit on mount.
  useEffect(() => {
    fit();
  }, [fit]);

  // Wheel-to-zoom, anchored to the cursor. Added as a non-passive native
  // listener so preventDefault actually suppresses page scroll.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      const z = zoomRef.current;
      const p = panRef.current;
      const nz = clampZoom(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
      const cx = (px - p.x) / z;
      const cy = (py - p.y) / z;
      setPan({ x: px - cx * nz, y: py - cy * nz });
      setZoom(nz);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Drag-to-pan. Inline handler captures the current pan as the drag origin.
  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const origin = pan;
    const move = (ev: PointerEvent) => {
      setPan({ x: origin.x + (ev.clientX - startX), y: origin.y + (ev.clientY - startY) });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function zoomAroundCentre(factor: number) {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = r.width / 2;
    const py = r.height / 2;
    const z = zoomRef.current;
    const p = panRef.current;
    const nz = clampZoom(z * factor);
    const cx = (px - p.x) / z;
    const cy = (py - p.y) / z;
    setPan({ x: px - cx * nz, y: py - cy * nz });
    setZoom(nz);
  }

  return (
    <div
      ref={stageRef}
      className={styles.canvasStage}
      onPointerDown={handlePointerDown}
      aria-label="2D canvas"
    >
      <div
        className={styles.canvasFrame}
        style={{
          width: CANVAS_2D_WIDTH,
          height: CANVAS_2D_HEIGHT,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        <span className={styles.canvasDim} aria-hidden>
          {CANVAS_2D_WIDTH} × {CANVAS_2D_HEIGHT}
        </span>
        <Suspense
          fallback={
            <div className={styles.loading} aria-busy="true">
              Loading 2D overlay…
            </div>
          }
        >
          <ControlOverlay
            nodes={nodes}
            internalResources={internalResources}
            externalResources={externalResources}
          />
        </Suspense>
      </div>

      <div className={styles.canvas2dHint}>scroll = zoom · drag = pan</div>

      <div className={styles.zoomHud} role="group" aria-label="Canvas zoom">
        <button type="button" onClick={() => zoomAroundCentre(1 / 1.2)} aria-label="Zoom out">
          −
        </button>
        <span className={styles.zoomVal}>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => zoomAroundCentre(1.2)} aria-label="Zoom in">
          +
        </button>
        <button type="button" className={styles.zoomFit} onClick={fit}>
          Fit
        </button>
      </div>
    </div>
  );
}

/**
 * Compact scene stat chips for the top bar. Each chip's text is a single node
 * (e.g. "4 nodes", "2 cameras") so it never collides with the tree's node-name
 * elements that tests match via `findByText('Root')`.
 */
function SceneStats() {
  const { sceneGraph } = useHierarchy();
  if (sceneGraph === null) return null;
  const nodeCount = sceneGraph.flattenedNodes.length;
  const cameraCount = sceneGraph.flattenedNodes.filter((n) => n.data.type === 'Camera3D').length;
  return (
    <div className={styles.statChips} role="group" aria-label="Scene info">
      <span className={styles.statChip} data-testid="scene-info-nodes">{`${nodeCount} nodes`}</span>
      {cameraCount > 0 && (
        <span className={styles.statChip}>{`${cameraCount} ${cameraCount === 1 ? 'camera' : 'cameras'}`}</span>
      )}
    </div>
  );
}

/** Node-count badge for the Scene Tree dock header. */
function SceneNodeCount() {
  const { sceneGraph } = useHierarchy();
  if (sceneGraph === null) return null;
  return <span className={styles.dockCount}>{sceneGraph.flattenedNodes.length} nodes</span>;
}

/**
 * The "Cameras" detail tab: lists the scene's Camera3D nodes and lets the user
 * make one the active viewport camera (or return to free orbit), via
 * `CameraControlContext`. Mirrors the per-node "Use This Camera" action in the
 * Inspector, surfaced as a flat list so cameras are discoverable without
 * hunting the tree.
 */
function CamerasPanel() {
  const { sceneGraph } = useHierarchy();
  const cam = useOptionalCameraControl();
  const cameras = useMemo(
    () => (sceneGraph?.flattenedNodes ?? []).filter((n) => n.data.type === 'Camera3D'),
    [sceneGraph]
  );

  if (cameras.length === 0) {
    return <div className={styles.emptyState}>No Camera3D nodes in this scene.</div>;
  }

  const activePath = cam?.activeCameraPath ?? null;
  return (
    <div className={styles.camList}>
      <button
        type="button"
        className={styles.camRow}
        data-active={activePath === null}
        onClick={() => cam?.returnToFreeView()}
      >
        <span className={styles.camName}>Free orbit</span>
        <span className={styles.camTag}>{activePath === null ? 'active' : 'use'}</span>
      </button>
      {cameras.map((c) => {
        const active = activePath === c.path;
        return (
          <button
            key={c.path}
            type="button"
            className={styles.camRow}
            data-active={active}
            onClick={() => cam?.switchToCamera(c.path)}
          >
            <span className={styles.camName}>{c.name}</span>
            <span className={styles.camTag}>{active ? 'active' : 'use'}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Draggable horizontal handle splitting the dock's master (tree) and detail
 * sections. Writes `value` = the master's height fraction (0..1), clamped so
 * neither section disappears.
 */
function MasterDetailHandle({
  value,
  setValue,
}: {
  value: number;
  setValue: (v: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const dock = ref.current?.parentElement;
      if (!dock) return;
      const onMove = (ev: PointerEvent) => {
        const rect = dock.getBoundingClientRect();
        if (rect.height <= 0) return;
        const frac = (ev.clientY - rect.top) / rect.height;
        setValue(Math.min(0.8, Math.max(0.2, frac)));
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [setValue]
  );

  return (
    <div
      ref={ref}
      className={styles.masterDetailHandle}
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize the tree and detail sections"
      aria-valuenow={Math.round(value * 100)}
      onPointerDown={onPointerDown}
    />
  );
}

/** A collapsed dock: a thin clickable strip that re-opens the dock. */
function CollapsedDock({ onExpand }: { onExpand: () => void }) {
  return (
    <button
      type="button"
      className={styles.collapsedDock}
      data-side="right"
      onClick={onExpand}
      title="Show the side panel"
      aria-label="Show the side panel"
    >
      <span className={styles.collapsedChevron}>‹</span>
      <span className={styles.collapsedTitle}>Scene</span>
    </button>
  );
}

/**
 * Clears all selection-derived state (selection, hover, expanded set,
 * hidden set, and the path→Object3D ref-map) whenever the active
 * `sceneGraph` reference changes between two non-null values — i.e.
 * the user picked a different fixture.
 *
 * The initial null → first-scene transition is intentionally NOT a
 * clear: there is nothing to clear yet, and firing during mount would
 * just churn React state for no observable effect. Subsequent
 * non-null → non-null transitions ARE clears: the old scene's
 * `selectedNodePath` would otherwise hang around and the
 * `SelectionHighlight` BoxHelper would render against an unmounted
 * Object3D at the prior fixture's coordinates (WI-UX-5 regression).
 *
 * Lives inside `<SelectionProvider>` so it can call `clearAll()`.
 * Renders no DOM.
 */
function SceneChangeResetter({ sceneGraph }: { sceneGraph: SceneGraph | null }) {
  const { clearAll } = useSelection();
  const prevSceneGraphRef = useRef<SceneGraph | null>(sceneGraph);

  useEffect(() => {
    const prev = prevSceneGraphRef.current;
    if (prev !== null && sceneGraph !== null && prev !== sceneGraph) {
      clearAll();
    }
    prevSceneGraphRef.current = sceneGraph;
  }, [sceneGraph, clearAll]);

  return null;
}
