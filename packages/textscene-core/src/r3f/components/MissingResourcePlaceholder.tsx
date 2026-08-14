/**
 * Editor-only visual marker for "this resource is referenced but failed
 * to resolve". Consolidates two near-identical magenta-shape
 * widgets that previously lived inline in node components:
 *   - `NodeDispatcher.InstancePlaceholder` — wireframe magenta box for a
 *     missing PackedScene reference.
 *   - `Sprite3D.Placeholder` — translucent magenta plane for a missing
 *     sprite texture (the plane shape reflects the sprite's quad nature).
 *
 * Both render no text — Gap 12 moved the path label into the
 * DOM `<MissingResourcesPanel>` because in-3D drei text overlapped into
 * illegible blobs when several missing-resource markers clustered.
 *
 * Two shapes:
 *   - `box`   — small wireframe cube; positional anchor for a 3D node.
 *   - `plane` — translucent quad; reflects a sprite/billboard footprint.
 *
 * MeshInstance3D's missing-mesh / missing-texture branches do NOT use
 * this — they swap a magenta material onto the **actual** mesh geometry
 * so the unresolved mesh's shape stays visible to the user (a different
 * affordance, not a placeholder widget).
 *
 * Sprite3D and the GLB scene root mount the `plane` marker too, which makes it
 * the one place a 3D node reaches `canvasItemFacing()`. Single pass stays
 * correct there: a lone `planeGeometry` winds one way, so exactly one of the
 * two facing passes was ever producing a fragment for it and the pass that is
 * dropped drew nothing.
 */
import { CanvasItemGroup } from './CanvasItemGroup';
import { canvasItemFacing } from '../canvasItemFacing';

export type MissingResourcePlaceholderShape = 'box' | 'plane';

interface Props {
  /** Visual shape — see file header. */
  shape: MissingResourcePlaceholderShape;
  /** Optional name on the wrapping group for tree / debug lookup. */
  name?: string;
  /** Optional transform — used by Sprite3D so the placeholder sits where
   *  the sprite would have rendered. */
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}

const BOX_SIZE: [number, number, number] = [0.5, 0.5, 0.5];

export function MissingResourcePlaceholder({
  shape,
  name,
  position,
  rotation,
  scale,
}: Props) {
  return (
    <CanvasItemGroup name={name} position={position} rotation={rotation} scale={scale}>
      {shape === 'box' ? (
        <mesh>
          <boxGeometry args={BOX_SIZE} />
          <meshBasicMaterial color="magenta" wireframe />
        </mesh>
      ) : (
        <mesh>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color="magenta" transparent opacity={0.6} {...canvasItemFacing()} />
        </mesh>
      )}
    </CanvasItemGroup>
  );
}
