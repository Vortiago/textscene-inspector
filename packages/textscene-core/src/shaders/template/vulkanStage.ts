import { attribute, float, Fn, screenCoordinate, screenSize, vec2, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { Vec4 } from '../tslTypes.js';
import type { WrittenBuiltIn } from './emitTemplate.js';
import type { TemplateStageNode } from './templateTree.js';

/** Each `in` global of the vertex stage as the geometry attribute of its name. */
export function vertexAttributes(stage: TemplateStageNode): [string, Node][] {
  return stage.declarations.flatMap((declaration) =>
    declaration.kind === 'global' && declaration.qualifiers.words.includes('in')
      ? declaration.declarators.map(({ name }): [string, Node] => [
          name,
          attribute(name, declaration.type) as unknown as Node,
        ])
      : []
  );
}

/** Moves a clip position, a variable, before it turns to GL's. */
export type ClipStep = (clip: Vec4) => void;

/**
 * How a target's GL rows hold Godot's. `flipped`: GL row 0 is Godot's bottom row, as three shows the
 * drawing buffer. `godot`: GL row 0 is Godot's top row, as in a previewer 2D frame (`world2DCamera.ts`).
 */
export type TargetRows = 'flipped' | 'godot';

/** Vulkan's y down and Godot's reversed depth (`render_scene_data_rd.cpp:83`) as GL's, built once. */
export function glClipPosition(
  position: Node,
  vulkanClip: Vec4,
  step?: ClipStep | null,
  rows: TargetRows = 'flipped'
): Node {
  return Fn(() => {
    const clip = (position as unknown as Vec4).toVar();
    step?.(clip as unknown as Vec4);
    vulkanClip.assign(clip);
    const y = rows === 'godot' ? clip.y : clip.y.negate();
    return vec4(clip.x, y, clip.w.sub(clip.z.mul(2)), clip.w);
  })() as unknown as Node;
}

/** Vulkan's `gl_FragCoord`: the pixel position from the top row, Godot's depth and 1 / w. */
export function vulkanFragCoord(clip: Vec4, rows: TargetRows = 'flipped'): Node {
  // three's `screenCoordinate` counts from GL's last row, so a target of Godot's rows counts back.
  const pixel =
    rows === 'godot' ? vec2(screenCoordinate.x, screenSize.y.sub(screenCoordinate.y)) : screenCoordinate;
  return vec4(pixel, clip.z.div(clip.w), clip.w.reciprocal()) as unknown as Node;
}

/** The `gl_PointSize` write of native points: three's GLSL builder writes 1 (`GLSLNodeBuilder.js:1749`). */
export const NATIVE_POINT_SIZE: WrittenBuiltIn = {
  name: 'gl_PointSize',
  type: 'float',
  initial: float(1) as unknown as Node,
  store: () => undefined,
};
