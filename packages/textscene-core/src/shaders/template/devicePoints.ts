import { array, float, max, property, varying, vec2, vertexIndex } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { WrittenBuiltIn } from './emitTemplate.js';
import type { Stacked, Vec2, Vec4 } from '../tslTypes.js';

/** `point_coords` (`scene_forward_clustered.glsl:709`): the corner each of a point's 6 vertices takes. */
const CORNERS = [vec2(0, 1), vec2(0, 0), vec2(1, 1), vec2(0, 0), vec2(1, 0), vec2(1, 1)];

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

export function devicePoints(): DevicePoints {
  const corner = array(CORNERS).element(vertexIndex.mod(6)) as unknown as Vec2;
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
