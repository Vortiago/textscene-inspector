/**
 * Properties pane for the currently-selected scene node. Reads selection
 * from `<SelectionContext>` and the scene graph from `<HierarchyContext>`.
 * Replaces the imperative `packages/textscene-core/src/ui/NodeDetailsFormatter.ts`.
 */
import { useMemo } from 'react';
import { nodeRegistry } from '../../../core/NodeRegistry.js';
import type { TscnNode } from '../../../parser/types.js';
import { useHierarchy } from '../../contexts/HierarchyContext.js';
import { useSelection } from '../../contexts/SelectionContext.js';
import { PropertySection } from './PropertySection.js';
import styles from './NodeDetailsPanel.module.css';

interface SelectedNode {
  node: TscnNode;
  path: string;
}

export function NodeDetailsPanel() {
  const { sceneGraph } = useHierarchy();
  const { selectedNodePath } = useSelection();

  const selection = useMemo<SelectedNode | null>(() => {
    if (!sceneGraph || !selectedNodePath) return null;
    const entry = sceneGraph.flattenedNodes.find((n) => n.path === selectedNodePath);
    return entry ? { node: entry.data, path: entry.path } : null;
  }, [sceneGraph, selectedNodePath]);

  if (!selection) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>Select a node to see its properties.</div>
      </div>
    );
  }

  const { node, path } = selection;
  const registration = nodeRegistry.getRegistration(node.type);
  const isUnsupported = !registration && node.type !== 'Node';

  if (isUnsupported) {
    return (
      <div className={styles.root}>
        <h3 className={styles.title}>{node.name}</h3>
        <div className={`${styles.section} ${styles.warningSection}`}>
          <h4 className={styles.sectionTitle}>Not Implemented</h4>
          <p className={styles.warningText}>
            The node type <strong>{node.type}</strong> is not yet supported by the renderer.
            The node is preserved in the tree hierarchy, but it won&rsquo;t be visualized in
            the 3D viewport.
          </p>
        </div>
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Node Information</h4>
          <div className={styles.row}>
            <span className={styles.label}>Name:</span>
            <span className={styles.value}>{node.name}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Type:</span>
            <span className={styles.value}>
              <code>{node.type}</code>
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Path:</span>
            <span className={styles.value}>
              <code>{path}</code>
            </span>
          </div>
        </div>
      </div>
    );
  }

  // TODO(WI-R3F-5): camera switching action buttons (Use This Camera /
  // Return to Free View) for Camera3D nodes. Requires CameraControlContext
  // and active-camera-path coordination with the canvas.

  const sections = registration?.propertyFormatter
    ? registration.propertyFormatter(node.properties)
    : [];

  return (
    <div className={styles.root}>
      <h3 className={styles.title}>{node.name}</h3>

      <div className={styles.section}>
        <div className={styles.row}>
          <span className={styles.label}>Type:</span>
          <span className={styles.value}>{node.type}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Path:</span>
          <span className={styles.value}>{path}</span>
        </div>
        {node.parent && (
          <div className={styles.row}>
            <span className={styles.label}>Parent:</span>
            <span className={styles.value}>{node.parent}</span>
          </div>
        )}
        {node.instance && (
          <div className={`${styles.row} ${styles.externalInstance}`}>
            <span className={styles.label}>📦 External:</span>
            <span className={styles.value}>{node.instance}</span>
          </div>
        )}
      </div>

      {sections.map((section, idx) => (
        <PropertySection key={`${section.title}-${idx}`} section={section} />
      ))}
    </div>
  );
}
