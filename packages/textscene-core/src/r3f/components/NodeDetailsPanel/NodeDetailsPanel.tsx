/**
 * Properties pane for the currently-selected scene node. Reads selection
 * from `<SelectionContext>` and the scene graph from `<HierarchyContext>`.
 */
import { useMemo } from 'react';
import { nodeRegistry } from '../../../core/NodeRegistry.js';
import { isRenderableNodeType } from '../../nodeSupport.js';
import type { TscnNode } from '../../../parser/types.js';
import { useHierarchy } from '../../contexts/HierarchyContext.js';
import { useSelection } from '../../contexts/SelectionContext.js';
import { useOptionalCameraControl } from '../../contexts/CameraControlContext.js';
import { useResourceLoader } from '../../../resources/useResource.js';
import { resolveNodeByPath } from '../SceneTreeViewer/resolveNodeByPath.js';
import { PropertySection } from './PropertySection.js';
import styles from './NodeDetailsPanel.module.css';

interface SelectedNode {
  node: TscnNode;
  path: string;
}

export function NodeDetailsPanel() {
  const { sceneGraph } = useHierarchy();
  const { selectedNodePath } = useSelection();
  const cameraControl = useOptionalCameraControl();
  const loader = useResourceLoader();

  const selection = useMemo<SelectedNode | null>(() => {
    if (!sceneGraph || !selectedNodePath) return null;

    // Fast path: inline nodes (and instance ROOTS) live in
    // flattenedNodes. This covers every fully-inline scene.
    const entry = sceneGraph.flattenedNodes.find((n) => n.path === selectedNodePath);
    if (entry) return { node: entry.data, path: entry.path };

    // BUG 1: nodes INSIDE an instanced PackedScene are absent from
    // flattenedNodes (the shell only addScene()s the inline root). Walk
    // the same live inline + sub-scene tree the SceneTreeViewer renders,
    // descending into sub-scenes via the loader's scene cache.
    const rootScene = sceneGraph.scenes.get(sceneGraph.rootScene);
    if (!rootScene || !loader) return null;
    const resolved = resolveNodeByPath(
      selectedNodePath,
      rootScene.nodes,
      rootScene.externalResources,
      loader.scenes,
      loader.glbMeshes
    );
    return resolved ? { node: resolved, path: selectedNodePath } : null;
  }, [sceneGraph, selectedNodePath, loader]);

  if (!selection) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>Select a node to see its properties.</div>
      </div>
    );
  }

  const { node, path } = selection;
  const registration = nodeRegistry.getRegistration(node.type);
  const isUnsupported = !isRenderableNodeType(node.type);

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

  const sections = registration?.propertyFormatter
    ? registration.propertyFormatter(node.properties)
    : [];

  const showCameraActions = node.type === 'Camera3D' && cameraControl !== null;
  const isActiveCamera =
    cameraControl !== null && cameraControl.activeCameraPath === path;

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

      {showCameraActions && cameraControl !== null && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Camera</h4>
          {isActiveCamera ? (
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => cameraControl.returnToFreeView()}
            >
              Reset Camera
            </button>
          ) : (
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => cameraControl.switchToCamera(path)}
            >
              Use This Camera
            </button>
          )}
        </div>
      )}

      {sections.map((section, idx) => (
        <PropertySection key={`${section.title}-${idx}`} section={section} />
      ))}
    </div>
  );
}
