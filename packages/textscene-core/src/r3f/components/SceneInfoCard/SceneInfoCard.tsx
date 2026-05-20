/**
 * Small read-only card surfacing scene scale info: total node count and
 * the root node's name. Mirrors main's `#scene-info` block from
 * `git show main:apps/textscene-web/index.html` (see
 * `docs/MAIN-FEATURE-INVENTORY.md` "Scene Info card" section).
 *
 * Hidden when no scene is loaded — the empty-state copy in the tree
 * pane already covers that case.
 */
import { useHierarchy } from '../../contexts/HierarchyContext.js';
import styles from './SceneInfoCard.module.css';

export function SceneInfoCard() {
  const { sceneGraph } = useHierarchy();

  if (sceneGraph === null) {
    return null;
  }

  const nodeCount = sceneGraph.flattenedNodes.length;
  const rootScene = sceneGraph.scenes.get(sceneGraph.rootScene);
  // First root node in the root scene is the "Root" the user expects —
  // matches main's `rootNode.name` from `previewUI.getRootNodeName()`.
  const rootName = rootScene?.nodes[0]?.name ?? 'None';

  return (
    <div
      className={styles.card}
      role="region"
      aria-label="Scene info"
      data-testid="scene-info-card"
    >
      <h3 className={styles.title}>Scene Info</h3>
      {/* Label + value are kept in a single text node so screen.getByText
          searches across the tree don't collide with the root name as a
          standalone span. */}
      <p className={styles.row} data-testid="scene-info-nodes">{`Nodes: ${nodeCount}`}</p>
      <p className={styles.row} data-testid="scene-info-root">{`Root: ${rootName}`}</p>
    </div>
  );
}
