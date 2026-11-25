import type { ReactNode } from 'react';
import { useHierarchy } from '../../contexts/HierarchyContext.js';
import { usePreviewCamera } from '../TscnPreviewShell/previewCamera.js';
import { useSelectedPath } from '../TscnPreviewShell/previewSelection.js';
import { useUndrawnNode } from '../TscnPreviewShell/previewViewStatus.js';
import { absolutePathOf, liveNodePathOf, ROOT_WINDOW_PATH } from '../../../scene/nodePathWalk.js';
import { spelledLiveNodePath } from '../../../utils/nodePath.js';
import { PropertySection } from './PropertySection.js';
import { useInspection } from './inspection.js';
import styles from './NodeDetailsPanel.module.css';

interface NodeDetailsPanelProps {
  /** Receives the node path as Godot's "Copy Node Path" writes it. Without it the Path row has no copy button. */
  onCopyNodePath?: (nodePath: string) => void;
}

export function NodeDetailsPanel({ onCopyNodePath }: NodeDetailsPanelProps) {
  const path = useSelectedPath();
  const { scene } = useHierarchy();
  const preview = usePreviewCamera();
  const node = path === null ? null : (scene?.getNodeOrNull(absolutePathOf(path)) ?? null);
  const inspection = useInspection(scene, node);
  const undrawn = useUndrawnNode(path ?? '');

  if (!node || !path) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>Select a node to see its properties.</div>
      </div>
    );
  }

  const parent = node.getParent();
  const isPreviewed = preview?.camera === path;

  return (
    <div className={styles.root}>
      <h3 className={styles.title}>{node.name}</h3>

      {/* A banner, not a replacement: an undrawn node still has its properties, and its Type row. */}
      {undrawn?.hasNoComponent && (
        <WarningSection title="Not Implemented">
          <p className={styles.warningText}>
            This node type is not yet drawn by the previewer. It is preserved in the tree and its properties
            are parsed, but nothing appears in the viewport.
          </p>
        </WarningSection>
      )}

      <UndrawnNotices nodePath={path} />

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
        {parent && parent.path !== ROOT_WINDOW_PATH && (
          <div className={styles.row}>
            <span className={styles.label}>Parent:</span>
            <span className={styles.value}>{liveNodePathOf(parent.path)}</span>
          </div>
        )}
        {inspection && inspection.instancedScene !== null && (
          <div className={`${styles.row} ${styles.externalInstance}`}>
            <span className={styles.label}>📦 External:</span>
            <span className={styles.value}>{inspection.instancedScene}</span>
          </div>
        )}
      </div>

      {inspection?.isCamera3D && preview !== null && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Camera</h4>
          {/* Godot's "Preview" checkbox for the selected Camera3D (`node_3d_editor_plugin.cpp:6303-6304`). */}
          <label className={styles.previewToggle} title="Look through this camera in the viewport">
            <input
              type="checkbox"
              checked={isPreviewed}
              onChange={(event) =>
                event.target.checked ? preview.previewCamera(path) : preview.endPreview()
              }
            />
            Preview
          </label>
        </div>
      )}

      {inspection?.sections.map((section, idx) => (
        <PropertySection key={`${section.title}-${idx}`} section={section} />
      ))}
    </div>
  );
}

function WarningSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={`${styles.section} ${styles.warningSection}`}>
      <h4 className={styles.sectionTitle}>{title}</h4>
      {children}
    </div>
  );
}

/** What the view reports it holds of the node and does not draw. */
function UndrawnNotices({ nodePath }: { nodePath: string }) {
  const undrawn = useUndrawnNode(nodePath);
  if (!undrawn) return null;
  return (
    <>
      <UndrawnMeshNotice types={undrawn.meshTypes} />
      {undrawn.isEmptyShape && <EmptyShapeNotice />}
    </>
  );
}

/** Names each mesh type the node holds that the previewer does not draw. */
function UndrawnMeshNotice({ types }: { types: readonly string[] }) {
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
function EmptyShapeNotice() {
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
