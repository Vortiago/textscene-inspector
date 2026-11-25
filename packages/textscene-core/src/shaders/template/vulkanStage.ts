import { attribute, Fn, screenCoordinate, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { Vec4 } from '../tslTypes.js';
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

/** Vulkan's y down and Godot's reversed depth (`render_scene_data_rd.cpp:83`) as GL's, built once. */
export function glClipPosition(position: Node, vulkanClip: Vec4, step?: ClipStep | null): Node {
  return Fn(() => {
    const clip = (position as unknown as Vec4).toVar();
    step?.(clip as unknown as Vec4);
    vulkanClip.assign(clip);
    return vec4(clip.x, clip.y.negate(), clip.w.sub(clip.z.mul(2)), clip.w);
  })() as unknown as Node;
}

/** Vulkan's `gl_FragCoord`: three's pixel position, which starts at the top row, Godot's depth and 1 / w. */
export function vulkanFragCoord(clip: Vec4): Node {
  return vec4(screenCoordinate, clip.z.div(clip.w), clip.w.reciprocal()) as unknown as Node;
}
