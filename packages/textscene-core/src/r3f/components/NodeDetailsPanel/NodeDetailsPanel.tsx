/**
 * The properties pane for the selected node. It resolves the node through
 * `useLiveNode` over the live scene tree, so it shows the same identity as
 * the outliner and the viewport.
 */
import type { ReactNode } from 'react';
import { nodeRegistry } from '../../../core/NodeRegistry.js';
import { rendersOwnVisual } from '../../nodeSupport.js';
import { isCamera3DType } from '../../cameraNodeTypes.js';
import { useSelection } from '../../contexts/SelectionContext.js';
import { useOptionalViewportActions } from '../../contexts/ViewportActionsContext.js';
import { useLiveNode } from '../../useLiveSceneTree.js';
import { useLivePatchedNode } from '../../liveNodePatches.js';
import { useUndrawnMeshTypes } from '../../contexts/UndrawnMeshesContext.js';
import { useIsEmptyShape } from '../../contexts/EmptyShapesContext.js';
import { spelledLiveNodePath } from '../../../utils/nodePath.js';
import { PropertySection } from './PropertySection.js';
import type { PropertySection as PropertySectionData } from '../../../core/NodeRegistry.js';
import { authoredSpelling, holdsRenamedCopy } from '../../../resources/authoredSpelling.js';
import type { SceneScope } from '../../../parser/types.js';
import styles from './NodeDetailsPanel.module.css';

interface NodeDetailsPanelProps {
  /** Receives the node path as Godot's "Copy Node Path" writes it. Without it the Path row has no copy button. */
  onCopyNodePath?: (nodePath: string) => void;
}

export function NodeDetailsPanel({ onCopyNodePath }: NodeDetailsPanelProps) {
  const { selectedNodePath } = useSelection();
  const viewportActions = useOptionalViewportActions();

  // The merged node and its originating instance ref. It re-derives when a
  // lazily loaded sub-scene lands.
  const entry = useLiveNode(selectedNodePath);
  // The properties the live scene passes bind, such as the transform a RemoteTransform pushes.
  const node = useLivePatchedNode(entry?.node ?? null, selectedNodePath);

  if (!entry || !node || !selectedNodePath) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>Select a node to see its properties.</div>
      </div>
    );
  }

  const { instanceRef } = entry;
  const path = selectedNodePath;
  const registration = nodeRegistry.getRegistration(node.type);
  // See TreeNode: a parser registration does not mean the node renders.
  const isNotRendered = rendersOwnVisual(node.type) === 'not-implemented';

  const sections = registration?.propertyFormatter
    ? authoredSections(registration.propertyFormatter(node.properties), node.scope)
    : [];

  const showCameraActions = isCamera3DType(node.type) && viewportActions !== null;
  const isActiveCamera = viewportActions !== null && viewportActions.activeCameraPath === path;

  return (
    <div className={styles.root}>
      <h3 className={styles.title}>{node.name}</h3>

      {/*
        A banner, not a replacement: an undrawn node still has parsed and
        validated properties. The Type row below states the type.
      */}
      {isNotRendered && (
        <WarningSection title="Not Implemented">
          <p className={styles.warningText}>
            This node type is not yet drawn by the previewer. It is preserved in the tree and its properties
            are parsed, but nothing appears in the viewport.
          </p>
        </WarningSection>
      )}

      <UndrawnMeshNotice nodePath={path} />
      <EmptyShapeNotice nodePath={path} />

      <div className={styles.section}>
        <div className={styles.row}>
          <span className={styles.label}>Type:</span>
          <span className={styles.value}>{node.type}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Path:</span>
          <span className={styles.value}>{path}</span>
          {onCopyNodePath && (
            <button
              type="button"
              className={`${styles.actionButton} ${styles.copyButton}`}
              onClick={() => onCopyNodePath(spelledLiveNodePath(path))}
            >
              Copy node path
            </button>
          )}
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

      {showCameraActions && viewportActions !== null && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Camera</h4>
          {isActiveCamera ? (
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => viewportActions.returnToFreeView()}
            >
              Reset Camera
            </button>
          ) : (
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => viewportActions.switchToCamera(path)}
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

/** Each value with its references spelled as their own files wrote them. */
function authoredSections(
  sections: PropertySectionData[],
  scope: SceneScope | undefined
): PropertySectionData[] {
  if (!scope || !holdsRenamedCopy(scope)) return sections;
  return sections.map((section) => ({
    ...section,
    items: section.items.map((item) => ({ ...item, value: authoredSpelling(item.value, scope) })),
  }));
}

function WarningSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={`${styles.section} ${styles.warningSection}`}>
      <h4 className={styles.sectionTitle}>{title}</h4>
      {children}
    </div>
  );
}

/** Names each mesh type the node holds that the previewer does not draw. */
function UndrawnMeshNotice({ nodePath }: { nodePath: string }) {
  const types = useUndrawnMeshTypes(nodePath);
  if (types.length === 0) return null;
  const meshes = types.length === 1 ? `${types[0]} mesh is` : `${types.join(', ')} meshes are`;
  return (
    <WarningSection title="Mesh Not Drawn">
      <p className={styles.warningText}>
        Its {meshes} not yet drawn by the previewer. The viewport shows a wireframe box, or nothing, where
        Godot draws it.
      </p>
    </WarningSection>
  );
}

/** `CSGShape3D::get_configuration_warnings`, line for line (`csg_shape.cpp:982`). */
const EMPTY_SHAPE_WARNING = [
  'The CSGShape3D has an empty shape.',
  'CSGShape3D empty shapes typically occur because the mesh is not manifold.',
  'A manifold mesh forms a solid object without gaps, holes, or loose edges.',
  'Each edge must be a member of exactly two faces.',
];

/** Godot's warning for a CSG shape whose brush is empty, such as an open one. */
function EmptyShapeNotice({ nodePath }: { nodePath: string }) {
  if (!useIsEmptyShape(nodePath)) return null;
  return (
    <WarningSection title="Empty Shape">
      {EMPTY_SHAPE_WARNING.map((line) => (
        <p key={line} className={styles.warningText}>
          {line}
        </p>
      ))}
    </WarningSection>
  );
}
