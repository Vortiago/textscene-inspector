/**
 * Composition root for a single TSCN preview panel.
 *
 * Owns the parse pipeline (`TscnParser` + `SceneGraphBuilder`), provides
 * the two per-panel contexts (`<HierarchyProvider>` + `<SelectionProvider>`),
 * and lays out the canvas alongside the tree + details sidebar.
 *
 * Replaces the imperative `packages/textscene-core/src/ui/TscnPreviewUI.ts`.
 */
import { lazy, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { TscnParser } from '../../../parser/TscnParser.js';
import { SceneGraphBuilder } from '../../../core/SceneGraphBuilder.js';
import { tscnSceneToParsedScene } from '../../../core/SceneGraph.js';
import type { SceneGraph } from '../../../core/SceneGraph.js';
import type { TscnNode } from '../../../parser/types.js';
import { HierarchyProvider } from '../../contexts/HierarchyContext.js';
import { SelectionProvider, useSelection } from '../../contexts/SelectionContext.js';
import { CameraControlProvider } from '../../contexts/CameraControlContext.js';
import { MissingResourcesProvider } from '../../contexts/MissingResourcesContext.js';
import { ViewportModeProvider, useViewportMode } from '../../contexts/ViewportModeContext.js';
import { TscnCanvas } from '../../TscnCanvas.js';
import { MissingResourcesPanel } from '../MissingResourcesPanel/MissingResourcesPanel.js';
import { SceneInfoCard } from '../SceneInfoCard/SceneInfoCard.js';
import { ViewportToolbar } from '../ViewportToolbar/ViewportToolbar.js';
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

export interface TscnPreviewShellProps {
  /** Stable identifier for this panel — used in logs and for context coordination. */
  panelId: string;
  /** Raw TSCN content. Re-parsed via `useMemo` whenever this changes. */
  content: string;
  /** Optional scene path used as the SceneGraph root. Synthetic default suits inline content. */
  rootScenePath?: string;
  /** Fired when a tree row is double-clicked (host can jump to source). */
  onNodeReveal?: (path: string, node: TscnNode) => void;
  /** Optional content to inject above the canvas (e.g. a fixture dropdown). */
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
              <div className={styles.toolbarRow}>
                {toolbar}
                <ViewportToolbar />
              </div>
              {error && (
                <div className={styles.errorBanner} role="alert">
                  <strong>Parse error:</strong> {error}
                </div>
              )}
              <div className={styles.body}>
                <div className={styles.canvas}>
                  <ViewportArea sceneGraph={sceneGraph} />
                </div>
                <aside className={styles.sidebar} aria-label="Scene details">
                  <SceneInfoCard />
                  {onResourceUpload && (
                    <MissingResourcesPanel
                      onUpload={onResourceUpload}
                      onRemove={onResourceRemove ?? (() => {})}
                    />
                  )}
                  <div className={styles.treePane}>{treeBody}</div>
                  <div className={styles.detailsPane}>
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
                </aside>
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
  const { mode } = useViewportMode();

  if (mode === '2D') {
    const rootScene = sceneGraph?.scenes.get(sceneGraph.rootScene);
    return (
      <div className={styles.overlayViewport}>
        <Suspense
          fallback={
            <div className={styles.loading} aria-busy="true">
              Loading 2D overlay…
            </div>
          }
        >
          <ControlOverlay
            nodes={rootScene?.nodes ?? []}
            internalResources={rootScene?.internalResources ?? []}
            externalResources={rootScene?.externalResources ?? []}
          />
        </Suspense>
      </div>
    );
  }

  return <TscnCanvas />;
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
