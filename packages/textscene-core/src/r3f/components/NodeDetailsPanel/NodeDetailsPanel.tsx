/**
 * The properties pane for the selected node. It resolves the node through
 * `useLiveNode` over the live scene tree, so it shows the same identity as
 * the outliner and the viewport.
 */
import { nodeRegistry } from '../../../core/NodeRegistry.js';
import { rendersOwnVisual } from '../../nodeSupport.js';
import { isCamera3DType } from '../../cameraNodeTypes.js';
import { useSelection } from '../../contexts/SelectionContext.js';
import { useOptionalCameraControl } from '../../contexts/CameraControlContext.js';
import { useLiveNode } from '../../useLiveSceneTree.js';
import { PropertySection } from './PropertySection.js';
import styles from './NodeDetailsPanel.module.css';

export function NodeDetailsPanel() {
  const { selectedNodePath } = useSelection();
  const cameraControl = useOptionalCameraControl();

  // The merged node and its originating instance ref. It re-derives when a
  // lazily loaded sub-scene lands.
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
  // See TreeNode: a parser registration does not mean the node renders.
  const isNotRendered = rendersOwnVisual(node.type) === 'not-implemented';

  const sections = registration?.propertyFormatter
    ? registration.propertyFormatter(node.properties)
    : [];

  const showCameraActions = isCamera3DType(node.type) && cameraControl !== null;
  const isActiveCamera =
    cameraControl !== null && cameraControl.activeCameraPath === path;

  return (
    <div className={styles.root}>
      <h3 className={styles.title}>{node.name}</h3>

      {/*
        A banner, not a replacement: an undrawn node still has parsed and
        validated properties. The Type row below states the type.
      */}
      {isNotRendered && (
        <div className={`${styles.section} ${styles.warningSection}`}>
          <h4 className={styles.sectionTitle}>Not Implemented</h4>
          <p className={styles.warningText}>
            This node type is not yet drawn by the previewer. It is preserved in the tree
            and its properties are parsed, but nothing appears in the viewport.
          </p>
        </div>
      )}

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
