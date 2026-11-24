import { useOptionalHierarchy } from '../../contexts/HierarchyContext.js';
import type { NodeHandle } from '../../../scene/nodeHandle.js';
import { useViewportMode } from '../ViewportMode/ViewportModeContext.js';
import { useSceneRead } from './sceneRead.js';
import styles from './TscnPreviewShell.module.css';

/** CanvasItem content renders only in the 2D workspace, so the 3D one shows a hint. */
export function SwitchTo2DHint() {
  const { setMode } = useViewportMode();
  const has2DContent = useSceneRead(useOptionalHierarchy()?.scene, holdsCanvasItem) === true;
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

/** The walk stops at a viewport, whose Controls show only on a surface (ADR-0033). */
async function holdsCanvasItem(node: NodeHandle): Promise<boolean> {
  if ((await node.call('is_class', 'CanvasItem')) === true) return true;
  if ((await node.call('is_class', 'Viewport')) === true) return false;
  const answers = await Promise.all(node.getChildren().map(holdsCanvasItem));
  return answers.includes(true);
}
