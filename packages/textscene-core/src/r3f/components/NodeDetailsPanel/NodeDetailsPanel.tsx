/**
 * Properties pane for the currently-selected scene node. Reads selection from
 * `<SelectionContext>` and resolves the node through `useLiveNode` over the
 * shared live scene tree (Instance root merge + sub-scene/GLB descent), so the
 * inspector shows the same effective identity as the tree and viewport.
 */
import { nodeRegistry } from '../../../core/NodeRegistry.js';
import { isRenderableNodeType } from '../../nodeSupport.js';
import { useSelection } from '../../contexts/SelectionContext.js';
import { useOptionalCameraControl } from '../../contexts/CameraControlContext.js';
import { useLiveNode } from '../../useLiveSceneTree.js';
import { PropertySection } from './PropertySection.js';
import styles from './NodeDetailsPanel.module.css';

export function NodeDetailsPanel() {
  const { selectedNodePath } = useSelection();
  const cameraControl = useOptionalCameraControl();

  // The EFFECTIVE (collapsed) node at the selected path plus its originating
  // instance ref, resolved over the same live tree the SceneTreeViewer and
  // viewport render — so the inspector agrees with them for instance roots and
  // sub-scene interiors, and re-derives when a lazily-loaded sub-scene lands.
  const entry = useLiveNode(selectedNodePath);

  if (!entry || !selectedNodePath) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>Select a node to see its properties.</div>
      </div>
    );
  }

  const { node, instanceRef } = entry;
  const path = selectedNodePath;
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
        {instanceRef && (
          <div className={`${styles.row} ${styles.externalInstance}`}>
            <span className={styles.label}>📦 External:</span>
            <span className={styles.value}>{instanceRef}</span>
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
