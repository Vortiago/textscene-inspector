import { array, float, max, property, varying, vec2, vertexIndex } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { WrittenBuiltIn } from './emitTemplate.js';
import type { Stacked, Vec2, Vec4 } from '../tslTypes.js';
import { POINT_CORNERS, QUAD_VERTICES } from '../../godot/rendering/emulatedPoints.js';

const CORNERS = POINT_CORNERS.map(([x, y]) => vec2(x, y));

/** Godot's Vulkan device draws a point of size 0.5, 0 or -3 exactly as one of size 1. */
const SMALLEST_POINT_SIZE = 1;

/** Points as Godot's Vulkan device draws them, as two triangles a point: the instance is the point. */
export interface DevicePoints {
  /** The template's `gl_PointSize` write. */
  readonly size: WrittenBuiltIn;
  /** The fragment's `gl_PointCoord`, which starts at the top left corner. */
  readonly coord: Node;
  /** Moves `clip`, a variable, to its vertex's corner of a square `gl_PointSize` pixels wide. */
  expand(clip: Vec4, viewportSize: Node): void;
}

/**
 * Whether a shader that reads `namesRead` sizes its points, so the previewer emulates them: three's are 1 px.
 * @canonical Whether a shader sizes its points, so they are emulated
 */
export function sizesPoints(namesRead: ReadonlySet<string>): boolean {
  return namesRead.has('POINT_SIZE');
}

export function devicePoints(): DevicePoints {
  const corner = array(CORNERS).element(vertexIndex.mod(QUAD_VERTICES)) as unknown as Vec2;
  const pointSize = property('float', 'godot_point_size') as unknown as ReturnType<typeof float>;
  return {
    size: {
      name: 'gl_PointSize',
      type: 'float',
      initial: float(1) as unknown as Node,
      store: (value) => (pointSize.assign(value as never) as unknown as Stacked).toStack(),
    },
    coord: varying(corner) as unknown as Node,
    expand: (clip, viewportSize) => {
      const pixels = max(pointSize, float(SMALLEST_POINT_SIZE));
      const offset = corner
        .mul(2)
        .sub(1)
        .mul(pixels.div(viewportSize as never))
        .mul(clip.w);
      (clip.xy.addAssign(offset) as unknown as Stacked).toStack();
    },
  };
}
