/**
 * Composition root for a single TSCN preview panel.
 *
 * Owns the parse pipeline (`TscnParser` + `SceneGraphBuilder`), provides
 * the two per-panel contexts (`<HierarchyProvider>` + `<SelectionProvider>`),
 * and lays out the canvas alongside the tree + details sidebar.
 *
 * Replaces the imperative `packages/textscene-core/src/ui/TscnPreviewUI.ts`.
 */
import { useMemo, type ReactNode } from 'react';
import { TscnParser } from '../../../parser/TscnParser.js';
import { SceneGraphBuilder } from '../../../core/SceneGraphBuilder.js';
import { tscnSceneToParsedScene } from '../../../core/SceneGraph.js';
import type { SceneGraph } from '../../../core/SceneGraph.js';
import type { TscnNode } from '../../../parser/types.js';
import { HierarchyProvider } from '../../contexts/HierarchyContext.js';
import { SelectionProvider } from '../../contexts/SelectionContext.js';
import { CameraControlProvider } from '../../contexts/CameraControlContext.js';
import { TscnCanvas } from '../../TscnCanvas.js';
import { SceneTreeViewer } from '../SceneTreeViewer/SceneTreeViewer.js';
import { NodeDetailsPanel } from '../NodeDetailsPanel/NodeDetailsPanel.js';
import styles from './TscnPreviewShell.module.css';

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
}: TscnPreviewShellProps) {
  const { sceneGraph, error } = useMemo(
    () => parseContent(content, rootScenePath),
    [content, rootScenePath]
  );

  const hierarchyValue = useMemo(
    () => ({ sceneGraph, panelId }),
    [sceneGraph, panelId]
  );

  return (
    <HierarchyProvider value={hierarchyValue}>
      <SelectionProvider>
        <CameraControlProvider>
        <div className={styles.shell} data-panel-id={panelId}>
          {toolbar}
          {error && (
            <div className={styles.errorBanner} role="alert">
              <strong>Parse error:</strong> {error}
            </div>
          )}
          <div className={styles.body}>
            <div className={styles.canvas}>
              <TscnCanvas />
            </div>
            <aside className={styles.sidebar} aria-label="Scene details">
              <div className={styles.treePane}>
                {sceneGraph === null && !error ? (
                  <div className={styles.loading}>Loading scene…</div>
                ) : (
                  <SceneTreeViewer onNodeReveal={onNodeReveal} />
                )}
              </div>
              <div className={styles.detailsPane}>
                <NodeDetailsPanel />
              </div>
            </aside>
          </div>
        </div>
        </CameraControlProvider>
      </SelectionProvider>
    </HierarchyProvider>
  );
}
