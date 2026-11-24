import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { subscribeToSceneTree } from '../../currentCamera.js';
import { useOptionalHierarchy } from '../../contexts/HierarchyContext.js';
import type { NodeHandle } from '../../../scene/nodeHandle.js';
import type { Scene } from '../../../scene/openScene.js';
import { ROOT_WINDOW_PATH } from '../../../scene/nodePathWalk.js';
import * as logger from '../../../logger.js';
import { useViewportMode } from '../ViewportMode/ViewportModeContext.js';
import styles from './TscnPreviewShell.module.css';

/** CanvasItem content renders only in the 2D workspace, so the 3D one shows a hint. */
export function SwitchTo2DHint() {
  const { setMode } = useViewportMode();
  const has2DContent = useHas2DContent(useOptionalHierarchy()?.scene);
  if (!has2DContent) return null;
  return (
    <button
      type="button"
      className={styles.viewportHint}
      onClick={() => setMode('2D')}
      title="This scene contains 2D content — switch to the 2D view"
    >
      Has 2D&nbsp;content — switch to 2D
    </button>
  );
}

/** False until the reads land. A write moves no class, so only a new text or a new shape reads again. */
function useHas2DContent(scene: Scene | undefined): boolean {
  const observeTree = useCallback((listener: () => void) => subscribeToSceneTree(scene, listener), [scene]);
  const observeParse = useCallback((listener: () => void) => scene?.subscribe(listener) ?? NO_STOP, [scene]);
  const parse = useSyncExternalStore(observeParse, () => scene?.parse() ?? null);
  const shape = useSyncExternalStore(observeTree, () => (scene ? shapeOf(rootOf(scene)) : ''));
  const [has2DContent, setHas2DContent] = useState(false);
  useEffect(() => {
    let isLatest = true;
    const root = scene && rootOf(scene);
    const read = root ? holdsCanvasItem(root) : Promise.resolve(false);
    read
      .then((holds) => {
        if (isLatest) setHas2DContent(holds);
      })
      .catch((error: unknown) => logger.error(`expected the scene's classes to read, got ${String(error)}`));
    return () => {
      isLatest = false;
    };
  }, [scene, parse, shape]);
  return has2DContent;
}

const NO_STOP = () => {};

function rootOf(scene: Scene): NodeHandle | null {
  return scene.getNodeOrNull(ROOT_WINDOW_PATH)?.getChildren()[0] ?? null;
}

function shapeOf(node: NodeHandle | null): string {
  return node ? `${node.path}:${node.type}(${node.getChildren().map(shapeOf).join(',')})` : '';
}

/** The walk stops at a viewport, whose Controls show only on a surface (ADR-0033). */
async function holdsCanvasItem(node: NodeHandle): Promise<boolean> {
  if ((await node.call('is_class', 'CanvasItem')) === true) return true;
  if ((await node.call('is_class', 'Viewport')) === true) return false;
  for (const child of node.getChildren()) {
    if (await holdsCanvasItem(child)) return true;
  }
  return false;
}
