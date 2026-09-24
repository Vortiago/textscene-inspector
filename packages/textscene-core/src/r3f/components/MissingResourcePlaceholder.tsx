/**
 * The editor marker for a referenced resource that failed to resolve. The path goes
 * to the DOM `<MissingResourcesPanel>`, since clustered 3D labels overlap into blobs.
 * MeshInstance3D does not use it: a magenta material on its real geometry keeps the shape.
 */
import { CanvasItemGroup } from './CanvasItemGroup';
import { canvasItemFacing } from '../canvasItemFacing';
import { materialProgramInputs } from '../materialProgramInputs';
import { wireGizmoProgram } from './wireGizmoProgram';

export type MissingResourcePlaceholderShape = 'box' | 'plane';

interface Props {
  /**
   * A magenta wireframe `box` anchors a 3D node, such as a missing scene. A translucent
   * `plane` shows a sprite footprint. A lone `planeGeometry` winds one way, so
   * `canvasItemFacing()` holds on it.
   */
  shape: MissingResourcePlaceholderShape;
  /** Optional name on the wrapping group for tree / debug lookup. */
  name?: string;
  /** Optional transform, so Sprite3D's placeholder sits where the sprite would render. */
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}

const BOX_SIZE: [number, number, number] = [0.5, 0.5, 0.5];

// Both literal-only, so both keys are constant and the marker never remounts.
// Module scope, since the component draws one of them.
const BOX_MATERIAL = wireGizmoProgram('magenta');
const PLANE_MATERIAL = materialProgramInputs({
  props: { color: 'magenta', transparent: true, opacity: 0.6 },
  merge: [canvasItemFacing()],
});

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
          <meshBasicMaterial key={BOX_MATERIAL.key} {...BOX_MATERIAL.props} />
        </mesh>
      ) : (
        <mesh>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial key={PLANE_MATERIAL.key} {...PLANE_MATERIAL.props} />
        </mesh>
      )}
    </CanvasItemGroup>
  );
}
